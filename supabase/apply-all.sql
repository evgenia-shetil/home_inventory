-- Кроки 2-3: вставити ЦЕ ЦІЛКОМ у Supabase SQL Editor і натиснути Run.
-- Об'єднані міграції 0001-0004. Storage (0005) — окремо, після створення бакета.

-- ============ 0001_schema ============
create extension if not exists "pgcrypto";

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  category_id uuid references public.categories(id) on delete set null,
  photo_path  text,
  qty         numeric not null default 0 check (qty >= 0),
  unit        text    not null default 'шт',
  threshold   numeric not null default 1 check (threshold >= 0),
  last_price  numeric check (last_price >= 0),
  last_place  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    uuid not null references public.items(id) on delete cascade,
  delta      numeric not null,
  kind       text not null check (kind in ('consume','restock','correction')),
  price      numeric check (price >= 0),
  place      text,
  created_at timestamptz not null default now()
);

create index items_user_idx      on public.items(user_id);
create index items_category_idx  on public.items(category_id);
create index events_item_idx     on public.events(item_id, created_at desc);
create index categories_user_idx on public.categories(user_id, sort_order);

-- ============ 0002_rls ============
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

-- ============ 0003_adjust_quantity ============
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

-- ============ 0004_default_categories ============
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

