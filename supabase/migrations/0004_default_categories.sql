create or replace function public.ensure_default_categories()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'не авторизовано';
  end if;

  insert into public.categories (user_id, name, sort_order)
  values (v_uid, 'прибирання', 1),
         (v_uid, 'тіло',       2),
         (v_uid, 'обличчя',    3),
         (v_uid, 'ліки',       4)
  on conflict (user_id, name) do nothing;
end;
$$;

revoke all on function public.ensure_default_categories() from public;
grant execute on function public.ensure_default_categories() to authenticated;
