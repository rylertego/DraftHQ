# Observability Plan

Operational monitoring approach for DraftHQ draft-night deployments. This
document defines what to watch, what counts as a problem, and what to do. It
is a pre-implementation plan; instrumentation and dashboards are not yet
built. This plan satisfies the Milestone 4A release-readiness requirement and
serves as the implementation brief for Milestone 4B/5.

---

## What Matters on Draft Night

A successful draft requires three things to keep working simultaneously:

1. **Pick submission** — owners can submit picks and commissioner controls work.
2. **Realtime delivery** — all participants see picks appear on the board
   promptly without requiring a manual reload.
3. **Timer accuracy** — the countdown tracks server time closely enough that
   participants experience consistent clock behavior.

Everything else (player search latency, profile loads, invitation delivery) is
degraded-but-acceptable during a live draft.

---

## Signal Tiers

### Tier 1 — Draft-Stopping (act immediately)

These indicate the draft cannot proceed:

- RPC errors on `make_pick` or `commissioner_make_pick` that are not user errors
  (i.e., error codes other than `42501`, `P0001`, or `23505`).
- Database connection failures from any server route.
- Supabase Realtime completely disconnected for more than one participant for
  more than ~30 seconds.
- The draft row's `current_pick` does not advance after a pick is confirmed by
  the client.

**Response:** pause the draft, diagnose, do not resume until the root cause is
identified.

### Tier 2 — Degraded (monitor and decide)

These reduce experience quality but the draft can continue with workarounds:

- Realtime delivery delayed > 5 seconds (participants see stale boards but
  can reload to recover).
- Timer drift > 10 seconds between participants (soft timer — no pick is
  rejected, but the commissioner may need to manually extend by pausing and
  resuming).
- Email invitation delivery failure (recorded in the invitation row; owner can
  join via join code instead).
- Sleeper preview API errors (external dependency; does not affect a live draft).

**Response:** note the incident, continue the draft, investigate after.

### Tier 3 — Informational (log and ignore during draft)

- Individual page load latency spikes.
- Anonymous auth session creation time.
- Player catalog search latency.
- Build or deployment errors (not relevant to an already-running draft).

---

## What to Watch in Supabase Dashboard

These are available without additional instrumentation in the Supabase hosted
dashboard.

### Database

| Metric | Warning threshold | Critical threshold |
|---|---|---|
| DB CPU | > 50% sustained | > 80% sustained |
| DB connections | > 60% of pool | > 90% of pool |
| Disk I/O | sustained elevated | blocking queries visible in pg_stat_activity |
| Slow queries | any query > 500ms | any query > 2s |

Check **Reports → Database** for query volume and slow query logs.

The most database-intensive operations during a draft are `make_pick` /
`commissioner_make_pick` (which lock the draft row) and Realtime change-data-
capture. Both should complete in single-digit milliseconds under normal load.

### Auth

- Monitor **Reports → Auth** for spike in token refresh errors or sign-in
  failures, which would indicate owners are getting logged out unexpectedly.

### Realtime

Supabase does not currently expose per-client Realtime connection counts in the
dashboard. Client-side signals (see below) are the primary indicator.

### Edge Functions / API routes

Next.js route handlers (`/api/drafts/[draftId]/invitations`,
`/api/sleeper/leagues/[leagueId]/preview`) run on the deployment platform
(Vercel or equivalent). Check that platform's function error rate dashboard.
Invitation route errors that are not `401`/`403`/`404` indicate a service
problem.

---

## Client-Side Signals to Instrument

These are not yet implemented. This section is the brief for adding them.

### Reconnect events

The Realtime client fires a reconnect event when a channel recovers after
a disconnect. Log these with a timestamp, draft ID, and participant user ID.

Target: < 1 reconnect per participant per draft. Multiple reconnects in a
short window indicate network instability on that client.

### Stale-pick rejections (P0001 on expected_pick mismatch)

When a pick is rejected because the draft has already advanced (the
`expected_pick` guard in `make_pick`), log the rejection with the submitted
`expected_pick` and the actual `current_pick` from the error context.

This is expected behavior during concurrent submissions, but a spike indicates
a client that is not receiving Realtime updates and keeps trying stale picks.

### Timer drift measurement

`get_draft_server_time` returns the server's current timestamp. The client
already uses this to estimate clock offset. Log the estimated offset at the
start of each pick slot.

Target: offset < 2 seconds. Persistent drift > 5 seconds across multiple
participants suggests NTP issues or server clock skew.

### Pick submission latency

Measure wall time from pick button press to confirmed pick appearance on the
board. Break down into: RPC round trip + Realtime delivery.

Target: RPC < 300ms, Realtime delivery to other clients < 2 seconds.

---

## Pre-Draft Checklist (Observability)

Run through these 30 minutes before draft start:

- [ ] Supabase dashboard is open in a separate tab.
- [ ] DB CPU and connections are at baseline (not elevated from other traffic).
- [ ] A test pick was submitted and appeared on all connected clients within 2
  seconds (use the full-draft rehearsal or a quick manual test).
- [ ] Timer started and counts down consistently across two devices.
- [ ] Commissioner recovery actions (pause, resume, commissioner pick) were
  confirmed working in the rehearsal.
- [ ] Deployment platform error dashboard shows zero errors in the last hour.

---

## Incident Log Template

Record each incident during the draft:

```
Time:
Pick number at incident:
Tier (1 / 2 / 3):
Symptom:
Affected participants:
Action taken:
Resolution:
Time to resolution:
```

Collect all incident logs and attach them to the Release Record in
`docs/release-checklist.md` after the draft completes.

---

## Implementation Priority (Post-4A)

When instrumentation is implemented, build in this order:

1. **Reconnect event logging** — highest signal-to-noise; easy to add to the
   existing `useRealtimeDraftRoom` hook.
2. **Pick submission latency** — measure in the pick submit handler; log to
   console or a lightweight analytics endpoint.
3. **Stale-pick rejection logging** — already surfaced as an error response;
   add a log call alongside the existing error handler.
4. **Dashboard** — a simple artifact or external tool (Grafana, Datadog, or a
   Supabase-queried admin page) that shows reconnect rate and pick latency for
   the current draft. Not needed for the first live draft if the commissioner
   is watching the Supabase dashboard directly.
