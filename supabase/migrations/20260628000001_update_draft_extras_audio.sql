create or replace function public.update_draft_extras(
  p_draft_id          uuid,
  p_scoring_type      text        default null,
  p_use_landmines     boolean     default null,
  p_landmine_count    integer     default null,
  p_hide_rankings     boolean     default null,
  p_scheduled_at      timestamptz default null,
  p_scheduled_tz      text        default null,
  p_roster_positions  jsonb       default null,
  p_rounds            integer     default null,
  p_name              text        default null,
  p_team_count        integer     default null,
  p_sfx_1_url         text        default null,
  p_sfx_2_url         text        default null,
  p_pos_reactions     text[]      default null,
  p_neg_reactions     text[]      default null
)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;
  if v_draft.commissioner_user_id <> auth.uid() then
    raise exception 'Only the commissioner can update draft settings.' using errcode = '42501';
  end if;

  if p_rounds is not null and (p_rounds < 1 or p_rounds > 50) then
    raise exception 'Rounds must be between 1 and 50.';
  end if;
  if p_team_count is not null and (p_team_count < 2 or p_team_count > 32) then
    raise exception 'Team count must be between 2 and 32.';
  end if;

  update public.drafts set
    scoring_type         = coalesce(p_scoring_type,       scoring_type),
    use_landmines        = coalesce(p_use_landmines,      use_landmines),
    landmine_count       = coalesce(p_landmine_count,     landmine_count),
    hide_player_rankings = coalesce(p_hide_rankings,      hide_player_rankings),
    scheduled_at         = case when p_scheduled_at is not null or p_scheduled_tz is not null
                                then p_scheduled_at else scheduled_at end,
    scheduled_timezone   = coalesce(p_scheduled_tz,       scheduled_timezone),
    roster_positions     = coalesce(p_roster_positions,   roster_positions),
    rounds               = coalesce(p_rounds,             rounds),
    name                 = coalesce(p_name,               name),
    team_count           = coalesce(p_team_count,         team_count),
    sfx_1_url            = coalesce(p_sfx_1_url,          sfx_1_url),
    sfx_2_url            = coalesce(p_sfx_2_url,          sfx_2_url),
    pos_reactions        = coalesce(p_pos_reactions,      pos_reactions),
    neg_reactions        = coalesce(p_neg_reactions,      neg_reactions),
    updated_at           = now()
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

revoke all on function public.update_draft_extras(uuid, text, boolean, integer, boolean, timestamptz, text, jsonb, integer, text, integer, text, text, text[], text[]) from public, anon;
grant execute on function public.update_draft_extras(uuid, text, boolean, integer, boolean, timestamptz, text, jsonb, integer, text, integer, text, text, text[], text[]) to authenticated;
