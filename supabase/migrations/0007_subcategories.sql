-- 1. Дерево категорій через самопосилання. Видалення батька забирає дітей,
--    а товари з видаленої категорії просто лишаються без неї (0001: set null).
alter table public.categories
  add column parent_id uuid references public.categories(id) on delete cascade;

create index categories_parent_idx on public.categories(parent_id);

-- 2. Унікальність назви тепер у межах батька, а не глобальна:
--    «крем» під «обличчям» і під «тілом» — різні речі.
--    Потрібні два індекси, бо для кореневих батька немає, а NULL
--    Postgres вважає унікальним сам по собі і від дублів не захистить.
alter table public.categories drop constraint categories_user_id_name_key;

create unique index categories_root_name
  on public.categories (user_id, name) where parent_id is null;

create unique index categories_child_name
  on public.categories (user_id, parent_id, name) where parent_id is not null;

-- 3. Набір підкатегорій за замовчуванням, спільний для сидінгу й дозаповнення.
create or replace function public.default_subcategories()
returns table (parent text, child text, ord int)
language sql immutable
as $$
  values
    ('прибирання','пральне',1), ('прибирання','посуд',2), ('прибирання','чистячі',3),
    ('прибирання','папір',4),   ('прибирання','пакети',5), ('прибирання','губки',6),

    ('тіло','шампунь',1),       ('тіло','бальзам',2),      ('тіло','гель для душу',3),
    ('тіло','мило',4),          ('тіло','дезодорант',5),   ('тіло','крем для тіла',6),
    ('тіло','зубна паста',7),   ('тіло','бритви',8),

    ('обличчя','очищення',1),   ('обличчя','тонік',2),     ('обличчя','сироватка',3),
    ('обличчя','крем для обличчя',4), ('обличчя','маска',5), ('обличчя','сонцезахист',6),

    ('ліки','знеболювальні',1), ('ліки','застуда',2),      ('ліки','шлунок',3),
    ('ліки','вітаміни',4),      ('ліки','антисептики',5),  ('ліки','пластирі',6);
$$;

-- 4. Дозаповнення для акаунтів, які вже існують: у них є корені, але дітей немає.
do $$
declare
  r record;
  v_parent uuid;
begin
  for r in
    select c.user_id, d.parent, d.child, d.ord
      from public.default_subcategories() d
      join public.categories c
        on c.name = d.parent and c.parent_id is null
  loop
    select id into v_parent from public.categories
     where user_id = r.user_id and name = r.parent and parent_id is null;

    insert into public.categories (user_id, name, sort_order, parent_id)
    values (r.user_id, r.child, r.ord, v_parent)
    on conflict do nothing;
  end loop;
end $$;
