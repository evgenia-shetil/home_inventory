create or replace function public.adjust_quantity(
  p_item_id uuid,
  p_delta   numeric,
  p_kind    text,
  p_price   numeric default null,
  p_place   text    default null
) returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_old_qty numeric;
  v_new_qty numeric;
  v_item    public.items;
begin
  if v_uid is null then
    raise exception 'не авторизовано';
  end if;

  if p_kind not in ('consume','restock','correction') then
    raise exception 'невідомий тип операції: %', p_kind;
  end if;

  -- Блокування рядка робить операцію безпечною при одночасних тапах
  -- з різних пристроїв: другий чекає, а не читає застаріле значення.
  select qty into v_old_qty
    from public.items
   where id = p_item_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'товар не знайдено';
  end if;

  v_new_qty := greatest(v_old_qty + p_delta, 0);

  update public.items
     set qty        = v_new_qty,
         last_price = coalesce(p_price, last_price),
         last_place = coalesce(nullif(p_place, ''), last_place),
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  -- У журнал пишеться фактично застосована зміна, а не запитана:
  -- якщо спрацювало обмеження нулем, історія має відображати реальність.
  insert into public.events (user_id, item_id, delta, kind, price, place)
  values (v_uid, p_item_id, v_new_qty - v_old_qty, p_kind, p_price, nullif(p_place, ''));

  return v_item;
end;
$$;

revoke all on function public.adjust_quantity(uuid, numeric, text, numeric, text) from public;
grant execute on function public.adjust_quantity(uuid, numeric, text, numeric, text) to authenticated;
