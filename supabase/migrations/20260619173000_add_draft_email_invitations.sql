create table public.draft_invitations (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  email text not null check (
    email = lower(trim(email))
    and char_length(email) between 3 and 320
  ),
  invited_by_user_id uuid not null references auth.users(id),
  participant_id uuid references public.draft_participants(id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'accepted')
  ),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (draft_id, email)
);

create index draft_invitations_draft_id_idx
  on public.draft_invitations (draft_id);

alter table public.draft_invitations enable row level security;

create or replace function public.is_draft_commissioner(target_draft_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.drafts
    where id = target_draft_id
      and commissioner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_draft_commissioner(uuid) from public;
grant execute on function public.is_draft_commissioner(uuid) to authenticated;

create policy "Commissioners can view draft invitations"
on public.draft_invitations
for select
to authenticated
using (public.is_draft_commissioner(draft_id));

revoke all on public.draft_invitations from anon, authenticated;
grant select on public.draft_invitations to authenticated;

create or replace function public.accept_matching_draft_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if v_email is not null then
    update public.draft_invitations
    set
      participant_id = new.id,
      status = 'accepted',
      accepted_at = now()
    where draft_id = new.draft_id
      and email = v_email;
  end if;

  return new;
end;
$$;

revoke all on function public.accept_matching_draft_invitation() from public;

create trigger draft_participants_accept_invitation
after insert or update of display_name on public.draft_participants
for each row execute function public.accept_matching_draft_invitation();

alter table public.draft_invitations replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime
      add table public.draft_invitations;
  end if;
end;
$$;
