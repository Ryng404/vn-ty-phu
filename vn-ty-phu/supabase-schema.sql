-- Cờ Tỷ Phú Việt Nam — schema Supabase
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'waiting',        -- waiting | playing | finished
  host_session text not null,
  state jsonb not null default '{}'::jsonb,       -- toàn bộ trạng thái ván chơi
  created_at timestamptz not null default now()
);

-- Tự dọn phòng cũ (không bắt buộc, có thể bỏ qua)
create index if not exists rooms_code_idx on public.rooms (code);

alter table public.rooms enable row level security;

-- Đây là game chơi cùng bạn bè, không cần tài khoản đăng nhập (auth ẩn danh):
-- mọi người có mã phòng đều đọc/ghi được trạng thái phòng đó.
-- KHÔNG dùng schema này cho game có tiền thật hoặc dữ liệu nhạy cảm.
drop policy if exists "Ai cũng đọc được phòng" on public.rooms;
create policy "Ai cũng đọc được phòng"
  on public.rooms for select
  using (true);

drop policy if exists "Ai cũng tạo được phòng" on public.rooms;
create policy "Ai cũng tạo được phòng"
  on public.rooms for insert
  with check (true);

drop policy if exists "Ai cũng cập nhật được phòng" on public.rooms;
create policy "Ai cũng cập nhật được phòng"
  on public.rooms for update
  using (true)
  with check (true);

-- Bật Realtime cho bảng rooms để các trình duyệt đồng bộ trạng thái tức thời
alter publication supabase_realtime add table public.rooms;
