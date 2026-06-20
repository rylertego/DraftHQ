# Sleeper Import

DraftHQ uses Sleeper's public, read-only HTTP API to preview a league before
creating any DraftHQ records. Sleeper does not require an API token and does not
allow DraftHQ to modify the Sleeper league.

The preview route reads and caches these official endpoints for five minutes:

* `GET /v1/league/{league_id}`
* `GET /v1/league/{league_id}/users`
* `GET /v1/league/{league_id}/rosters`
* `GET /v1/league/{league_id}/drafts`

The commissioner can correct the league name, round count, team names, and
draft order before approval. Approval creates the DraftHQ draft and ordered
teams atomically in PostgreSQL.

Sleeper does not expose league-member email addresses. DraftHQ therefore shows
an optional invitation email field for each imported manager. Only addresses
entered by the commissioner are invited.

If Sleeper has no complete draft order, DraftHQ falls back to roster order and
shows a warning so the commissioner can reorder teams before creation.

This phase does not synchronize picks back to Sleeper.

Official API documentation: <https://docs.sleeper.com/>
