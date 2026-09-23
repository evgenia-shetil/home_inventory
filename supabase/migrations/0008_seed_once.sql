-- Сидінг лише для порожнього акаунта. Раніше функція щоразу
-- «воскрешала» чотири категорії за замовчуванням, і видалити їх
-- назавжди було неможливо: наступне відкриття застосунку повертало їх.
create or replace function public.ensure_default_categories()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  v_parent uuid;
begin
  if v_uid is null then
    raise exception 'не авторизовано';
  end if;

  -- Є хоч одна категорія — користувачка вже господарює тут сама.
  if exists (select 1 from public.categories where user_id = v_uid) then
    return;
  end if;

  insert into public.categories (user_id, name, sort_order, parent_id)
  values (v_uid, 'прибирання', 1, null),
         (v_uid, 'тіло',       2, null),
         (v_uid, 'обличчя',    3, null),
         (v_uid, 'ліки',       4, null);

  for r in select * from public.default_subcategories()
  loop
    select id into v_parent from public.categories
     where user_id = v_uid and name = r.parent and parent_id is null;

    insert into public.categories (user_id, name, sort_order, parent_id)
    values (v_uid, r.child, r.ord, v_parent);
  end loop;
end;
$$;

revoke all on function public.ensure_default_categories() from public;
grant execute on function public.ensure_default_categories() to authenticated;
