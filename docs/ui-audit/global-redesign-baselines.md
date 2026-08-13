# Global Redesign Baselines

## Contract

This ledger is the Phase 0 comparison contract for the global visual-system migration. Each row identifies the role, reachable state, required viewport, local baseline filename, and information or workflow that a later migration must preserve. All files live under `.codex-screenshots/global-redesign/baseline/` and are intentionally ignored by Git.

`archive` files were copied read-only from `C:/Users/regot/OneDrive/Pictures/DraftHq Current PAges/` on 2026-08-13. Their original viewport metadata was not available; later QA must replace them with captures at the listed target viewports before using them for pixel comparison. `pending-*` identifies a required capture that could not be created without an authenticated seeded session or a naturally occurring state; no product state was manufactured.

| Route | Role | State | Viewport | Baseline file | Required content/actions | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| / | anonymous | landing | 1440x900 | landing-page-archive.png | product identity, entry actions, navigation | Archive viewport unverified. |
| / | anonymous | landing | 390x844 | pending-home-anonymous-mobile.png | product identity, entry actions, navigation | Capture required. |
| /login | anonymous | empty | 1440x900 | pending-login-empty-desktop.png | email, password, submit, signup, recovery links | Capture required. |
| /login | anonymous | validation error | 390x844 | pending-login-validation-mobile.png | field errors, submit, signup, recovery links | Capture required. |
| /signup | anonymous | empty | 1440x900 | pending-signup-empty-desktop.png | account fields, submit, login link | Capture required. |
| /signup | anonymous | validation error | 390x844 | pending-signup-validation-mobile.png | field errors, submit, login link | Capture required. |
| /forgot-password | anonymous | empty | 1440x900 | pending-forgot-password-empty-desktop.png | email, recovery submit, login link | Capture required. |
| /forgot-password | anonymous | save failure | 390x844 | pending-forgot-password-failure-mobile.png | failure message, retry, login link | Capture required. |
| /reset-password | anonymous | empty | 1440x900 | pending-reset-password-empty-desktop.png | new password, confirmation, submit | Capture required. |
| /reset-password | anonymous | validation error | 390x844 | pending-reset-password-validation-mobile.png | mismatch/error state, submit | Capture required. |
| /dashboard | anonymous | unauthorized | 1440x900 | pending-dashboard-anonymous-desktop.png | redirect or access feedback, login action | Capture required. |
| /dashboard | commissioner | populated leagues | 1440x900 | main-dashboard-archive.png | league list, create/join actions, navigation, account controls | Archive viewport unverified. |
| /dashboard | commissioner | empty | 390x844 | pending-dashboard-empty-mobile.png | empty league state, create/join actions | Capture required. |
| /profile | assigned owner | populated | 1440x900 | pending-profile-owner-desktop.png | profile fields, image controls, save action | Capture required. |
| /profile | assigned owner | save failure | 390x844 | pending-profile-save-failure-mobile.png | retained values, failure feedback, retry | Capture required. |
| /join | anonymous | empty | 1440x900 | pending-join-empty-desktop.png | join-code entry, submit, navigation | Capture required. |
| /join | anonymous | validation error | 390x844 | pending-join-validation-mobile.png | invalid code feedback, submit | Capture required. |
| /join/[joinCode] | anonymous | invitation preview | 1440x900 | pending-join-code-preview-desktop.png | league/invitation context, authenticate or join action | Capture required. |
| /join/[joinCode] | unassigned member | unauthorized | 390x844 | pending-join-code-unauthorized-mobile.png | denied/expired invitation feedback, recovery action | Capture required. |
| /create | commissioner | empty | 1440x900 | pending-create-empty-desktop.png | standalone draft fields, creation action | Capture required. |
| /create | commissioner | validation error | 390x844 | pending-create-validation-mobile.png | field errors, retained values, create action | Capture required. |
| /leagues/new | commissioner | empty | 1440x900 | pending-leagues-new-empty-desktop.png | league fields, branding, create action | Capture required. |
| /leagues/new | commissioner | validation error | 390x844 | pending-leagues-new-validation-mobile.png | field errors, retained values, create action | Capture required. |
| /leagues/[slug] | commissioner | draft scheduled | 1440x900 | league-dashboard-archive.png | season, readiness, countdown, configure, enter room, standings, history | Archive viewport unverified. |
| /leagues/[slug] | co-commissioner | draft scheduled | 390x844 | pending-league-dashboard-cocommissioner-mobile.png | readiness, countdown, permitted controls, standings, history | Capture required. |
| /leagues/[slug] | assigned owner | active draft | 1440x900 | pending-league-dashboard-owner-active-desktop.png | current lifecycle, enter room, standings, history | Capture required. |
| /leagues/[slug] | unassigned member | empty | 390x844 | pending-league-dashboard-member-empty-mobile.png | setup guidance, visible status, permitted navigation | Capture required. |
| /leagues/[slug] | anonymous | unauthorized | 1440x900 | pending-league-dashboard-unauthorized-desktop.png | access-denied or redirect behavior | Capture required. |
| /leagues/[slug]/teams | commissioner | populated | 1440x900 | league-teams-archive.png | team list, owners, edit/archive actions, add team | Archive viewport unverified. |
| /leagues/[slug]/teams | commissioner | destructive confirmation | 390x844 | pending-league-teams-delete-confirmation-mobile.png | team identity, neutral cancel, destructive confirm | Capture required. |
| /leagues/[slug]/teams | co-commissioner | loading | 1440x900 | pending-league-teams-loading-desktop.png | loading layout, navigation context | Capture required. |
| /leagues/[slug]/teams | assigned owner | populated | 390x844 | pending-league-teams-owner-mobile.png | own-team visibility and restricted actions | Capture required. |
| /leagues/[slug]/my-team | assigned owner | populated | 1440x900 | pending-my-team-owner-desktop.png | team profile, owner details, upload/save actions | Capture required. |
| /leagues/[slug]/my-team | assigned owner | validation error | 390x844 | pending-my-team-validation-mobile.png | field errors, retained values, save action | Capture required. |
| /leagues/[slug]/my-team | unassigned member | empty | 1440x900 | pending-my-team-unassigned-desktop.png | assignment guidance and permitted navigation | Capture required. |
| /leagues/[slug]/members | commissioner | populated | 1440x900 | pending-members-commissioner-desktop.png | members, roles, invitations, ownership and removal controls | Capture required. |
| /leagues/[slug]/members | commissioner | destructive confirmation | 390x844 | pending-members-removal-confirmation-mobile.png | member identity, neutral cancel, destructive confirm | Capture required. |
| /leagues/[slug]/members | co-commissioner | populated | 390x844 | pending-members-cocommissioner-mobile.png | allowed role/invite actions and restrictions | Capture required. |
| /leagues/[slug]/members | unassigned member | unauthorized | 1440x900 | pending-members-member-unauthorized-desktop.png | denied state or restricted view | Capture required. |
| /leagues/[slug]/settings | commissioner | general | 1440x900 | league-settings-general-archive.png | league fields, branding, tabs, save action | Archive viewport unverified. |
| /leagues/[slug]/settings | commissioner | members | 1440x900 | league-settings-members-archive.png | member settings, roles, invitation controls | Archive viewport unverified. |
| /leagues/[slug]/settings | commissioner | integrations | 1440x900 | league-settings-integrations-archive.png | providers, connection/sync controls, feedback | Archive viewport unverified. |
| /leagues/[slug]/settings | commissioner | save failure | 390x844 | pending-league-settings-save-failure-mobile.png | retained values, persistent failure, retry | Capture required. |
| /leagues/[slug]/settings | assigned owner | unauthorized | 390x844 | pending-league-settings-owner-unauthorized-mobile.png | access restriction or permitted subset | Capture required. |
| /leagues/[slug]/seasons | commissioner | populated | 1440x900 | pending-seasons-populated-desktop.png | season history, provider, lifecycle, actions | Capture required. |
| /leagues/[slug]/seasons | commissioner | empty | 390x844 | pending-seasons-empty-mobile.png | empty state, create/import action | Capture required. |
| /leagues/[slug]/seasons | unassigned member | completed draft | 1440x900 | pending-seasons-member-completed-desktop.png | historical season details and permitted actions | Capture required. |
| /leagues/[slug]/seasons/new | commissioner | provider selection | 1440x900 | pending-season-new-provider-desktop.png | provider choices, preview/import, manual creation | Capture required. |
| /leagues/[slug]/seasons/new | commissioner | validation error | 390x844 | pending-season-new-validation-mobile.png | field errors, retained values, create action | Capture required. |
| /teams?draftId=... | commissioner | general | 1440x900 | draft-settings-general-archive.png | draft lifecycle, timer, settings, save/reset actions | Archive viewport unverified. |
| /teams?draftId=... | commissioner | active draft lock | 390x844 | draft-settings-general-2-archive.png | locked controls, lifecycle context, allowed actions | Archive viewport unverified. |
| /teams?draftId=... | commissioner | teams and order | 1440x900 | draft-settings-teams-order-archive.png | teams, order, assignments, add/edit controls | Archive viewport unverified. |
| /teams?draftId=... | commissioner | audio and presentation | 1440x900 | draft-settings-audio-1-archive.png | audio/provider controls, previews, save action | Archive viewport unverified. |
| /teams?draftId=... | commissioner | audio failure | 390x844 | draft-settings-audio-2-archive.png | connection/playback failure, retry, retained settings | Archive viewport unverified. |
| /teams?draftId=... | commissioner | destructive confirmation | 390x844 | pending-draft-settings-reset-confirmation-mobile.png | reset warning, neutral cancel, destructive confirm | Capture required. |
| /teams?draftId=... | assigned owner | read-only | 1440x900 | pending-draft-settings-owner-readonly-desktop.png | current configuration and permission feedback | Capture required. |
| /draft/lobby | commissioner | ready to start | 1366x768 | draft-lobby-archive.png | league/team identity, readiness, presence, audio, start controls | Archive viewport unverified. |
| /draft/lobby | commissioner | ready to start | 1440x900 | pending-draft-lobby-commissioner-desktop.png | league/team identity, readiness, presence, audio, start controls | Capture required. |
| /draft/lobby | commissioner | ready to start | 1920x1080 | pending-draft-lobby-commissioner-tv.png | league/team identity, readiness, presence, audio, start controls | Capture required. |
| /draft/lobby | assigned owner | unassigned/needs attention | 390x844 | pending-draft-lobby-owner-mobile.png | readiness, assignment guidance, permitted controls | Capture required. |
| /draft | commissioner | active draft board | 1366x768 | draft-board-main-archive.png | live header, timer, board, player controls, commissioner tools | Archive viewport unverified. |
| /draft | commissioner | active draft board | 1440x900 | pending-draft-board-commissioner-desktop.png | live header, timer, board, player controls, commissioner tools | Capture required. |
| /draft | commissioner | active draft board | 1920x1080 | pending-draft-board-commissioner-tv.png | live header, timer, board, player controls, commissioner tools | Capture required. |
| /draft | assigned owner | active player board | 1366x768 | draft-board-player-archive.png | current pick, player search/filter, select/pick controls | Archive viewport unverified. |
| /draft | assigned owner | paused roster board | 1440x900 | draft-board-roster-archive.png | paused lifecycle, rosters, navigation, permitted pick controls | Archive viewport unverified. |
| /draft | unassigned member | roster summary | 1920x1080 | draft-board-roster-summary-archive.png | roster totals, current lifecycle, read-only controls | Archive viewport unverified. |
| /draft | assigned owner | pick reveal | 1366x768 | draft-player-selected-archive.png | selected player, pick confirmation/outcome, continuation controls | Archive viewport unverified. |
| /draft | assigned owner | pick reveal | 1440x900 | pending-draft-pick-reveal-desktop.png | selected player, pick confirmation/outcome, continuation controls | Capture required. |
| /draft | assigned owner | pick reveal | 1920x1080 | pending-draft-pick-reveal-tv.png | selected player, pick confirmation/outcome, continuation controls | Capture required. |
| /draft | commissioner | end-of-round recap | 1366x768 | draft-round-recap-archive.png | round results, standings/order context, continue controls | Archive viewport unverified. |
| /draft | commissioner | end-of-round recap | 1440x900 | pending-draft-round-recap-desktop.png | round results, standings/order context, continue controls | Capture required. |
| /draft | commissioner | end-of-round recap | 1920x1080 | pending-draft-round-recap-tv.png | round results, standings/order context, continue controls | Capture required. |
| /draft | commissioner | completed draft | 1366x768 | draft-complete-archive.png | completion status, grades/awards/recap navigation | Archive viewport unverified. |
| /draft | commissioner | completed draft | 1440x900 | pending-draft-complete-desktop.png | completion status, grades/awards/recap navigation | Capture required. |
| /draft | commissioner | completed draft | 1920x1080 | pending-draft-complete-tv.png | completion status, grades/awards/recap navigation | Capture required. |
| /draft | commissioner | awards | 1366x768 | draft-awards-1-archive.png | awards presentation, recipient identity, progression controls | Archive viewport unverified. |
| /draft | commissioner | awards | 1440x900 | draft-awards-2-archive.png | awards presentation, recipient identity, progression controls | Archive viewport unverified. |
| /draft | commissioner | awards | 1920x1080 | pending-draft-awards-tv.png | awards presentation, recipient identity, progression controls | Capture required. |
| /draft | anonymous | unauthorized | 390x844 | pending-draft-unauthorized-mobile.png | redirect/access feedback, no draft controls | Capture required. |
| /spotify-callback | anonymous | callback success | 1440x900 | pending-spotify-callback-success-desktop.png | connection status, completion/close behavior | Capture requires provider callback. |
| /spotify-callback | anonymous | callback failure | 390x844 | pending-spotify-callback-failure-mobile.png | error feedback, recovery behavior | Capture requires provider callback. |
| /spotify-popup-callback | anonymous | closing success | 1440x900 | pending-spotify-popup-success-desktop.png | opener messaging, close behavior | Capture requires provider callback. |
| /spotify-popup-callback | anonymous | failure | 390x844 | pending-spotify-popup-failure-mobile.png | error feedback, recovery behavior | Capture requires provider callback. |

## Capture Notes

- Operational routes require `1440x900` and `390x844` captures for the listed state matrix.
- Draft Night routes and embedded presentation states require `1366x768`, `1440x900`, and `1920x1080` captures; basic mobile coverage remains required where the route is usable on mobile.
- Archive files are retained as visual evidence only. They are not substitutes for target-viewport captures because the archive did not preserve role, lifecycle, or viewport metadata.
- No screenshot was fabricated by altering route code, database data, permissions, timer state, or draft lifecycle.
