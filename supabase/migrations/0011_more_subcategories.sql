-- Набір розширено за реальним асортиментом: чотири засоби від комах,
-- дві автозасмаги, освіжувач, ватні палички, зняття лаку, лампочка
-- і картридж для фільтра не мали куди лягти.
create or replace function public.default_subcategories()
returns table (parent text, child text, ord int)
language sql immutable
as $$
  values
    ('прибирання','пральне',1), ('прибирання','посуд',2), ('прибирання','чистячі',3),
    ('прибирання','папір',4),   ('прибирання','пакети',5), ('прибирання','губки',6),
    ('прибирання','від комах',7), ('прибирання','освіжувачі',8),

    ('тіло','шампунь',1),       ('тіло','бальзам',2),      ('тіло','гель для душу',3),
    ('тіло','мило',4),          ('тіло','дезодорант',5),   ('тіло','крем для тіла',6),
    ('тіло','бритви',7),        ('тіло','засмага',8),      ('тіло','сонцезахист',9),
    ('тіло','манікюр',10),      ('тіло','гігієна',11),     ('тіло','олії',12),

    ('обличчя','очищення',1),   ('обличчя','тонік',2),     ('обличчя','сироватка',3),
    ('обличчя','крем для обличчя',4), ('обличчя','маска',5), ('обличчя','сонцезахист',6),
    ('обличчя','зубна паста',7), ('обличчя','зубна щітка',8), ('обличчя','брови і вії',9),

    ('ліки','знеболювальні',1), ('ліки','застуда',2),      ('ліки','шлунок',3),
    ('ліки','вітаміни',4),      ('ліки','антисептики',5),  ('ліки','пластирі',6),

    ('побут','лампочки',1),     ('побут','батарейки',2),   ('побут','фільтри',3);
$$;

-- Нова головна категорія для побутових витратних матеріалів.
-- null тут треба привести до uuid явно: у списку select Postgres
-- вважає нетипізований null текстом і відмовляється його вставляти.
insert into public.categories (user_id, name, sort_order, parent_id)
select distinct user_id, 'побут', 5, null::uuid from public.categories
on conflict do nothing;

-- Дозаповнення всіх бракуючих підкатегорій наявним акаунтам
do $$
declare
  r record;
  v_parent uuid;
begin
  for r in
    select distinct c.user_id, d.parent, d.child, d.ord
      from public.default_subcategories() d
      join public.categories c
        on c.name = d.parent and c.parent_id is null
  loop
    select id into v_parent from public.categories
     where user_id = r.user_id and name = r.parent and parent_id is null;
    if v_parent is null then continue; end if;

    insert into public.categories (user_id, name, sort_order, parent_id)
    values (r.user_id, r.child, r.ord, v_parent)
    on conflict do nothing;
  end loop;

  -- Власні категорії користувача теж потребують місця для товарів.
  for r in select id, user_id from public.categories
            where name = 'Персик' and parent_id is null
  loop
    insert into public.categories (user_id, name, sort_order, parent_id)
    values (r.user_id, 'догляд', 1, r.id), (r.user_id, 'корм', 2, r.id)
    on conflict do nothing;
  end loop;
end $$;
