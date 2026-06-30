-- Replaces 20260629000005 with draft commissioner_user_id update included
create or replace function public.transfer_league_ownership(
  p_league_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_new_owner_member public.league_members%rowtype;
begin
  if v_caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  select * into v_league from public.leagues where id = p_league_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;

  if v_league.owner_user_id <> v_caller_id then
    raise exception using errcode = '42501', message = 'Only the league owner can transfer ownership.';
  end if;

  if p_new_owner_user_id = v_caller_id then
    raise exception using errcode = '22023', message = 'You are already the owner.';
  end if;

  select * into v_new_owner_member
  from public.league_members
  where league_id = p_league_id and user_id = p_new_owner_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'That user is not a member of this league.';
  end if;

  -- Transfer league ownership
  update public.leagues set owner_user_id = p_new_owner_user_id where id = p_league_id;

  -- Promote new owner to commissioner role in league_members
  update public.league_members
  set role = 'commissioner'
  where league_id = p_league_id and user_id = p_new_owner_user_id;

  -- Demote old owner to co-commissioner so they retain access
  update public.league_members
  set role = 'co-commissioner'
  where league_id = p_league_id and user_id = v_caller_id;

  -- Transfer commissioner_user_id on all drafts linked to this league
  -- (covers both direct league drafts and season drafts)
  update public.drafts
  set commissioner_user_id = p_new_owner_user_id
  where commissioner_user_id = v_caller_id
    and (
      league_id = p_league_id
      or id in (
        select ls.draft_id
        from public.league_seasons ls
        where ls.league_id = p_league_id
          and ls.draft_id is not null
      )
    );
end;
$$;

revoke all on function public.transfer_league_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_league_ownership(uuid, uuid) to authenticated;
