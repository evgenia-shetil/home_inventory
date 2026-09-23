-- Бакет photos створюється в панелі Supabase (Storage -> New bucket),
-- обов'язково приватним: Public bucket вимкнено.

-- Шлях до файлу має вигляд {user_id}/{item_id}.jpg,
-- тож перший сегмент шляху і є ознакою власника.
create policy photos_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy photos_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
