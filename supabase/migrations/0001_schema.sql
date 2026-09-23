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
