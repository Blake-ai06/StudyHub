-- Classroom: classes, enrollments, announcements, materials, assignments, submissions,
-- quizzes (with a teacher-only answer key and server-side grading), storage buckets.
-- Run after 0002.

-- ---------- helpers ----------
create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'));
$$;

-- ---------- tables ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  section text check (section is null or char_length(section) <= 50),
  description text check (description is null or char_length(description) <= 500),
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  join_enabled boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists classes_teacher_idx on public.classes (teacher_id);

create table if not exists public.enrollments (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists enrollments_user_idx on public.enrollments (user_id);

create table if not exists public.join_attempts (
  id bigserial primary key,
  user_id uuid not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists join_attempts_idx on public.join_attempts (user_id, created_at);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists announcements_class_idx on public.announcements (class_id, created_at desc);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 1000),
  file_path text,
  file_name text,
  file_type text,
  file_size integer check (file_size is null or file_size <= 20971520),
  created_at timestamptz not null default now()
);
create index if not exists materials_class_idx on public.materials (class_id, created_at desc);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  due_at timestamptz,
  points integer not null default 100 check (points between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists assignments_class_idx on public.assignments (class_id, due_at);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  body text check (body is null or char_length(body) <= 10000),
  file_path text,
  file_name text,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  grade numeric(6, 2) check (grade is null or grade >= 0),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  graded_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists submissions_student_idx on public.submissions (student_id);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 1000),
  due_at timestamptz,
  time_limit_min integer check (time_limit_min is null or time_limit_min between 1 and 300),
  allow_offline boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists quizzes_class_idx on public.quizzes (class_id, created_at desc);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 1000),
  points integer not null default 1 check (points between 1 and 100),
  position integer not null default 0
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 300),
  position integer not null default 0
);
create index if not exists quiz_options_q_idx on public.quiz_options (question_id, position);

-- The answer key is a separate table so students can never read it.
create table if not exists public.quiz_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  option_id uuid not null references public.quiz_options (id) on delete cascade
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  score numeric(7, 2),
  max_score numeric(7, 2),
  unique (quiz_id, student_id)
);
create table if not exists public.quiz_answers (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  option_id uuid not null references public.quiz_options (id) on delete cascade,
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);

-- ---------- helper functions used by policies (security definer avoids RLS recursion) ----------
create or replace function public.is_class_teacher(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and teacher_id = auth.uid()) or public.is_admin();
$$;
create or replace function public.is_enrolled(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where class_id = cid and user_id = auth.uid());
$$;
create or replace function public.is_class_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_class_teacher(cid) or public.is_enrolled(cid);
$$;
create or replace function public.assignment_class(aid uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from public.assignments where id = aid; $$;
create or replace function public.quiz_class(qid uuid) returns uuid
language sql stable security definer set search_path = public as $$ select class_id from public.quizzes where id = qid; $$;
create or replace function public.question_class(qid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select z.class_id from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id where q.id = qid;
$$;
create or replace function public.quiz_is_published(qid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select published from public.quizzes where id = qid), false); $$;
create or replace function public.question_quiz_published(qid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select z.published from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id where q.id = qid), false);
$$;
create or replace function public.uuid_or_null(t text) returns uuid
language sql immutable as $$ select case when t ~ '^[0-9a-fA-F-]{36}$' then t::uuid end; $$;

-- ---------- row level security ----------
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.join_attempts enable row level security;
alter table public.announcements enable row level security;
alter table public.materials enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

drop policy if exists "classes: read mine" on public.classes;
create policy "classes: read mine" on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_enrolled(id) or public.is_admin());
drop policy if exists "classes: teachers create their own" on public.classes;
create policy "classes: teachers create their own" on public.classes for insert to authenticated
  with check (teacher_id = auth.uid() and public.is_teacher());
drop policy if exists "classes: owner updates" on public.classes;
create policy "classes: owner updates" on public.classes for update to authenticated
  using (teacher_id = auth.uid() or public.is_admin()) with check (teacher_id = auth.uid() or public.is_admin());
drop policy if exists "classes: owner deletes" on public.classes;
create policy "classes: owner deletes" on public.classes for delete to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "enrollments: members read roster" on public.enrollments;
create policy "enrollments: members read roster" on public.enrollments for select to authenticated
  using (public.is_class_member(class_id));
drop policy if exists "enrollments: teacher removes, student leaves" on public.enrollments;
create policy "enrollments: teacher removes, student leaves" on public.enrollments for delete to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));
-- No insert policy: students join only through join_class().

drop policy if exists "announcements: members read" on public.announcements;
create policy "announcements: members read" on public.announcements for select to authenticated using (public.is_class_member(class_id));
drop policy if exists "announcements: teacher writes" on public.announcements;
create policy "announcements: teacher writes" on public.announcements for insert to authenticated
  with check (author_id = auth.uid() and public.is_class_teacher(class_id));
drop policy if exists "announcements: teacher deletes" on public.announcements;
create policy "announcements: teacher deletes" on public.announcements for delete to authenticated using (public.is_class_teacher(class_id));

drop policy if exists "materials: members read" on public.materials;
create policy "materials: members read" on public.materials for select to authenticated using (public.is_class_member(class_id));
drop policy if exists "materials: teacher adds" on public.materials;
create policy "materials: teacher adds" on public.materials for insert to authenticated
  with check (created_by = auth.uid() and public.is_class_teacher(class_id));
drop policy if exists "materials: teacher deletes" on public.materials;
create policy "materials: teacher deletes" on public.materials for delete to authenticated using (public.is_class_teacher(class_id));

drop policy if exists "assignments: members read" on public.assignments;
create policy "assignments: members read" on public.assignments for select to authenticated using (public.is_class_member(class_id));
drop policy if exists "assignments: teacher creates" on public.assignments;
create policy "assignments: teacher creates" on public.assignments for insert to authenticated
  with check (created_by = auth.uid() and public.is_class_teacher(class_id));
drop policy if exists "assignments: teacher edits" on public.assignments;
create policy "assignments: teacher edits" on public.assignments for update to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
drop policy if exists "assignments: teacher deletes" on public.assignments;
create policy "assignments: teacher deletes" on public.assignments for delete to authenticated using (public.is_class_teacher(class_id));

drop policy if exists "submissions: owner or class teacher reads" on public.submissions;
create policy "submissions: owner or class teacher reads" on public.submissions for select to authenticated
  using (student_id = auth.uid() or public.is_class_teacher(public.assignment_class(assignment_id)));
drop policy if exists "submissions: enrolled student creates own" on public.submissions;
create policy "submissions: enrolled student creates own" on public.submissions for insert to authenticated
  with check (student_id = auth.uid() and public.is_enrolled(public.assignment_class(assignment_id)));
drop policy if exists "submissions: student edits ungraded own, teacher grades" on public.submissions;
create policy "submissions: student edits ungraded own, teacher grades" on public.submissions for update to authenticated
  using ((student_id = auth.uid() and grade is null) or public.is_class_teacher(public.assignment_class(assignment_id)))
  with check (student_id = auth.uid() or public.is_class_teacher(public.assignment_class(assignment_id)));

drop policy if exists "quizzes: teacher all, members see published" on public.quizzes;
create policy "quizzes: teacher all, members see published" on public.quizzes for select to authenticated
  using (public.is_class_teacher(class_id) or (published and public.is_enrolled(class_id)));
drop policy if exists "quizzes: teacher creates" on public.quizzes;
create policy "quizzes: teacher creates" on public.quizzes for insert to authenticated
  with check (created_by = auth.uid() and public.is_class_teacher(class_id));
drop policy if exists "quizzes: teacher edits" on public.quizzes;
create policy "quizzes: teacher edits" on public.quizzes for update to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
drop policy if exists "quizzes: teacher deletes" on public.quizzes;
create policy "quizzes: teacher deletes" on public.quizzes for delete to authenticated using (public.is_class_teacher(class_id));

drop policy if exists "questions: read" on public.quiz_questions;
create policy "questions: read" on public.quiz_questions for select to authenticated
  using (public.is_class_teacher(public.quiz_class(quiz_id)) or (public.quiz_is_published(quiz_id) and public.is_enrolled(public.quiz_class(quiz_id))));
drop policy if exists "questions: teacher writes" on public.quiz_questions;
create policy "questions: teacher writes" on public.quiz_questions for insert to authenticated with check (public.is_class_teacher(public.quiz_class(quiz_id)));
drop policy if exists "questions: teacher edits" on public.quiz_questions;
create policy "questions: teacher edits" on public.quiz_questions for update to authenticated
  using (public.is_class_teacher(public.quiz_class(quiz_id))) with check (public.is_class_teacher(public.quiz_class(quiz_id)));
drop policy if exists "questions: teacher deletes" on public.quiz_questions;
create policy "questions: teacher deletes" on public.quiz_questions for delete to authenticated using (public.is_class_teacher(public.quiz_class(quiz_id)));

drop policy if exists "options: read" on public.quiz_options;
create policy "options: read" on public.quiz_options for select to authenticated
  using (public.is_class_teacher(public.question_class(question_id))
         or (public.is_enrolled(public.question_class(question_id)) and public.question_quiz_published(question_id)));
drop policy if exists "options: teacher writes" on public.quiz_options;
create policy "options: teacher writes" on public.quiz_options for insert to authenticated with check (public.is_class_teacher(public.question_class(question_id)));
drop policy if exists "options: teacher deletes" on public.quiz_options;
create policy "options: teacher deletes" on public.quiz_options for delete to authenticated using (public.is_class_teacher(public.question_class(question_id)));

drop policy if exists "keys: teacher only read" on public.quiz_keys;
create policy "keys: teacher only read" on public.quiz_keys for select to authenticated using (public.is_class_teacher(public.question_class(question_id)));
drop policy if exists "keys: teacher only write" on public.quiz_keys;
create policy "keys: teacher only write" on public.quiz_keys for insert to authenticated with check (public.is_class_teacher(public.question_class(question_id)));
drop policy if exists "keys: teacher only delete" on public.quiz_keys;
create policy "keys: teacher only delete" on public.quiz_keys for delete to authenticated using (public.is_class_teacher(public.question_class(question_id)));

drop policy if exists "attempts: own or class teacher read" on public.quiz_attempts;
create policy "attempts: own or class teacher read" on public.quiz_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_class_teacher(public.quiz_class(quiz_id)));
-- No insert/update policy: attempts are created and scored only by submit_quiz().
drop policy if exists "answers: own or class teacher read" on public.quiz_answers;
create policy "answers: own or class teacher read" on public.quiz_answers for select to authenticated
  using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and (a.student_id = auth.uid() or public.is_class_teacher(public.quiz_class(a.quiz_id)))));

-- ---------- triggers ----------
create or replace function public.guard_submission() returns trigger language plpgsql security definer set search_path = public as $$
declare teacher boolean := public.is_class_teacher(public.assignment_class(new.assignment_id));
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    -- students can never create a pre-graded submission
    if not teacher then new.grade := null; new.feedback := null; new.graded_at := null; end if;
    if new.status = 'submitted' then new.submitted_at := now(); end if;
    return new;
  end if;
  new.id := old.id;
  new.assignment_id := old.assignment_id;
  new.student_id := old.student_id;
  if teacher and auth.uid() is distinct from old.student_id then
    -- teachers change only grade/feedback
    new.body := old.body; new.file_path := old.file_path; new.file_name := old.file_name;
    new.status := old.status; new.submitted_at := old.submitted_at;
    if new.grade is not null and new.grade > (select points from public.assignments where id = new.assignment_id) then
      raise exception 'Grade cannot exceed the assignment points';
    end if;
    if new.grade is distinct from old.grade or new.feedback is distinct from old.feedback then new.graded_at := now(); end if;
  else
    -- students can never touch grade fields
    new.grade := old.grade; new.feedback := old.feedback; new.graded_at := old.graded_at;
    if new.status = 'submitted' and old.status <> 'submitted' then new.submitted_at := now();
    else new.submitted_at := old.submitted_at; end if;
    if old.status = 'submitted' and new.status = 'draft' then new.status := 'submitted'; end if;
  end if;
  return new;
end $$;
drop trigger if exists submissions_guard on public.submissions;
create trigger submissions_guard before insert or update on public.submissions
  for each row execute function public.guard_submission();

-- ---------- functions ----------
create or replace function public.join_class(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c record;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if (select count(*) from public.join_attempts where user_id = me and not ok and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Too many wrong codes. Try again in a few minutes.';
  end if;
  select id, teacher_id, join_enabled into c from public.classes where join_code = upper(btrim(p_code)) and not archived;
  if not found or not c.join_enabled then
    insert into public.join_attempts (user_id, ok) values (me, false);
    return null; -- returns null (not an error) so the failed attempt is still recorded
  end if;
  insert into public.join_attempts (user_id, ok) values (me, true);
  if c.teacher_id <> me then
    insert into public.enrollments (class_id, user_id) values (c.id, me) on conflict do nothing;
  end if;
  return c.id;
end $$;

create or replace function public.regenerate_join_code(cid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  if not public.is_class_teacher(cid) then raise exception 'Not allowed'; end if;
  update public.classes set join_code = code where id = cid;
  return code;
end $$;

create or replace function public.submit_quiz(p_attempt_id uuid, p_quiz_id uuid, p_answers jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); q record; ex record; r record;
  v_score numeric := 0; v_max numeric := 0; chosen uuid; ok boolean;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if not found or not q.published then raise exception 'Quiz not available'; end if;
  if not public.is_enrolled(q.class_id) then raise exception 'You are not enrolled in this class'; end if;
  select * into ex from public.quiz_attempts where quiz_id = p_quiz_id and student_id = me;
  if found then return json_build_object('score', ex.score, 'max_score', ex.max_score, 'already', true); end if;
  if q.due_at is not null and now() > q.due_at + interval '5 minutes' then raise exception 'This quiz is past its deadline'; end if;
  insert into public.quiz_attempts (id, quiz_id, student_id) values (p_attempt_id, p_quiz_id, me);
  for r in select qq.id, qq.points, k.option_id as key_id from public.quiz_questions qq
           left join public.quiz_keys k on k.question_id = qq.id where qq.quiz_id = p_quiz_id loop
    v_max := v_max + r.points;
    chosen := public.uuid_or_null(p_answers ->> r.id::text);
    if chosen is not null and not exists (select 1 from public.quiz_options o where o.id = chosen and o.question_id = r.id) then chosen := null; end if;
    ok := chosen is not null and chosen = r.key_id;
    if ok then v_score := v_score + r.points; end if;
    if chosen is not null then
      insert into public.quiz_answers (attempt_id, question_id, option_id, is_correct) values (p_attempt_id, r.id, chosen, ok);
    end if;
  end loop;
  update public.quiz_attempts set score = v_score, max_score = v_max where id = p_attempt_id;
  return json_build_object('score', v_score, 'max_score', v_max, 'already', false);
end $$;

revoke all on function public.join_class(text), public.regenerate_join_code(uuid), public.submit_quiz(uuid, uuid, jsonb) from public, anon;
grant execute on function public.join_class(text), public.regenerate_join_code(uuid), public.submit_quiz(uuid, uuid, jsonb) to authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('class-files', 'class-files', false, 20971520, array[
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','image/jpeg','image/png','image/webp','application/zip']),
  ('submission-files', 'submission-files', false, 10485760, array[
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','image/jpeg','image/png','application/zip'])
on conflict (id) do nothing;

-- class-files: path = <class_id>/<file>
drop policy if exists "class files: members read" on storage.objects;
create policy "class files: members read" on storage.objects for select to authenticated
  using (bucket_id = 'class-files' and public.is_class_member(public.uuid_or_null((storage.foldername(name))[1])));
drop policy if exists "class files: teacher uploads" on storage.objects;
create policy "class files: teacher uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'class-files' and public.is_class_teacher(public.uuid_or_null((storage.foldername(name))[1])));
drop policy if exists "class files: teacher deletes" on storage.objects;
create policy "class files: teacher deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'class-files' and public.is_class_teacher(public.uuid_or_null((storage.foldername(name))[1])));

-- submission-files: path = <assignment_id>/<student_id>/<file>
drop policy if exists "submission files: owner or teacher reads" on storage.objects;
create policy "submission files: owner or teacher reads" on storage.objects for select to authenticated
  using (bucket_id = 'submission-files' and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.is_class_teacher(public.assignment_class(public.uuid_or_null((storage.foldername(name))[1])))));
drop policy if exists "submission files: enrolled student uploads own" on storage.objects;
create policy "submission files: enrolled student uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-files' and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_enrolled(public.assignment_class(public.uuid_or_null((storage.foldername(name))[1]))));
drop policy if exists "submission files: owner replaces" on storage.objects;
create policy "submission files: owner replaces" on storage.objects for update to authenticated
  using (bucket_id = 'submission-files' and (storage.foldername(name))[2] = auth.uid()::text);
