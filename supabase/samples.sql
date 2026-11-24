-- Kho mẫu âm thanh chung của nhóm (trang "Âm thanh của tôi" → nút "Gửi lên kho chung").
-- Chạy MỘT lần trong Supabase → SQL Editor. Người đã đăng nhập chỉ được tải lên thư mục của chính mình
-- (samples/<user_id>/<nhãn>/<file>.wav); nhóm xem/tải toàn bộ trong Supabase → Storage → samples.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('samples', 'samples', false, 20971520, array['audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

drop policy if exists "tải mẫu lên thư mục của mình" on storage.objects;
drop policy if exists "xem mẫu của mình" on storage.objects;
drop policy if exists "ghi đè mẫu của mình" on storage.objects;

create policy "tải mẫu lên thư mục của mình" on storage.objects for insert to authenticated
  with check (bucket_id = 'samples' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "xem mẫu của mình" on storage.objects for select to authenticated
  using (bucket_id = 'samples' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ghi đè mẫu của mình" on storage.objects for update to authenticated
  using (bucket_id = 'samples' and (storage.foldername(name))[1] = auth.uid()::text);
