-- Уся зміна кількості й далі проходить однією транзакцією, але тепер
-- знає, який лічильник чіпає. Це зберігає головний інваріант: кількість
-- неможливо змінити повз журнал.
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

  if p_kind not in ('consume','restock','correction','open') then
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
    -- Перенесення: скільки насправді вдалося взяти з шафи, стільки
    -- і зʼявиться в користуванні. Сума при цьому не змінюється.
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

-- Стару сигнатуру прибираємо, щоб не лишалось двох шляхів до тих самих даних.
drop function if exists public.adjust_quantity(uuid, numeric, text, numeric, text);
