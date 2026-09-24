-- Журнал стає повним: кількість кожного товару дорівнює сумі його подій.
-- Застосовується ДО пуша коду, який на це розраховує.
--
-- Досі початкова кількість не записувалась: товар створювався одразу з
-- qty, без події. Через це сума журналу не збігалась із полицею, і ні
-- перевірити облік, ні відновити його з журналу було неможливо.

-- 1. Новий вид операції — початковий залишок. Не покупка (у витрати не
--    йде) і не витрата (у прогноз не йде): просто те, що вже було вдома.
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check
  check (kind in ('consume', 'restock', 'correction', 'open', 'discard', 'unit', 'opening'));

create or replace function public.adjust_quantity(
  p_item_id uuid,
  p_delta   numeric,
  p_kind    text,
  p_price   numeric default null,
  p_place   text    default null,
  p_bucket  text    default 'stock'
) returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_old_qty   numeric;
  v_old_use   numeric;
  v_new_qty   numeric;
  v_new_use   numeric;
  v_applied   numeric;
  v_item      public.items;
begin
  if v_uid is null then
    raise exception 'не авторизовано';
  end if;

  if p_kind not in ('consume','restock','correction','open','discard','opening') then
    raise exception 'невідомий тип операції: %', p_kind;
  end if;

  if p_bucket not in ('stock','in_use','move') then
    raise exception 'невідомий лічильник: %', p_bucket;
  end if;

  select qty, in_use into v_old_qty, v_old_use
    from public.items
   where id = p_item_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'товар не знайдено';
  end if;

  if p_bucket = 'stock' then
    v_new_qty := greatest(v_old_qty + p_delta, 0);
    v_new_use := v_old_use;
    v_applied := v_new_qty - v_old_qty;

  elsif p_bucket = 'in_use' then
    v_new_use := greatest(v_old_use + p_delta, 0);
    v_new_qty := v_old_qty;
    v_applied := v_new_use - v_old_use;

  else
    v_applied := least(p_delta, v_old_qty);
    if p_delta < 0 then
      v_applied := greatest(p_delta, -v_old_use);
    end if;
    v_new_qty := v_old_qty - v_applied;
    v_new_use := v_old_use + v_applied;
  end if;

  update public.items
     set qty        = v_new_qty,
         in_use     = v_new_use,
         last_price = coalesce(p_price, last_price),
         last_place = coalesce(nullif(p_place, ''), last_place),
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  insert into public.events (user_id, item_id, delta, kind, price, place, bucket)
  values (v_uid, p_item_id, v_applied, p_kind, p_price, nullif(p_place, ''), p_bucket);

  return v_item;
end;
$$;

-- 2. Переведення в упаковки пише в журнал реальну зміну обох лічильників,
--    а не нуль: інакше після переведення сума журналу знову розходилась би
--    з полицею. Прогноз однаково відкидає все до події 'unit'.
create or replace function public.convert_to_packs(
  p_item_id   uuid,
  p_pack_size numeric
) returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_old  public.items;
  v_item public.items;
  v_note text;
begin
  if v_uid is null then
    raise exception 'не авторизовано';
  end if;

  if p_pack_size is null or p_pack_size <= 0 then
    raise exception 'обʼєм упаковки має бути більшим за нуль';
  end if;

  select * into v_old
    from public.items
   where id = p_item_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'товар не знайдено';
  end if;

  if v_old.unit not in ('мл', 'л', 'г', 'кг') then
    raise exception 'товар уже рахується упаковками';
  end if;

  update public.items
     set qty        = round(v_old.qty / p_pack_size, 3),
         in_use     = round(v_old.in_use / p_pack_size, 3),
         unit       = 'шт',
         pack_size  = p_pack_size,
         pack_unit  = v_old.unit,
         last_price = v_old.last_price * p_pack_size,
         threshold  = greatest(1, round(v_old.threshold / p_pack_size)),
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  v_note := format('%s %s → %s шт по %s %s',
                   v_old.qty + v_old.in_use, v_old.unit,
                   v_item.qty + v_item.in_use, p_pack_size, v_old.unit);

  insert into public.events (user_id, item_id, delta, kind, bucket, note)
  values (v_uid, p_item_id, v_item.qty - v_old.qty, 'unit', 'stock', v_note),
         (v_uid, p_item_id, v_item.in_use - v_old.in_use, 'unit', 'in_use', v_note);

  return v_item;
end;
$$;

-- 3. Перевірка: товари, у яких полиця не збігається з сумою журналу.
--    security invoker — працює під RLS, тож кожен бачить лише своє.
--    Перенесення (bucket 'move') забирає з шафи й додає в користування.
create or replace function public.journal_mismatches()
returns table (item_id uuid, name text, qty numeric, journal_qty numeric,
               in_use numeric, journal_in_use numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with sums as (
    select e.item_id,
           coalesce(sum(case when e.bucket = 'stock'  then e.delta
                             when e.bucket = 'move'   then -e.delta end), 0) as j_qty,
           coalesce(sum(case when e.bucket = 'in_use' then e.delta
                             when e.bucket = 'move'   then e.delta end), 0) as j_use
      from public.events e
     group by e.item_id
  )
  select i.id, i.name, i.qty, coalesce(s.j_qty, 0), i.in_use, coalesce(s.j_use, 0)
    from public.items i
    left join sums s on s.item_id = i.id
   where i.qty <> coalesce(s.j_qty, 0) or i.in_use <> coalesce(s.j_use, 0)
   order by i.name
$$;

grant execute on function public.journal_mismatches() to authenticated;

-- 4. Дозапис початкових залишків для всього, що вже є: різниця між
--    полицею й сумою журналу стає подією 'opening' з датою створення
--    товару. Після цього journal_mismatches() для всіх порожня.
--    Виконується від власника таблиці, тож обходить RLS — один раз, тут.
insert into public.events (user_id, item_id, delta, kind, bucket, created_at)
select i.user_id, i.id, d.delta, 'opening', d.bucket, i.created_at
  from public.items i
  left join (
    select e.item_id,
           coalesce(sum(case when e.bucket = 'stock'  then e.delta
                             when e.bucket = 'move'   then -e.delta end), 0) as j_qty,
           coalesce(sum(case when e.bucket = 'in_use' then e.delta
                             when e.bucket = 'move'   then e.delta end), 0) as j_use
      from public.events e
     group by e.item_id
  ) s on s.item_id = i.id
  cross join lateral (values
    ('stock',  i.qty    - coalesce(s.j_qty, 0)),
    ('in_use', i.in_use - coalesce(s.j_use, 0))
  ) as d(bucket, delta)
 where d.delta <> 0;
