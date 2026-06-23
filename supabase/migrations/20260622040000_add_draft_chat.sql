-- Draft chat messages
create table public.draft_messages (
  id             uuid primary key default gen_random_uuid(),
  draft_id       uuid not null references public.drafts(id) on delete cascade,
  participant_id uuid references public.draft_participants(id) on delete set null,
  display_name   text not null check (char_length(display_name) between 1 and 50),
  content        text not null check (char_length(content) between 1 and 500),
  kind           text not null default 'chat'
                   check (kind in ('chat', 'announcement', 'system')),
  created_at     timestamptz not null default now()
);

create index draft_messages_draft_time
  on public.draft_messages (draft_id, created_at);

alter table public.draft_messages enable row level security;

-- Realtime
alter publication supabase_realtime add table public.draft_messages;

-- Participants (including viewers) can read messages in their draft.
create policy "Participants can read draft messages"
  on public.draft_messages for select
  using (
    exists (
      select 1 from public.draft_participants dp
      where dp.draft_id = draft_messages.draft_id
        and dp.user_id  = auth.uid()
    )
  );

-- send_draft_message: participants send chat; commissioner sends announcements.
create or replace function public.send_draft_message(
  p_draft_id uuid,
  p_content  text,
  p_kind     text default 'chat'
)
returns public.draft_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant public.draft_participants%rowtype;
  v_draft       public.drafts%rowtype;
  v_message     public.draft_messages%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if p_kind not in ('chat', 'announcement') then
    raise exception using errcode = '22023', message = 'Invalid message kind.';
  end if;

  if p_content is null or char_length(trim(p_content)) = 0 then
    raise exception using errcode = '22023', message = 'Message cannot be empty.';
  end if;

  if char_length(p_content) > 500 then
    raise exception using errcode = '22023', message = 'Message exceeds 500 characters.';
  end if;

  select * into v_participant
  from public.draft_participants
  where draft_id = p_draft_id and user_id = auth.uid();

  if not found then
    raise exception using errcode = '42501',
      message = 'You must join the draft before sending messages.';
  end if;

  select * into v_draft from public.drafts where id = p_draft_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if p_kind = 'announcement' and v_draft.commissioner_user_id <> auth.uid() then
    raise exception using errcode = '42501',
      message = 'Only the commissioner can send announcements.';
  end if;

  insert into public.draft_messages (draft_id, participant_id, display_name, content, kind)
  values (p_draft_id, v_participant.id, v_participant.display_name, trim(p_content), p_kind)
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function public.send_draft_message(uuid, text, text) from public, anon;
grant execute on function public.send_draft_message(uuid, text, text) to authenticated;

-- Auto-insert a "has joined" system message whenever a participant is created.
create or replace function public.on_participant_joined_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.draft_messages (draft_id, participant_id, display_name, content, kind)
  values (
    new.draft_id,
    new.id,
    new.display_name,
    new.display_name || ' has joined the draft.',
    'system'
  );
  return new;
end;
$$;

create trigger participant_joined_chat
  after insert on public.draft_participants
  for each row
  execute function public.on_participant_joined_chat();
