create or replace function public.delete_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues%rowtype;
begin
  select * into v_league from public.leagues where id = p_league_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;

  if v_league.owner_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the league owner can delete the league.';
  end if;

  delete from public.leagues where id = p_league_id;
end;
$$;

revoke all on function public.delete_league(uuid) from public, anon;
grant execute on function public.delete_league(uuid) to authenticated;
