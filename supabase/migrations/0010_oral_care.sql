-- Догляд за ротом належить до «обличчя», а не до «тіла»,
-- і «зубної щітки» бракувало зовсім.
create or replace function public.default_subcategories()
returns table (parent text, child text, ord int)
language sql immutable
as $$
  values
    ('прибирання','пральне',1), ('прибирання','посуд',2), ('прибирання','чистячі',3),
    ('прибирання','папір',4),   ('прибирання','пакети',5), ('прибирання','губки',6),

    ('тіло','шампунь',1),       ('тіло','бальзам',2),      ('тіло','гель для душу',3),
    ('тіло','мило',4),          ('тіло','дезодорант',5),   ('тіло','крем для тіла',6),
    ('тіло','бритви',7),

    ('обличчя','очищення',1),   ('обличчя','тонік',2),     ('обличчя','сироватка',3),
    ('обличчя','крем для обличчя',4), ('обличчя','маска',5), ('обличчя','сонцезахист',6),
    ('обличчя','зубна паста',7), ('обличчя','зубна щітка',8),

    ('ліки','знеболювальні',1), ('ліки','застуда',2),      ('ліки','шлунок',3),
    ('ліки','вітаміни',4),      ('ліки','антисептики',5),  ('ліки','пластирі',6);
$$;

-- Переносимо наявну «зубну пасту» під «обличчя» разом з її товарами
-- і дозаповнюємо «зубну щітку» тим, у кого її ще немає.
do $$
declare
  r record;
  v_face uuid;
begin
  for r in select distinct user_id from public.categories loop
    select id into v_face from public.categories
     where user_id = r.user_id and name = 'обличчя' and parent_id is null;
    if v_face is null then continue; end if;

    update public.categories
       set parent_id = v_face, sort_order = 7
     where user_id = r.user_id and name = 'зубна паста' and parent_id is not null;

    insert into public.categories (user_id, name, sort_order, parent_id)
    values (r.user_id, 'зубна щітка', 8, v_face)
    on conflict do nothing;
  end loop;
end $$;
