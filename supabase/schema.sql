-- Chạy trong Supabase → SQL Editor. Tạo bảng lịch sử nhận diện, mỗi người chỉ thấy dữ liệu của mình.

create table if not exists public.detections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  source      text,            -- file | video | mic | live
  file_name   text,
  group_id    text,            -- id nhóm âm thanh (dog, siren...)
  label       text,            -- tên tiếng Việt
  confidence  real,
  level_db    real,
  peak_db     real,
  duration    real,
  transcript  text,
  favorite    boolean not null default false,
  extra       jsonb not null default '{}'::jsonb
);

create index if not exists detections_user_time on public.detections (user_id, created_at desc);

alter table public.detections enable row level security;

drop policy if exists "đọc dữ liệu của mình" on public.detections;
drop policy if exists "thêm dữ liệu của mình" on public.detections;
drop policy if exists "sửa dữ liệu của mình" on public.detections;
drop policy if exists "xóa dữ liệu của mình" on public.detections;

create policy "đọc dữ liệu của mình"  on public.detections for select using (auth.uid() = user_id);
create policy "thêm dữ liệu của mình" on public.detections for insert with check (auth.uid() = user_id);
create policy "sửa dữ liệu của mình"  on public.detections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "xóa dữ liệu của mình"  on public.detections for delete using (auth.uid() = user_id);
