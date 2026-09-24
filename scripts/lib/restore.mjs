// Перетворює файл резервної копії на SQL для Supabase SQL Editor.
//
// Відновлення не може йти через застосунок: кількість напряму не
// змінюється (інваріант 1), а журнал дописують лише функції. SQL Editor
// працює від власника таблиць, тож вставляє рядки з датами й журналом як
// є, і після відновлення історія та прогноз ті самі.
//
// Ідентифікатори призначаються заново, а звʼязки між ними
// перераховуються. Зі старими id відновлення ламалось би, щойно старі
// рядки ще існують — наприклад, при відновленні в інший акаунт того
// самого проєкту.
//
// Уся копія вкладається в SQL одним JSON-літералом і розбирається самим
// Postgres (jsonb_populate_record): так не треба екранувати кожне поле, і
// нові стовпці, додані після створення копії, просто лишаються порожніми.

const FORMAT = 'zapasy-backup'

export function buildRestoreSql(backup, email) {
  if (backup?.format !== FORMAT) throw new Error('Це не файл копії «Запасів»')
  if (!email || !email.includes('@')) throw new Error('Потрібна пошта акаунта, у який відновлювати')

  // Фото в копію не входять, а шлях вів би в теку старого акаунта.
  const payload = {
    categories: backup.categories ?? [],
    items: (backup.items ?? []).map(i => ({ ...i, photo_path: null })),
    events: backup.events ?? [],
  }
  // Долар-лапки з міткою, якої немає в даних: вміст не треба екранувати.
  let tag = 'zapasy'
  const json = JSON.stringify(payload)
  while (json.includes(`$${tag}$`)) tag += '_'
  const literal = `$${tag}$${json}$${tag}$`
  const mail = email.replace(/'/g, "''")

  return `-- Відновлення «Запасів» з копії від ${backup.exported_at}
-- Категорій: ${payload.categories.length}, товарів: ${payload.items.length}, подій: ${payload.events.length}.
-- Вставити в Supabase → SQL Editor → New query повністю й натиснути Run.
begin;

-- Журнал переноситься цілком, з початковими залишками; тригер, що
-- дописує їх для нових товарів (0018), тут мусить мовчати.
set local zapasy.restoring = 'on';

create temporary table restore_data on commit drop as
  select ${literal}::jsonb as data;

-- Старий id → новий, для всіх трьох таблиць разом.
create temporary table restore_ids on commit drop as
  select (elem->>'id')::uuid as old_id, gen_random_uuid() as new_id
    from restore_data,
         -- Дужки обовʼязкові: -> і || мають однаковий пріоритет, і без них
         -- вираз читався б як ((data->'categories') || data)->'items'…
         jsonb_array_elements((data->'categories') || (data->'items') || (data->'events')) elem;

create or replace function pg_temp.remap(p_old text) returns jsonb language sql as $f$
  select coalesce(to_jsonb((select new_id from restore_ids where old_id = $1::uuid)), 'null'::jsonb)
$f$;

do $restore$
declare
  v_uid uuid := (select id from auth.users where email = '${mail}');
begin
  if v_uid is null then
    raise exception 'Акаунт ${mail} не знайдено. Спершу створіть його: Authentication → Users → Add user.';
  end if;

  -- Відновлюємо лише в порожній облік: злиття з наявними даними дало б
  -- дублікати, яких потім не розплутати.
  if exists (select 1 from public.items where user_id = v_uid) then
    raise exception 'В акаунті вже є товари. Відновлення можливе лише в порожній акаунт.';
  end if;

  -- Стартові категорії, створені при першому вході, прибираємо: інакше
  -- вони зіткнулись би з категоріями з копії за унікальністю назв.
  delete from public.categories where user_id = v_uid;

  -- Спершу головні категорії, потім підкатегорії: інакше посилання на
  -- батька вказувало б на ще не вставлений рядок.
  insert into public.categories
  select (jsonb_populate_record(null::public.categories, elem || jsonb_build_object(
            'user_id', v_uid, 'id', pg_temp.remap(elem->>'id'),
            'parent_id', pg_temp.remap(elem->>'parent_id')))).*
    from restore_data, jsonb_array_elements(data->'categories') elem
   order by (elem->>'parent_id') is not null;

  insert into public.items
  select (jsonb_populate_record(null::public.items, elem || jsonb_build_object(
            'user_id', v_uid, 'id', pg_temp.remap(elem->>'id'),
            'category_id', pg_temp.remap(elem->>'category_id')))).*
    from restore_data, jsonb_array_elements(data->'items') elem;

  insert into public.events
  select (jsonb_populate_record(null::public.events, elem || jsonb_build_object(
            'user_id', v_uid, 'id', pg_temp.remap(elem->>'id'),
            'item_id', pg_temp.remap(elem->>'item_id')))).*
    from restore_data, jsonb_array_elements(data->'events') elem;
end
$restore$;

commit;
`
}
