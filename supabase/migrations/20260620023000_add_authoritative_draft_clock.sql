create or replace function public.get_draft_server_time(p_draft_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_view_draft(p_draft_id) then
    raise exception using
      errcode = '42501',
      message = 'Draft access is required to read its clock.';
  end if;

  return clock_timestamp();
end;
$$;

revoke all on function public.get_draft_server_time(uuid)
  from public, anon;

grant execute on function public.get_draft_server_time(uuid)
  to authenticated;
