-- Per-league profile fields on league_members
alter table public.league_members
  add column nickname text check (nickname is null or char_length(trim(nickname)) between 1 and 50),
  add column avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  add column bio text check (bio is null or char_length(bio) <= 280);

-- ── Avatars storage bucket ────────────────────────────────────────────────────
-- Paths:
--   global/{userId}/avatar.{ext}          — app-level profile avatar
--   leagues/{leagueId}/{userId}/avatar.{ext} — per-league member avatar
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg','image/png','image/gif','image/webp']
)
on conflict (id) do nothing;

create policy "Users can upload their global avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars' and
  (string_to_array(name, '/'))[1] = 'global' and
  (string_to_array(name, '/'))[2] = auth.uid()::text
);

create policy "Users can update their global avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars' and
  (string_to_array(name, '/'))[1] = 'global' and
  (string_to_array(name, '/'))[2] = auth.uid()::text
);

create policy "Users can delete their global avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars' and
  (string_to_array(name, '/'))[1] = 'global' and
  (string_to_array(name, '/'))[2] = auth.uid()::text
);

create policy "League members can upload their league avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars' and
  (string_to_array(name, '/'))[1] = 'leagues' and
  (string_to_array(name, '/'))[3] = auth.uid()::text and
  exists (
    select 1 from public.league_members
    where league_id = (string_to_array(name, '/'))[2]::uuid
      and user_id = auth.uid()
  )
);

create policy "League members can update their league avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars' and
  (string_to_array(name, '/'))[1] = 'leagues' and
  (string_to_array(name, '/'))[3] = auth.uid()::text and
  exists (
    select 1 from public.league_members
    where league_id = (string_to_array(name, '/'))[2]::uuid
      and user_id = auth.uid()
  )
);

create policy "League members can delete their league avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars' and
  (string_to_array(name, '/'))[1] = 'leagues' and
  (string_to_array(name, '/'))[3] = auth.uid()::text
);

create policy "Authenticated users can view all avatars"
on storage.objects for select to authenticated
using (bucket_id = 'avatars');

-- ── RPC: update own league member profile ────────────────────────────────────
create or replace function public.update_league_member_profile(
  p_league_id uuid,
  p_nickname  text,
  p_avatar_url text,
  p_bio       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  update public.league_members
  set
    nickname   = nullif(trim(coalesce(p_nickname, '')), ''),
    avatar_url = nullif(trim(coalesce(p_avatar_url, '')), ''),
    bio        = nullif(trim(coalesce(p_bio, '')), '')
  where league_id = p_league_id
    and user_id   = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'You are not a member of this league.';
  end if;
end;
$$;

revoke all on function public.update_league_member_profile(uuid, text, text, text)
  from public, anon;
grant execute on function public.update_league_member_profile(uuid, text, text, text)
  to authenticated;
