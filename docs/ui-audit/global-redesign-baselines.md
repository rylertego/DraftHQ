# Global Redesign Baselines

## Contract

This is the Phase 0 visual-comparison contract. Every operational route/role/state surface has an explicit desktop (`1440x900`) and mobile (`390x844`) target. Every Draft Night surface has an explicit laptop (`1366x768`), desktop (`1440x900`), and TV (`1920x1080`) target, plus mobile where that surface is usable. Baselines live in the ignored `.codex-screenshots/global-redesign/baseline/` directory.

`archive` files are read-only normalized copies of the supplied source archive. Their original role, lifecycle state, and viewport are unknown, so they remain `viewport-unverified` evidence and must be recaptured before pixel comparison. `pending-*` filenames are required captures that were not fabricated because the isolated worktree lacks an authenticated, seeded environment.

| Route | Role | State | Viewport | Baseline file | Required content/actions | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| / | anonymous | landing | 1440x900 | landing-page-archive.png | product identity, entry actions, navigation | Archive viewport unverified. |
| / | anonymous | landing | 390x844 | pending-home-anonymous-mobile.png | product identity, entry actions, navigation | Capture required. |
| /login | anonymous | empty | 1440x900 | pending-login-empty-desktop.png | email, password, submit, signup, recovery links | Capture required. |
| /login | anonymous | empty | 390x844 | pending-login-empty-mobile.png | email, password, submit, signup, recovery links | Capture required. |
| /login | anonymous | validation error | 1440x900 | pending-login-validation-desktop.png | field errors, submit, signup, recovery links | Capture required. |
| /login | anonymous | validation error | 390x844 | pending-login-validation-mobile.png | field errors, submit, signup, recovery links | Capture required. |
| /signup | anonymous | empty | 1440x900 | pending-signup-empty-desktop.png | account fields, submit, login link | Capture required. |
| /signup | anonymous | empty | 390x844 | pending-signup-empty-mobile.png | account fields, submit, login link | Capture required. |
| /signup | anonymous | validation error | 1440x900 | pending-signup-validation-desktop.png | field errors, submit, login link | Capture required. |
| /signup | anonymous | validation error | 390x844 | pending-signup-validation-mobile.png | field errors, submit, login link | Capture required. |
| /forgot-password | anonymous | empty | 1440x900 | pending-forgot-password-empty-desktop.png | email, recovery submit, login link | Capture required. |
| /forgot-password | anonymous | empty | 390x844 | pending-forgot-password-empty-mobile.png | email, recovery submit, login link | Capture required. |
| /forgot-password | anonymous | save failure | 1440x900 | pending-forgot-password-failure-desktop.png | failure message, retry, login link | Capture required. |
| /forgot-password | anonymous | save failure | 390x844 | pending-forgot-password-failure-mobile.png | failure message, retry, login link | Capture required. |
| /reset-password | anonymous | empty | 1440x900 | pending-reset-password-empty-desktop.png | new password, confirmation, submit | Capture required. |
| /reset-password | anonymous | empty | 390x844 | pending-reset-password-empty-mobile.png | new password, confirmation, submit | Capture required. |
| /reset-password | anonymous | validation error | 1440x900 | pending-reset-password-validation-desktop.png | mismatch/error state, submit | Capture required. |
| /reset-password | anonymous | validation error | 390x844 | pending-reset-password-validation-mobile.png | mismatch/error state, submit | Capture required. |
| /dashboard | anonymous | unauthorized | 1440x900 | pending-dashboard-anonymous-desktop.png | redirect or access feedback, login action | Capture required. |
| /dashboard | anonymous | unauthorized | 390x844 | pending-dashboard-anonymous-mobile.png | redirect or access feedback, login action | Capture required. |
| /dashboard | commissioner | populated leagues | 1440x900 | main-dashboard-archive.png | league list, create/join actions, navigation, account controls | Archive viewport unverified. |
| /dashboard | commissioner | populated leagues | 390x844 | pending-dashboard-populated-mobile.png | league list, create/join actions, navigation, account controls | Capture required. |
| /dashboard | commissioner | empty | 1440x900 | pending-dashboard-empty-desktop.png | empty league state, create/join actions | Capture required. |
| /dashboard | commissioner | empty | 390x844 | pending-dashboard-empty-mobile.png | empty league state, create/join actions | Capture required. |
| /profile | assigned owner | populated | 1440x900 | pending-profile-owner-desktop.png | profile fields, image controls, save action | Capture required. |
| /profile | assigned owner | populated | 390x844 | pending-profile-owner-mobile.png | profile fields, image controls, save action | Capture required. |
| /profile | assigned owner | save failure | 1440x900 | pending-profile-save-failure-desktop.png | retained values, failure feedback, retry | Capture required. |
| /profile | assigned owner | save failure | 390x844 | pending-profile-save-failure-mobile.png | retained values, failure feedback, retry | Capture required. |
| /join | anonymous | empty | 1440x900 | pending-join-empty-desktop.png | join-code entry, submit, navigation | Capture required. |
| /join | anonymous | empty | 390x844 | pending-join-empty-mobile.png | join-code entry, submit, navigation | Capture required. |
| /join | anonymous | validation error | 1440x900 | pending-join-validation-desktop.png | invalid code feedback, submit | Capture required. |
| /join | anonymous | validation error | 390x844 | pending-join-validation-mobile.png | invalid code feedback, submit | Capture required. |
| /join/[joinCode] | anonymous | invitation preview | 1440x900 | pending-join-code-preview-desktop.png | league/invitation context, authenticate or join action | Capture required. |
| /join/[joinCode] | anonymous | invitation preview | 390x844 | pending-join-code-preview-mobile.png | league/invitation context, authenticate or join action | Capture required. |
| /join/[joinCode] | unassigned member | unauthorized | 1440x900 | pending-join-code-unauthorized-desktop.png | denied/expired invitation feedback, recovery action | Capture required. |
| /join/[joinCode] | unassigned member | unauthorized | 390x844 | pending-join-code-unauthorized-mobile.png | denied/expired invitation feedback, recovery action | Capture required. |
| /create | commissioner | empty | 1440x900 | pending-create-empty-desktop.png | standalone draft fields, creation action | Capture required. |
| /create | commissioner | empty | 390x844 | pending-create-empty-mobile.png | standalone draft fields, creation action | Capture required. |
| /create | commissioner | validation error | 1440x900 | pending-create-validation-desktop.png | field errors, retained values, create action | Capture required. |
| /create | commissioner | validation error | 390x844 | pending-create-validation-mobile.png | field errors, retained values, create action | Capture required. |
| /leagues/new | commissioner | empty | 1440x900 | pending-leagues-new-empty-desktop.png | league fields, branding, create action | Capture required. |
| /leagues/new | commissioner | empty | 390x844 | pending-leagues-new-empty-mobile.png | league fields, branding, create action | Capture required. |
| /leagues/new | commissioner | validation error | 1440x900 | pending-leagues-new-validation-desktop.png | field errors, retained values, create action | Capture required. |
| /leagues/new | commissioner | validation error | 390x844 | pending-leagues-new-validation-mobile.png | field errors, retained values, create action | Capture required. |
| /leagues/[slug] | commissioner | draft scheduled | 1440x900 | league-dashboard-archive.png | season, readiness, countdown, configure, enter room, standings, history | Archive viewport unverified. |
| /leagues/[slug] | commissioner | draft scheduled | 390x844 | pending-league-dashboard-commissioner-scheduled-mobile.png | season, readiness, countdown, configure, enter room, standings, history | Capture required. |
| /leagues/[slug] | co-commissioner | draft scheduled | 1440x900 | pending-league-dashboard-cocommissioner-desktop.png | readiness, countdown, permitted controls, standings, history | Capture required. |
| /leagues/[slug] | co-commissioner | draft scheduled | 390x844 | pending-league-dashboard-cocommissioner-mobile.png | readiness, countdown, permitted controls, standings, history | Capture required. |
| /leagues/[slug] | assigned owner | active draft | 1440x900 | pending-league-dashboard-owner-active-desktop.png | current lifecycle, enter room, standings, history | Capture required. |
| /leagues/[slug] | assigned owner | active draft | 390x844 | pending-league-dashboard-owner-active-mobile.png | current lifecycle, enter room, standings, history | Capture required. |
| /leagues/[slug] | unassigned member | empty | 1440x900 | pending-league-dashboard-member-empty-desktop.png | setup guidance, visible status, permitted navigation | Capture required. |
| /leagues/[slug] | unassigned member | empty | 390x844 | pending-league-dashboard-member-empty-mobile.png | setup guidance, visible status, permitted navigation | Capture required. |
| /leagues/[slug] | anonymous | unauthorized | 1440x900 | pending-league-dashboard-unauthorized-desktop.png | access-denied or redirect behavior | Capture required. |
| /leagues/[slug] | anonymous | unauthorized | 390x844 | pending-league-dashboard-unauthorized-mobile.png | access-denied or redirect behavior | Capture required. |
| /leagues/[slug]/teams | commissioner | populated | 1440x900 | league-teams-archive.png | team list, owners, edit/archive actions, add team | Archive viewport unverified. |
| /leagues/[slug]/teams | commissioner | populated | 390x844 | pending-league-teams-commissioner-mobile.png | team list, owners, edit/archive actions, add team | Capture required. |
| /leagues/[slug]/teams | commissioner | destructive confirmation | 1440x900 | pending-league-teams-delete-confirmation-desktop.png | team identity, neutral cancel, destructive confirm | Capture required. |
| /leagues/[slug]/teams | commissioner | destructive confirmation | 390x844 | pending-league-teams-delete-confirmation-mobile.png | team identity, neutral cancel, destructive confirm | Capture required. |
| /leagues/[slug]/teams | co-commissioner | loading | 1440x900 | pending-league-teams-loading-desktop.png | loading layout, navigation context | Capture required. |
| /leagues/[slug]/teams | co-commissioner | loading | 390x844 | pending-league-teams-loading-mobile.png | loading layout, navigation context | Capture required. |
| /leagues/[slug]/teams | assigned owner | populated | 1440x900 | pending-league-teams-owner-desktop.png | own-team visibility and restricted actions | Capture required. |
| /leagues/[slug]/teams | assigned owner | populated | 390x844 | pending-league-teams-owner-mobile.png | own-team visibility and restricted actions | Capture required. |
| /leagues/[slug]/my-team | assigned owner | populated | 1440x900 | pending-my-team-owner-desktop.png | team profile, owner details, upload/save actions | Capture required. |
| /leagues/[slug]/my-team | assigned owner | populated | 390x844 | pending-my-team-owner-mobile.png | team profile, owner details, upload/save actions | Capture required. |
| /leagues/[slug]/my-team | assigned owner | validation error | 1440x900 | pending-my-team-validation-desktop.png | field errors, retained values, save action | Capture required. |
| /leagues/[slug]/my-team | assigned owner | validation error | 390x844 | pending-my-team-validation-mobile.png | field errors, retained values, save action | Capture required. |
| /leagues/[slug]/my-team | unassigned member | empty | 1440x900 | pending-my-team-unassigned-desktop.png | assignment guidance and permitted navigation | Capture required. |
| /leagues/[slug]/my-team | unassigned member | empty | 390x844 | pending-my-team-unassigned-mobile.png | assignment guidance and permitted navigation | Capture required. |
| /leagues/[slug]/members | commissioner | populated | 1440x900 | pending-members-commissioner-desktop.png | members, roles, invitations, ownership and removal controls | Capture required. |
| /leagues/[slug]/members | commissioner | populated | 390x844 | pending-members-commissioner-mobile.png | members, roles, invitations, ownership and removal controls | Capture required. |
| /leagues/[slug]/members | commissioner | destructive confirmation | 1440x900 | pending-members-removal-confirmation-desktop.png | member identity, neutral cancel, destructive confirm | Capture required. |
| /leagues/[slug]/members | commissioner | destructive confirmation | 390x844 | pending-members-removal-confirmation-mobile.png | member identity, neutral cancel, destructive confirm | Capture required. |
| /leagues/[slug]/members | co-commissioner | populated | 1440x900 | pending-members-cocommissioner-desktop.png | allowed role/invite actions and restrictions | Capture required. |
| /leagues/[slug]/members | co-commissioner | populated | 390x844 | pending-members-cocommissioner-mobile.png | allowed role/invite actions and restrictions | Capture required. |
| /leagues/[slug]/members | unassigned member | unauthorized | 1440x900 | pending-members-member-unauthorized-desktop.png | denied state or restricted view | Capture required. |
| /leagues/[slug]/members | unassigned member | unauthorized | 390x844 | pending-members-member-unauthorized-mobile.png | denied state or restricted view | Capture required. |
| /leagues/[slug]/settings | commissioner | general | 1440x900 | league-settings-general-archive.png | league fields, branding, tabs, save action | Archive viewport unverified. |
| /leagues/[slug]/settings | commissioner | general | 390x844 | pending-league-settings-general-mobile.png | league fields, branding, tabs, save action | Capture required. |
| /leagues/[slug]/settings | commissioner | members | 1440x900 | league-settings-members-archive.png | member settings, roles, invitation controls | Archive viewport unverified. |
| /leagues/[slug]/settings | commissioner | members | 390x844 | pending-league-settings-members-mobile.png | member settings, roles, invitation controls | Capture required. |
| /leagues/[slug]/settings | commissioner | integrations | 1440x900 | league-settings-integrations-archive.png | providers, connection/sync controls, feedback | Archive viewport unverified. |
| /leagues/[slug]/settings | commissioner | integrations | 390x844 | pending-league-settings-integrations-mobile.png | providers, connection/sync controls, feedback | Capture required. |
| /leagues/[slug]/settings | commissioner | save failure | 1440x900 | pending-league-settings-save-failure-desktop.png | retained values, persistent failure, retry | Capture required. |
| /leagues/[slug]/settings | commissioner | save failure | 390x844 | pending-league-settings-save-failure-mobile.png | retained values, persistent failure, retry | Capture required. |
| /leagues/[slug]/settings | assigned owner | unauthorized | 1440x900 | pending-league-settings-owner-unauthorized-desktop.png | access restriction or permitted subset | Capture required. |
| /leagues/[slug]/settings | assigned owner | unauthorized | 390x844 | pending-league-settings-owner-unauthorized-mobile.png | access restriction or permitted subset | Capture required. |
| /leagues/[slug]/seasons | commissioner | populated | 1440x900 | pending-seasons-populated-desktop.png | season history, provider, lifecycle, actions | Capture required. |
| /leagues/[slug]/seasons | commissioner | populated | 390x844 | pending-seasons-populated-mobile.png | season history, provider, lifecycle, actions | Capture required. |
| /leagues/[slug]/seasons | commissioner | empty | 1440x900 | pending-seasons-empty-desktop.png | empty state, create/import action | Capture required. |
| /leagues/[slug]/seasons | commissioner | empty | 390x844 | pending-seasons-empty-mobile.png | empty state, create/import action | Capture required. |
| /leagues/[slug]/seasons | unassigned member | completed draft | 1440x900 | pending-seasons-member-completed-desktop.png | historical season details and permitted actions | Capture required. |
| /leagues/[slug]/seasons | unassigned member | completed draft | 390x844 | pending-seasons-member-completed-mobile.png | historical season details and permitted actions | Capture required. |
| /leagues/[slug]/seasons/new | commissioner | provider selection | 1440x900 | pending-season-new-provider-desktop.png | provider choices, preview/import, manual creation | Capture required. |
| /leagues/[slug]/seasons/new | commissioner | provider selection | 390x844 | pending-season-new-provider-mobile.png | provider choices, preview/import, manual creation | Capture required. |
| /leagues/[slug]/seasons/new | commissioner | validation error | 1440x900 | pending-season-new-validation-desktop.png | field errors, retained values, create action | Capture required. |
| /leagues/[slug]/seasons/new | commissioner | validation error | 390x844 | pending-season-new-validation-mobile.png | field errors, retained values, create action | Capture required. |
| /teams?draftId=... | commissioner | general | 1440x900 | draft-settings-general-archive.png | draft lifecycle, timer, settings, save/reset actions | Archive viewport unverified. |
| /teams?draftId=... | commissioner | general | 390x844 | pending-draft-settings-general-mobile.png | draft lifecycle, timer, settings, save/reset actions | Capture required. |
| /teams?draftId=... | commissioner | active draft lock | 1440x900 | pending-draft-settings-active-lock-desktop.png | locked controls, lifecycle context, allowed actions | Capture required. |
| /teams?draftId=... | commissioner | active draft lock | 390x844 | draft-settings-general-2-archive.png | locked controls, lifecycle context, allowed actions | Archive viewport unverified. |
| /teams?draftId=... | commissioner | teams and order | 1440x900 | draft-settings-teams-order-archive.png | teams, order, assignments, add/edit controls | Archive viewport unverified. |
| /teams?draftId=... | commissioner | teams and order | 390x844 | pending-draft-settings-teams-order-mobile.png | teams, order, assignments, add/edit controls | Capture required. |
| /teams?draftId=... | commissioner | audio and presentation | 1440x900 | draft-settings-audio-1-archive.png | audio/provider controls, previews, save action | Archive viewport unverified. |
| /teams?draftId=... | commissioner | audio and presentation | 390x844 | pending-draft-settings-audio-mobile.png | audio/provider controls, previews, save action | Capture required. |
| /teams?draftId=... | commissioner | audio failure | 1440x900 | pending-draft-settings-audio-failure-desktop.png | connection/playback failure, retry, retained settings | Capture required. |
| /teams?draftId=... | commissioner | audio failure | 390x844 | draft-settings-audio-2-archive.png | connection/playback failure, retry, retained settings | Archive viewport unverified. |
| /teams?draftId=... | commissioner | destructive confirmation | 1440x900 | pending-draft-settings-reset-confirmation-desktop.png | reset warning, neutral cancel, destructive confirm | Capture required. |
| /teams?draftId=... | commissioner | destructive confirmation | 390x844 | pending-draft-settings-reset-confirmation-mobile.png | reset warning, neutral cancel, destructive confirm | Capture required. |
| /teams?draftId=... | assigned owner | read-only | 1440x900 | pending-draft-settings-owner-readonly-desktop.png | current configuration and permission feedback | Capture required. |
| /teams?draftId=... | assigned owner | read-only | 390x844 | pending-draft-settings-owner-readonly-mobile.png | current configuration and permission feedback | Capture required. |
| /spotify-callback | anonymous | callback success | 1440x900 | pending-spotify-callback-success-desktop.png | connection status, completion/close behavior | Capture requires provider callback. |
| /spotify-callback | anonymous | callback success | 390x844 | pending-spotify-callback-success-mobile.png | connection status, completion/close behavior | Capture requires provider callback. |
| /spotify-callback | anonymous | callback failure | 1440x900 | pending-spotify-callback-failure-desktop.png | error feedback, recovery behavior | Capture requires provider callback. |
| /spotify-callback | anonymous | callback failure | 390x844 | pending-spotify-callback-failure-mobile.png | error feedback, recovery behavior | Capture requires provider callback. |
| /spotify-popup-callback | anonymous | closing success | 1440x900 | pending-spotify-popup-success-desktop.png | opener messaging, close behavior | Capture requires provider callback. |
| /spotify-popup-callback | anonymous | closing success | 390x844 | pending-spotify-popup-success-mobile.png | opener messaging, close behavior | Capture requires provider callback. |
| /spotify-popup-callback | anonymous | failure | 1440x900 | pending-spotify-popup-failure-desktop.png | error feedback, recovery behavior | Capture requires provider callback. |
| /spotify-popup-callback | anonymous | failure | 390x844 | pending-spotify-popup-failure-mobile.png | error feedback, recovery behavior | Capture requires provider callback. |

## Draft Night Matrix

| Route | Role | State | Viewport | Baseline file | Required content/actions | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| /draft/lobby | commissioner | Lobby: ready to start | 1366x768 | draft-lobby-archive.png | league/team identity, readiness, presence, audio, Start Draft | Archive viewport unverified. |
| /draft/lobby | commissioner | Lobby: ready to start | 1440x900 | pending-lobby-commissioner-ready-1440.png | league/team identity, readiness, presence, audio, Start Draft | Capture required. |
| /draft/lobby | commissioner | Lobby: ready to start | 1920x1080 | pending-lobby-commissioner-ready-1920.png | league/team identity, readiness, presence, audio, Start Draft | Capture required. |
| /draft/lobby | commissioner | Lobby: ready to start | 390x844 | pending-lobby-commissioner-ready-mobile.png | league/team identity, readiness, presence, audio, Start Draft | Usable mobile surface; capture required. |
| /draft/lobby | assigned owner | Lobby: unassigned/needs attention | 1366x768 | pending-lobby-owner-needs-attention-1366.png | readiness, assignment guidance, presence, permitted controls | Capture required. |
| /draft/lobby | assigned owner | Lobby: unassigned/needs attention | 1440x900 | pending-lobby-owner-needs-attention-1440.png | readiness, assignment guidance, presence, permitted controls | Capture required. |
| /draft/lobby | assigned owner | Lobby: unassigned/needs attention | 1920x1080 | pending-lobby-owner-needs-attention-1920.png | readiness, assignment guidance, presence, permitted controls | Capture required. |
| /draft/lobby | assigned owner | Lobby: unassigned/needs attention | 390x844 | pending-lobby-owner-needs-attention-mobile.png | readiness, assignment guidance, presence, permitted controls | Usable mobile surface; capture required. |
| /draft | commissioner | Draft Room: active draft board | 1366x768 | draft-board-main-archive.png | live header, timer, board, player controls, commissioner tools | Archive viewport unverified. |
| /draft | commissioner | Draft Room: active draft board | 1440x900 | pending-draft-room-active-1440.png | live header, timer, board, player controls, commissioner tools | Capture required. |
| /draft | commissioner | Draft Room: active draft board | 1920x1080 | pending-draft-room-active-1920.png | live header, timer, board, player controls, commissioner tools | Capture required. |
| /draft | commissioner | Draft Room: active draft board | 390x844 | pending-draft-room-active-mobile.png | live header, timer, compact board/player controls, commissioner tools | Usable mobile surface; capture required. |
| /draft | assigned owner | Draft Room: active player board | 1366x768 | draft-board-player-archive.png | current pick, player search/filter, select/pick controls | Archive viewport unverified. |
| /draft | assigned owner | Draft Room: active player board | 1440x900 | pending-draft-room-owner-player-1440.png | current pick, player search/filter, select/pick controls | Capture required. |
| /draft | assigned owner | Draft Room: active player board | 1920x1080 | pending-draft-room-owner-player-1920.png | current pick, player search/filter, select/pick controls | Capture required. |
| /draft | assigned owner | Draft Room: active player board | 390x844 | pending-draft-room-owner-player-mobile.png | current pick, player search/filter, select/pick controls | Usable mobile surface; capture required. |
| /draft | assigned owner | Draft Room: paused roster board | 1366x768 | pending-draft-room-paused-roster-1366.png | paused lifecycle, rosters, navigation, permitted pick controls | Capture required. |
| /draft | assigned owner | Draft Room: paused roster board | 1440x900 | draft-board-roster-archive.png | paused lifecycle, rosters, navigation, permitted pick controls | Archive viewport unverified. |
| /draft | assigned owner | Draft Room: paused roster board | 1920x1080 | pending-draft-room-paused-roster-1920.png | paused lifecycle, rosters, navigation, permitted pick controls | Capture required. |
| /draft | assigned owner | Draft Room: paused roster board | 390x844 | pending-draft-room-paused-roster-mobile.png | paused lifecycle, rosters, navigation, permitted pick controls | Usable mobile surface; capture required. |
| /draft | unassigned member | Draft Room: roster summary | 1366x768 | pending-draft-room-member-summary-1366.png | roster totals, current lifecycle, read-only controls | Capture required. |
| /draft | unassigned member | Draft Room: roster summary | 1440x900 | pending-draft-room-member-summary-1440.png | roster totals, current lifecycle, read-only controls | Capture required. |
| /draft | unassigned member | Draft Room: roster summary | 1920x1080 | draft-board-roster-summary-archive.png | roster totals, current lifecycle, read-only controls | Archive viewport unverified. |
| /draft | unassigned member | Draft Room: roster summary | 390x844 | pending-draft-room-member-summary-mobile.png | roster totals, current lifecycle, read-only controls | Usable mobile surface; capture required. |
| /draft | anonymous | Draft Room: unauthorized | 1366x768 | pending-draft-room-unauthorized-1366.png | redirect/access feedback, no draft controls | Capture required. |
| /draft | anonymous | Draft Room: unauthorized | 1440x900 | pending-draft-room-unauthorized-1440.png | redirect/access feedback, no draft controls | Capture required. |
| /draft | anonymous | Draft Room: unauthorized | 1920x1080 | pending-draft-room-unauthorized-1920.png | redirect/access feedback, no draft controls | Capture required. |
| /draft | anonymous | Draft Room: unauthorized | 390x844 | pending-draft-room-unauthorized-mobile.png | redirect/access feedback, no draft controls | Usable mobile surface; capture required. |
| /draft | commissioner | TV Mode: active board | 1366x768 | pending-tv-mode-active-1366.png | full-screen board anatomy, live header/timer, ticker, audio, exit-full-screen and commissioner controls | Capture required; TV Mode is an embedded presentation surface. |
| /draft | commissioner | TV Mode: active board | 1440x900 | pending-tv-mode-active-1440.png | full-screen board anatomy, live header/timer, ticker, audio, exit-full-screen and commissioner controls | Capture required. |
| /draft | commissioner | TV Mode: active board | 1920x1080 | pending-tv-mode-active-1920.png | full-screen board anatomy, live header/timer, ticker, audio, exit-full-screen and commissioner controls | Capture required. |
| /draft | commissioner | Pick reveal | 1366x768 | draft-player-selected-archive.png | selected player, pick outcome, continuation controls | Archive viewport unverified. |
| /draft | commissioner | Pick reveal | 1440x900 | pending-pick-reveal-1440.png | selected player, pick outcome, continuation controls | Capture required. |
| /draft | commissioner | Pick reveal | 1920x1080 | pending-pick-reveal-1920.png | selected player, pick outcome, continuation controls | Capture required. |
| /draft | commissioner | Pick reveal | 390x844 | pending-pick-reveal-mobile.png | selected player, pick outcome, continuation controls | Usable mobile surface; capture required. |
| /draft | commissioner | End-of-round recap | 1366x768 | draft-round-recap-archive.png | round results, standings/order context, continue controls | Archive viewport unverified. |
| /draft | commissioner | End-of-round recap | 1440x900 | pending-round-recap-1440.png | round results, standings/order context, continue controls | Capture required. |
| /draft | commissioner | End-of-round recap | 1920x1080 | pending-round-recap-1920.png | round results, standings/order context, continue controls | Capture required. |
| /draft | commissioner | End-of-round recap | 390x844 | pending-round-recap-mobile.png | round results, standings/order context, continue controls | Usable mobile surface; capture required. |
| /draft | commissioner | Draft complete | 1366x768 | draft-complete-archive.png | completion status, grades/awards/recap navigation | Archive viewport unverified. |
| /draft | commissioner | Draft complete | 1440x900 | pending-draft-complete-1440.png | completion status, grades/awards/recap navigation | Capture required. |
| /draft | commissioner | Draft complete | 1920x1080 | pending-draft-complete-1920.png | completion status, grades/awards/recap navigation | Capture required. |
| /draft | commissioner | Draft complete | 390x844 | pending-draft-complete-mobile.png | completion status, grades/awards/recap navigation | Usable mobile surface; capture required. |
| /draft | commissioner | Awards ceremony | 1366x768 | draft-awards-1-archive.png | awards presentation, recipient identity, progression controls | Archive viewport unverified. |
| /draft | commissioner | Awards ceremony | 1440x900 | draft-awards-2-archive.png | awards presentation, recipient identity, progression controls | Archive viewport unverified. |
| /draft | commissioner | Awards ceremony | 1920x1080 | pending-awards-1920.png | awards presentation, recipient identity, progression controls | Capture required. |
| /draft | commissioner | Awards ceremony | 390x844 | pending-awards-mobile.png | awards presentation, recipient identity, progression controls | Usable mobile surface; capture required. |

## Archive Copy Manifest

| Source archive filename | Local normalized copy | Ledger surface |
| --- | --- | --- |
| Draft Awards 1.png | draft-awards-1-archive.png | Awards ceremony, 1366x768 target |
| Draft Awards 2.png | draft-awards-2-archive.png | Awards ceremony, 1440x900 target |
| Draft Complete.png | draft-complete-archive.png | Draft complete, 1366x768 target |
| Draft Lobby.png | draft-lobby-archive.png | Lobby ready to start, 1366x768 target |
| Draft Player Selected.png | draft-player-selected-archive.png | Pick reveal, 1366x768 target |
| Draft Settings Audio 1.png | draft-settings-audio-1-archive.png | Draft settings audio/presentation, 1440x900 target |
| Draft Settings Audio 2.png | draft-settings-audio-2-archive.png | Draft settings audio failure, 390x844 target |
| Draft Settings General 2.png | draft-settings-general-2-archive.png | Draft settings active lock, 390x844 target |
| Draft Settings General.png | draft-settings-general-archive.png | Draft settings general, 1440x900 target |
| Draft Settings Team and Order.png | draft-settings-teams-order-archive.png | Draft settings teams and order, 1440x900 target |
| End of Round Recap.png | draft-round-recap-archive.png | End-of-round recap, 1366x768 target |
| League Dashboard.png | league-dashboard-archive.png | League dashboard scheduled, 1440x900 target |
| League Settings Integrations.png | league-settings-integrations-archive.png | League settings integrations, 1440x900 target |
| League Settings Members.png | league-settings-members-archive.png | League settings members, 1440x900 target |
| League Settings.png | league-settings-general-archive.png | League settings general, 1440x900 target |
| Main Dashboard.png | main-dashboard-archive.png | Global dashboard populated leagues, 1440x900 target |
| Main Draft Board.png | draft-board-main-archive.png | Draft Room active board, 1366x768 target |
| Player Board.png | draft-board-player-archive.png | Draft Room owner player board, 1366x768 target |
| Roster Board.png | draft-board-roster-archive.png | Draft Room paused roster board, 1440x900 target |
| Roster Summary.png | draft-board-roster-summary-archive.png | Draft Room member roster summary, 1920x1080 target |
| Screenshot 2026-08-02 183858.png | landing-page-archive.png | Landing, 1440x900 target |
| Teams Page.png | league-teams-archive.png | League teams populated, 1440x900 target |

## Capture Notes

- Each table row is a separate required capture. A later migration may not infer an omitted viewport from another row.
- TV Mode is a distinct embedded Draft Night surface; preserve its full-screen/windowed board anatomy, header/timer, ticker, audio controls, and exit/full-screen behavior.
- No screenshot was fabricated by altering route code, database data, permissions, timer state, or draft lifecycle.
