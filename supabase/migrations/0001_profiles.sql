-- Profiles and roles. Run in the Supabase SQL Editor (after 0000).
do $$ begin
  create type public.user_role as enum ('student', 'teacher', 'admin');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  role public.user_role not null default 'student',
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
drop policy if exists "users update own profile, admins any" on public.profiles;
create policy "users update own profile, admins any" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- No insert policy (rows are created by the trigger below) and no delete policy.

-- Only an admin (or the dashboard/SQL editor, where auth.uid() is null) can change a role.
create or replace function public.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can change roles';
  end if;
  new.id := old.id;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Every new auth user becomes a STUDENT. The client can never choose its own role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))), '[^a-z0-9_]', '', 'g');
  candidate text;
begin
  if char_length(base) < 3 then base := 'user' || substr(md5(new.id::text), 1, 6); end if;
  candidate := left(base, 20);
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := left(base, 14) || '_' || substr(md5(random()::text), 1, 5);
  end loop;
  insert into public.profiles (id, username, full_name)
  values (new.id, candidate, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'New student'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- To make someone a teacher/admin (run in the SQL Editor):
--   update public.profiles set role = 'teacher' where username = 'their_username';
