-- Терміни придатності, фасування й два нові види операцій.
-- Застосовується ДО пуша коду, який на це розраховує.

-- 1. Термін придатності. Рядок описує вид товару, а не окрему упаковку,
--    тож дата одна — найближча серед наявних. Це наближення: точніше
--    вимагало б окремого рядка на кожну партію.
alter table public.items
  add column expires_on date;

-- 2. Фасування — опис упаковки, а не міра запасу. Запас рахується
--    упаковками: «шампунь великий 500 мл» і «шампунь дорожній 50 мл»
--    дають дві упаковки, а не 550 мл, складені з різних речей.
alter table public.items
  add column pack_size numeric check (pack_size > 0),
  add column pack_unit text;

grant update (expires_on, pack_size, pack_unit) on public.items to authenticated;

-- 3. Нові види операцій:
--    discard — списання зіпсованого. Це не витрата: якби прострочене
--              списувалось як consume, прогноз вирішив би, що річ
--              витрачається швидше, ніж насправді.
--    unit    — зміна одиниці виміру. Кількість до і після рахується
--              в різних одиницях, тож прогноз відкидає все, що раніше.
alter table public.events
  add column note text;

alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check
  check (kind in ('consume', 'restock', 'correction', 'open', 'discard', 'unit'));

-- adjust_quantity та сама, що в 0013, лише з 'discard' серед дозволених.
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

  if p_kind not in ('consume','restock','correction','open','discard') then
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

revoke all on function public.adjust_quantity(uuid, numeric, text, numeric, text, text) from public;
grant execute on function public.adjust_quantity(uuid, numeric, text, numeric, text, text) to authenticated;

-- 4. Переведення товару з мір (мл, г…) в упаковки. Окрема функція, бо
--    кількість напряму міняти не можна (інваріант 1), а через
--    adjust_quantity не виразити зміну одиниці: це не дельта.
--    Однією транзакцією: кількість, одиниця, ціна за одиницю й запис
--    у журналі з поясненням, що саме сталось.
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
         -- Ціна за мілілітр стає ціною за упаковку.
         last_price = v_old.last_price * p_pack_size,
         -- Запасний поріг у мілілітрах після переведення безглуздий.
         threshold  = greatest(1, round(v_old.threshold / p_pack_size)),
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  insert into public.events (user_id, item_id, delta, kind, bucket, note)
  values (v_uid, p_item_id, 0, 'unit', 'stock',
          format('%s %s → %s шт по %s %s',
                 v_old.qty + v_old.in_use, v_old.unit,
                 v_item.qty + v_item.in_use, p_pack_size, v_old.unit));

  return v_item;
end;
$$;

revoke all on function public.convert_to_packs(uuid, numeric) from public;
grant execute on function public.convert_to_packs(uuid, numeric) to authenticated;
