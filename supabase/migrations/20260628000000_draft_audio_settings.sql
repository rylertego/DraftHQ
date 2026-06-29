-- Audio/video settings for the draft room

alter table public.drafts
  add column if not exists sfx_1_url    text default null,
  add column if not exists sfx_2_url    text default null,
  add column if not exists pos_reactions text[] default null,
  add column if not exists neg_reactions text[] default null;
