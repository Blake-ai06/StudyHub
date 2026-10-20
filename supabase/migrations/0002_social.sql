-- Social features: posts, comments, reactions, bookmarks, connections, notifications,
-- messaging, reports, and the post-images storage bucket. Run after 0001.

-- ---------- tables ----------
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists connections_pair_idx
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists connections_addressee_idx on public.connections (addressee_id, status);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  image_path text,
  visibility text not null default 'public' check (visibility in ('public', 'connections')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.bookmarks (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('comment', 'like', 'connection_request', 'connection_accepted')),
  post_id uuid references public.posts (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);
create index if not exists conv_members_user_idx on public.conversation_members (user_id);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);

-- ---------- helpers (defined after the tables they read) ----------
create or replace function public.are_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = a and c.addressee_id = b) or (c.requester_id = b and c.addressee_id = a))
  );
$$;

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = cid and user_id = auth.uid());
$$;

-- ---------- row level security ----------
alter table public.connections enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

-- posts
drop policy if exists "posts: read public, own, or connections" on public.posts;
create policy "posts: read public, own, or connections" on public.posts for select to authenticated
  using (visibility = 'public' or author_id = auth.uid() or public.are_connected(author_id, auth.uid()) or public.is_admin());
drop policy if exists "posts: insert own" on public.posts;
create policy "posts: insert own" on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "posts: update own" on public.posts;
create policy "posts: update own" on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "posts: delete own or admin" on public.posts;
create policy "posts: delete own or admin" on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- comments (visible only if the post is visible: the subquery runs under posts RLS)
drop policy if exists "comments: read if post visible" on public.comments;
create policy "comments: read if post visible" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "comments: insert own on visible post" on public.comments;
create policy "comments: insert own on visible post" on public.comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "comments: delete own or admin" on public.comments;
create policy "comments: delete own or admin" on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- reactions
drop policy if exists "reactions: read if post visible" on public.reactions;
create policy "reactions: read if post visible" on public.reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "reactions: add own on visible post" on public.reactions;
create policy "reactions: add own on visible post" on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "reactions: remove own" on public.reactions;
create policy "reactions: remove own" on public.reactions for delete to authenticated using (user_id = auth.uid());

-- bookmarks (private)
drop policy if exists "bookmarks: read own" on public.bookmarks;
create policy "bookmarks: read own" on public.bookmarks for select to authenticated using (user_id = auth.uid());
drop policy if exists "bookmarks: add own" on public.bookmarks;
create policy "bookmarks: add own" on public.bookmarks for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "bookmarks: remove own" on public.bookmarks;
create policy "bookmarks: remove own" on public.bookmarks for delete to authenticated using (user_id = auth.uid());

-- connections
drop policy if exists "connections: read mine" on public.connections;
create policy "connections: read mine" on public.connections for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "connections: request as myself" on public.connections;
create policy "connections: request as myself" on public.connections for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
drop policy if exists "connections: addressee accepts" on public.connections;
create policy "connections: addressee accepts" on public.connections for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
drop policy if exists "connections: either side removes" on public.connections;
create policy "connections: either side removes" on public.connections for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- notifications (created only by triggers)
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications: mark own read" on public.notifications;
create policy "notifications: mark own read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- messaging (conversations are created only through start_conversation)
drop policy if exists "conversations: members read" on public.conversations;
create policy "conversations: members read" on public.conversations for select to authenticated using (public.is_member(id));
drop policy if exists "members: read in my conversations" on public.conversation_members;
create policy "members: read in my conversations" on public.conversation_members for select to authenticated
  using (public.is_member(conversation_id));
drop policy if exists "messages: members read" on public.messages;
create policy "messages: members read" on public.messages for select to authenticated using (public.is_member(conversation_id));
drop policy if exists "messages: members send as self" on public.messages;
create policy "messages: members send as self" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));

-- reports
drop policy if exists "reports: file as myself" on public.reports;
create policy "reports: file as myself" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "reports: admins read" on public.reports;
create policy "reports: admins read" on public.reports for select to authenticated using (public.is_admin());

-- ---------- functions & triggers ----------
create or replace function public.start_conversation(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; me uuid := auth.uid();
begin
  if me is null or other is null or other = me then raise exception 'Invalid conversation'; end if;
  if not public.are_connected(me, other) then raise exception 'You can only message your connections'; end if;
  select a.conversation_id into cid
    from public.conversation_members a join public.conversation_members b on a.conversation_id = b.conversation_id
    where a.user_id = me and b.user_id = other limit 1;
  if cid is null then
    insert into public.conversations default values returning id into cid;
    insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, other);
  end if;
  return cid;
end $$;
revoke all on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

create or replace function public.touch_post() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.author_id := old.author_id; new.created_at := old.created_at; return new; end $$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts for each row execute function public.touch_post();

create or replace function public.notify_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select author_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, post_id) values (owner, new.author_id, 'comment', new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_comment();

create or replace function public.notify_reaction() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select author_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'like', new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists reactions_notify on public.reactions;
create trigger reactions_notify after insert on public.reactions for each row execute function public.notify_reaction();

create or replace function public.notify_connection() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, type) values (new.addressee_id, new.requester_id, 'connection_request');
  elsif new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, actor_id, type) values (new.requester_id, new.addressee_id, 'connection_accepted');
  end if;
  return new;
end $$;
drop trigger if exists connections_notify on public.connections;
create trigger connections_notify after insert or update on public.connections for each row execute function public.notify_connection();

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- ---------- storage: private bucket for post images ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
drop policy if exists "post images: upload to own folder" on storage.objects;
create policy "post images: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "post images: signed-in users read" on storage.objects;
create policy "post images: signed-in users read" on storage.objects for select to authenticated
  using (bucket_id = 'post-images');
drop policy if exists "post images: delete own" on storage.objects;
create policy "post images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
