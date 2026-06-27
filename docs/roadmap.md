# DraftHQ Roadmap

This file is superseded by **[docs/roadmap-v2.md](roadmap-v2.md)**, which contains the current milestone plan (M5–M9 + Release Prep), current implementation status, and architecture decisions.

Read `docs/roadmap-v2.md` for all active planning.

---

## Required Supabase Migrations (Quick Reference)

The following migrations are needed and have not yet been written. See `docs/roadmap-v2.md` for full context.

| Migration | Priority | Milestone |
|---|---|---|
| ~~DELETE policy on `picks` for commissioner~~ (done: `reset_draft` RPC + DELETE RLS policy in `20260624000000_m5_fixes.sql`) | ~~P0~~ | M5 |
| Supabase Storage bucket `league-assets` (public read RLS) | P1 | M5 |
| `teams` extended fields: `short_name`, `tts_name`, `autodraft`, `pre_draft_notes`, `owner_name`, `owner_photo_url`, `last_season_pick`, `last_season_record`, `last_season_playoffs` | P2 | M6 |
| `league_members.archived_at timestamptz` | P2 | M8 |
| `league_season_members` snapshot table | P2 | M8 |
| `player_rankings` table: `(player_id, scoring_type, rank, tier)` | P2 | M9 |
| Rename `drafts.use_whammies` → `use_landmines`, `whammy_count` → `landmine_count` | P2 | M9 |
| `drafts.landmine_player_ids uuid[]` | P2 | M9 |
| `teams.walk_up_song_url text` | P2 | M9 |
