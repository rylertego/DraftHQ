# Player Data

The MVP player catalog uses the nflverse players dataset:

- Source: https://github.com/nflverse/nflverse-data/releases/tag/players
- CSV: https://github.com/nflverse/nflverse-data/releases/download/players/players.csv
- License: Creative Commons Attribution 4.0 International

This project is not affiliated with nflverse or the NFL. The import retains
nflverse GSIS identifiers for attribution, deduplication, and repeatable updates.

## Import behavior

The importer selects the latest `last_season` in the feed and keeps `QB`, `RB`,
`WR`, `TE`, and `K` records except players marked `CUT` or `RET`. Historical team
aliases are normalized, duplicate GSIS IDs are collapsed, and 32 team-defense
records are generated as `DST` players.

Each successful run atomically marks the previous nflverse catalog inactive and
upserts the current catalog. Existing rows are never deleted, so historical draft
picks keep valid player references.

## Run the import

1. Apply `supabase/migrations/20260619170000_add_player_catalog_import.sql`.
2. Add one server-only key to `.env.local`:

```dotenv
SUPABASE_SECRET_KEY=your-secret-key
```

The legacy `SUPABASE_SERVICE_ROLE_KEY` variable is also supported. Never prefix
either key with `NEXT_PUBLIC_` or expose it to browser code.

3. Run:

```powershell
npm run players:import
```

The command prints the source season, source row count, and imported row count.
