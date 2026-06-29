-- Allow co-commissioner as a valid member role
alter table public.league_members
  drop constraint if exists league_members_role_check;

alter table public.league_members
  add constraint league_members_role_check
    check (role in ('commissioner', 'co-commissioner', 'member'));

-- RPC: only the league owner can promote/demote members to/from co-commissioner
create or replace function public.set_league_member_role(
  p_league_id  uuid,
  p_member_id  uuid,
  p_role       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_owner_id uuid;
  v_target_user_id  uuid;
begin
  if p_role not in ('co-commissioner', 'member') then
    raise exception using errcode = '22023', message = 'Role must be co-commissioner or member.';
  end if;

  select owner_user_id into v_league_owner_id
    from public.leagues where id = p_league_id;

  if v_league_owner_id is null then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;

  -- Only the league owner (main commissioner) can assign roles
  if auth.uid() <> v_league_owner_id then
    raise exception using errcode = '42501', message = 'Only the league commissioner can assign roles.';
  end if;

  -- Get the target member's user_id so we can protect the owner
  select user_id into v_target_user_id
    from public.league_members where id = p_member_id and league_id = p_league_id;

  if v_target_user_id is null then
    raise exception using errcode = 'P0002', message = 'Member not found.';
  end if;

  -- Prevent changing the league owner's role
  if v_target_user_id = v_league_owner_id then
    raise exception using errcode = '42501', message = 'Cannot change the league commissioner''s role.';
  end if;

  update public.league_members
    set role = p_role
    where id = p_member_id and league_id = p_league_id;
end;
$$;

revoke all on function public.set_league_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_league_member_role(uuid, uuid, text) to authenticated;
