# DraftHQ GitHub Issue Tracking Guide

_Last updated: 2026-06-24_

Repository: [rylertego/DraftHQ](https://github.com/rylertego/DraftHQ)
Project board: [DraftHQ Roadmap](https://github.com/users/rylertego/projects/1)

---

## Label Meanings

### Type Labels

| Label | Color | Meaning |
|---|---|---|
| `type:bug` | Red | Something is broken; regression or incorrect behavior |
| `type:feature` | Blue | New capability or UX improvement |
| `type:backend` | Yellow | DB migrations, RPCs, RLS policies, API routes |
| `type:frontend` | Light blue | UI components, pages, client-side logic |
| `type:docs` | Blue | Documentation updates (roadmap, test plan, runbooks) |
| `type:refactor` | Gray | Code restructure with no behavior change |
| `type:test` | Light blue | Test coverage additions or fixes |
| `type:release` | Purple | Release prep, deployment, or launch gate |

An issue can have multiple type labels (e.g., `type:backend,type:frontend` for a full-stack feature).

### Priority Labels

| Label | Color | Meaning |
|---|---|---|
| `priority:P0` | Dark red | Release blocker — blocks shipping. Fix before anything else. |
| `priority:P1` | Red-orange | High priority — needed for a usable product. Do in current milestone. |
| `priority:P2` | Yellow | Normal priority — important but not blocking. Schedule for upcoming milestones. |

### Area Labels

| Label | Meaning |
|---|---|
| `area:auth` | Login, signup, session management, post-auth redirects |
| `area:dashboard` | /dashboard page |
| `area:league` | League home (/leagues/[slug]), league creation, routing |
| `area:members` | League member management |
| `area:settings` | Draft settings, league settings |
| `area:teams` | Teams tab, team fields, draft order |
| `area:draft-room` | Live draft room (/draft) |
| `area:lobby` | Pre-draft lobby |
| `area:chat` | Draft chat (draft_messages) |
| `area:season-lifecycle` | Season creation, archiving, past seasons |
| `area:branding` | Logo, colors, themes, brand consistency |
| `area:provider-imports` | Sleeper, ESPN, Yahoo, MFL, Fleaflicker imports |
| `area:rankings` | Player rankings, draft board sort |
| `area:whammy` | Landmine/whammy feature |

### Status Labels

| Label | Meaning |
|---|---|
| `status:blocked` | Cannot proceed until another issue is resolved (add a comment with the blocker) |
| `status:needs-design` | Needs a design decision before implementation can start |
| `status:ready` | Fully scoped, reproduction steps confirmed, ready to implement |

---

## Priority Meanings

- **P0 — Release blocker**: These issues prevent the product from shipping. They have been confirmed broken in the codebase and block a real user from completing a critical workflow. Fix before any P1 or P2 work in the milestone. Current P0s: #1 (Reset Draft RLS), #2 (Add Member 403), #15 (teams migration), #17 (settings persistence), #35 (RLS audit), #37 (hosted deployment).

- **P1 — High priority**: Required for a usable, coherent product. Commissioners or owners would notice the gap immediately. Plan to resolve in the current or next milestone cycle.

- **P2 — Normal priority**: Important features that improve the product but are not blocking the core draft flow. Schedule based on milestone plan.

---

## Board Workflow

Issues move left to right through these statuses on the project board:

```
Backlog → Ready → In Progress → In Review → Done
```

| Status | Meaning |
|---|---|
| **Backlog** | Scoped but not yet started. May have `status:needs-design` or `status:blocked`. |
| **Ready** | Fully scoped, unblocked, ready to implement. Has `status:ready`. |
| **In Progress** | Actively being worked on. Assign to yourself when you pick it up. |
| **In Review** | PR is open and awaiting review. |
| **Done** | PR merged to main; issue closed. |

---

## Milestone to Issue Map

| Milestone | Issues |
|---|---|
| M5 — Backend Wiring and Functional League Workspace | #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14 |
| M6 — Draft Setup Persistence and Pre-Draft Lobby | #15, #17, #18, #19, #20, #21, #22, #23 |
| M7 — Draft Room Branding, Timer, and Draft Reliability | #23, #24, #25, #26 |
| M8 — League History, Season Archive, and Member Archive | #27, #28, #29 |
| M9 — Rankings, Landmine, and Advanced Draft Features | #16, #30, #31, #32, #33, #34 |
| Release Prep | #35, #36, #37, #38 |

Note: #23 (roster position filtering) spans M6 (DB column already exists) and M7 (filter logic in draft room).

---

## How to Triage New Bugs

1. **Reproduce it.** Confirm the bug is real and write reproduction steps before creating an issue.
2. **Label it.**
   - Add `type:bug`
   - Add the appropriate `area:*` label(s)
   - Add a priority: `priority:P0` if it blocks a critical user workflow; `priority:P1` if commissioners would notice; `priority:P2` if cosmetic or edge-case
   - Add `status:ready` once reproduction steps are confirmed
3. **Assign a milestone** by referencing which milestone's work is affected.
4. **Add to project board** at Backlog status: `gh project item-add 1 --owner rylertego --url <issue-url>`
5. **Reference related issues** — if the bug is a blocker for another issue, add `status:blocked` to the blocked issue and mention it in the body.

---

## How to Close Issues

Link a pull request to an issue using a closing keyword in the PR body or commit message:

```
Closes #1
Fixes #2
Resolves #12
```

When the PR is merged to main, GitHub automatically closes the linked issue and moves it to Done on the project board.

If a PR partially addresses an issue (e.g., migration only, UI still pending), use `Part of #N` instead of `Closes #N` so the issue stays open.

---

## How to Link PRs to Issues

In the PR body (or description):

```markdown
## Related Issues

Closes #1 — Reset Draft RLS
Part of #17 — Settings persistence verification
```

Or reference in commit message:

```
fix(rls): add DELETE policy on picks for commissioner

Closes #1
```

GitHub will show the linked issues in the PR sidebar and auto-close them on merge.

---

## Creating New Issues via CLI

```bash
gh issue create --repo rylertego/DraftHQ \
  --title "Bug: Short description" \
  --label "type:bug,priority:P1,area:draft-room,status:ready" \
  --body-file /path/to/body.md

# Then add to project board:
gh project item-add 1 --owner rylertego --url <issue-url>
```

---

## Checking Issue Status

```bash
# List open P0 issues
gh issue list --repo rylertego/DraftHQ --label "priority:P0"

# List all M5 issues by area
gh issue list --repo rylertego/DraftHQ --label "area:draft-room"

# View a specific issue
gh issue view 1 --repo rylertego/DraftHQ
```
