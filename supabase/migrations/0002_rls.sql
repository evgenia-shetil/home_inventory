alter table public.categories enable row level security;
alter table public.items      enable row level security;
alter table public.events     enable row level security;

create policy categories_own on public.categories
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy items_own on public.items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Журнал лише читається з клієнта. Запис робить виключно adjust_quantity.
create policy events_read_own on public.events
  for select to authenticated
  using (user_id = auth.uid());

-- Кількість не можна змінити напряму: RLS не вміє обмежувати стовпці,
-- тому обмеження ставиться через column-level grant.
revoke update on public.items from authenticated;
grant update (name, category_id, photo_path, unit, threshold, last_place, last_price)
  on public.items to authenticated;
