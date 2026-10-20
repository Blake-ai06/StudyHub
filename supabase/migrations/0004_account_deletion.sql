-- Lets a signed-in user delete THEIR OWN account. Deleting the auth user cascades to the profile and to
-- everything that references it (posts, comments, messages, submissions, classes they teach, and so on).
-- The app removes the user's uploaded files from Storage first (SQL cannot delete the stored file bytes).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
