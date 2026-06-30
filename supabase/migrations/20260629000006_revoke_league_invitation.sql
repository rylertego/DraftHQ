create or replace function public.revoke_league_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_invitation public.league_invitations%rowtype;
begin
  if v_caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  select * into v_invitation
  from public.league_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invitation not found.';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Invitation is no longer pending.';
  end if;

  if not public.is_league_commissioner(v_invitation.league_id) then
    raise exception using errcode = '42501', message = 'Only a commissioner can revoke invitations.';
  end if;

  update public.league_invitations
  set status = 'revoked', responded_at = now()
  where id = p_invitation_id;
end;
$$;

revoke all on function public.revoke_league_invitation(uuid) from public, anon;
grant execute on function public.revoke_league_invitation(uuid) to authenticated;
