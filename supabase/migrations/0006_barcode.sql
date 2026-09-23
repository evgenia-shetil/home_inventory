alter table public.items add column barcode text;

-- Один штрихкод — один товар у межах користувача. Частковий індекс,
-- бо товарів без штрихкоду може бути скільки завгодно.
create unique index items_barcode_uniq
  on public.items (user_id, barcode)
  where barcode is not null;

-- UPDATE на items виданий постовпцево (0002_rls.sql), тому новий стовпець
-- треба дозволити явно — інакше прив'язати штрихкод до наявного товару
-- буде неможливо.
grant update (barcode) on public.items to authenticated;
