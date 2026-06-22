# Commissioner Recovery Runbook

Draft-night recovery procedures for the DraftHQ commissioner. Each scenario
lists the precondition, the exact steps to take in the UI, what the database
enforces, and what to do if the UI step fails.

Keep this page open during the draft.

---

## Before You Start

Confirm these before the draft goes live:

- You are signed in with your **persistent account** (not anonymous). Commissioner
  operations require a non-anonymous session.
- You have the draft URL and join code written down separately from the browser tab.
- A backup contact knows they may need to relay instructions if you lose connectivity.
- All teams show an assigned owner in the participant list before you click Start.

---

## Scenario 1 — Owner Never Joined or Dropped Before Draft Start

**When:** Draft is still in `setup` status; an owner's seat is empty or the
wrong person is in it.

1. Do not start the draft yet.
2. In the commissioner panel, find the participant who needs to be replaced.
3. Click **Remove** next to that participant. The UI calls `remove_draft_participant`.
   The database requires status `setup` or `paused`; it will reject this during
   an active draft.
4. Re-send the invitation email from the commissioner panel, or share the join
   code directly with the replacement owner.
5. Once the replacement joins, use **Assign Team** to give them the correct seat.
   The database rejects duplicate team assignments automatically.
6. Confirm the participant list shows the correct owner-to-team mapping before
   starting.

---

## Scenario 2 — Owner Goes Offline During an Active Draft

**When:** Draft is `active`; an owner is not responding and their pick clock is
running out.

The timer is soft — expiry does not auto-skip. The owner may still return and
pick. Decide how long to wait based on your league's agreed policy.

**Option A — Wait and let them pick when they return.** No action needed. The
clock shows expired but the draft does not advance automatically.

**Option B — Commissioner makes the pick for them.**

1. Click **Pause** in the commissioner panel. The UI calls `pause_draft`. This
   freezes the clock and stores the remaining seconds in the database.
2. Decide on a player (coordinate with the owner if reachable).
3. Click **Commissioner Pick** (or the equivalent recovery pick control) and
   select the player. The UI calls `commissioner_make_pick`. This succeeds even
   though it is not the commissioner's assigned team; the database allows it when
   called with the commissioner override flag.
4. Click **Resume**. The UI calls `resume_draft`. The clock restarts from the
   stored remaining seconds for the next pick.

**Option C — Remove the owner and replace mid-draft.**

1. Click **Pause**.
2. Click **Remove** next to the absent participant. The database requires
   `paused` status; this will be rejected if the draft is still `active`.
3. Share the join code with the replacement. They join and you assign them the
   same team via **Assign Team**.
4. Click **Resume**.

> Note: removing an owner mid-draft unlinks their participant record from any
> picks they already made. Those picks are preserved; `participant_id` is set to
> null on existing pick rows (on delete set null). The draft record is intact.

---

## Scenario 3 — Bad Pick Was Made (Wrong Player Selected)

**When:** A pick was just submitted and the player is wrong — wrong team, typo,
or misclick.

`undo_pick` removes only the **most recent pick** and rewinds `current_pick` by
one. It does not support undoing picks further back in the history.

1. Click **Pause** if the draft is active (required before most commissioner
   actions; undo is the exception — undo works on both `active` and `paused`
   drafts because it does not require a status precondition).
2. Click **Undo Last Pick** in the commissioner panel. The UI calls `undo_pick`.
   The database deletes the most recent pick row and decrements `current_pick`.
   If the draft was `complete` before undo, it returns to `active`.
3. The correct team is now on the clock. The owner (or commissioner via Option B
   above) makes the correct pick.
4. If you paused, click **Resume**.

**If undo is called more than once in a row:** each call removes the next-most-
recent pick. Undo as many times as needed to reach the right state, then
re-enter picks in order.

**Limit:** undo has no hard cap on repetitions, but each undo only removes the
single most recent pick. To correct a pick several rounds back, you would need
to undo every pick since that point, re-enter them all, then undo again if
needed. Plan accordingly.

---

## Scenario 4 — Timer Is Misconfigured

**When:** The pick clock is set to the wrong duration and you need to change it.

`configure_draft_timer` requires status `setup` or `paused`. You cannot change
the timer duration while the draft is `active`.

1. Click **Pause**.
2. In the commissioner panel, find the timer setting and enter the new duration
   (15–600 seconds).
3. The UI calls `configure_draft_timer`. The database updates `pick_seconds` and
   also resets `paused_remaining_seconds` to the new value so the next resume
   starts with the full new duration.
4. Click **Resume**.

---

## Scenario 5 — Owner Claims the Wrong Team on Join

**When:** An owner joined via join code and the commissioner sees them listed
without a team, or assigned to the wrong seat.

1. If the draft is `active`, click **Pause** first (required for reassignment).
2. In the commissioner panel, click **Assign Team** next to the participant.
   Select the correct team. The UI calls `assign_team`.
3. The database rejects this if another participant already holds that team
   (`23505` unique violation). If so, you must first unassign or remove the
   current holder.
4. Click **Resume** if you paused.

---

## Scenario 6 — Duplicate Participant (Same Person Joined Twice)

**When:** A participant appears twice in the list, usually because they signed
in with a different account.

1. Click **Pause** if active.
2. Identify which participant record is the duplicate (the one without a team
   assignment, or the anonymous session).
3. Click **Remove** on the duplicate. The database will reject removal of the
   commissioner role; only remove `owner` or `viewer` role participants.
4. If the correct account needs a team assigned, use **Assign Team**.
5. Click **Resume**.

---

## Scenario 7 — Draft Completes but a Pick Is Missing or Wrong

**When:** The draft reached `complete` status but a pick slot has the wrong
player or the wrong team.

The draft status returns to `active` as soon as you call `undo_pick` on the
last pick. You can undo back through as many picks as necessary to reach the
error, but you must re-enter every pick you undo.

For errors deep in the pick history, coordinate with all owners to confirm
the correct re-entry sequence before undoing. There is no batch-undo.

---

## Scenario 8 — Commissioner Loses Connectivity

**When:** The commissioner's browser goes offline or the tab crashes mid-draft.

1. The draft continues for other participants; they can still see the board
   and make picks if it is their turn (owner picks do not require the commissioner
   to be present).
2. On return: reload the draft URL. The client fetches a fresh snapshot from
   the database. Realtime re-subscribes automatically.
3. If the commissioner's session expired: sign in again with the same persistent
   account. The session is tied to the account, not the browser tab.
4. If the commissioner needs to hand off control mid-draft: share the account
   credentials with the backup commissioner, or coordinate via the backup contact
   who can relay commissioner actions by voice/chat.

> There is no in-app commissioner transfer RPC in Milestone 4A. The
> `commissioner_user_id` on the `drafts` row can only be changed via a direct
> database edit (Supabase SQL editor) — document the draft ID before draft night
> in case this is needed.

---

## What Requires Direct Database Access

The following situations cannot be resolved from the UI and require the Supabase
SQL editor:

- **Transfer commissioner role:** `UPDATE public.drafts SET commissioner_user_id = '<new_user_id>' WHERE id = '<draft_id>';`
- **Correct a pick several rounds back without undoing all subsequent picks:** not supported; undo to the error point and re-enter.
- **Restore a deleted participant's team assignment:** re-add as a new join or update `team_id` directly on `draft_participants`.

When running direct SQL edits: pause the draft first, make the minimal change,
verify the participant list and pick board in the UI, then resume.

---

## Quick Reference

| Situation | Action | RPC | Status required |
|---|---|---|---|
| Remove an owner | Commissioner panel → Remove | `remove_draft_participant` | setup or paused |
| Assign / reassign a team | Commissioner panel → Assign Team | `assign_team` | setup or paused |
| Make a pick for an owner | Commissioner panel → Commissioner Pick | `commissioner_make_pick` | active |
| Undo last pick | Commissioner panel → Undo Last Pick | `undo_pick` | active or paused |
| Pause the clock | Commissioner panel → Pause | `pause_draft` | active |
| Resume the clock | Commissioner panel → Resume | `resume_draft` | paused |
| Change timer duration | Commissioner panel → Timer setting | `configure_draft_timer` | setup or paused |
