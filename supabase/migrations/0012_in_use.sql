-- Запас живе у двох місцях: у шафі й у користуванні. Це не статус речі,
-- а місце: «шампунь × 3» не має одного стану, якщо один відкритий,
-- а два стоять у шафі. Тому два лічильники на тому самому рядку.
alter table public.items
  add column in_use numeric not null default 0 check (in_use >= 0);

-- Операція тепер знає, якого саме лічильника стосується.
-- 'move' переносить одиницю з шафи в користування, не міняючи суми.
alter table public.events
  add column bucket text not null default 'stock'
  check (bucket in ('stock', 'in_use', 'move'));

-- Нове поле теж треба дозволити редагувати: UPDATE виданий постовпцево.
grant update (in_use) on public.items to authenticated;

alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check
  check (kind in ('consume', 'restock', 'correction', 'open'));
