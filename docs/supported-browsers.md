# DraftHQ Supported Browsers

This document defines the intended Milestone 4A browser matrix. Support is not
considered verified until the applicable automated and real-device validation
has been completed and recorded for a release candidate.

## Support Policy

DraftHQ targets current stable browsers and the immediately previous major
version where the platform makes that version available. Security updates and
modern JavaScript, WebSocket, and Web Storage support are required.

The draft remains authoritative in PostgreSQL. A supported browser must be able
to authenticate, load an authoritative snapshot, receive Realtime updates, and
recover after connectivity or visibility changes.

## Tier 1: Required Release Support

| Platform | Browser | Required validation |
| --- | --- | --- |
| iPhone | Safari, current and previous major iOS | Real device and WebKit emulation |
| Android phone | Chrome, current stable | Real device and Chromium emulation |
| iPad | Safari, current and previous major iPadOS | Real device and WebKit emulation |
| Windows | Chrome and Edge, current stable | Automated desktop E2E |
| macOS | Safari and Chrome, current stable | Automated E2E plus Safari smoke test |

Tier 1 failures in draft creation, joining, assignment, picking, timer display,
pause/resume, reconnect, or undo block release.

## Tier 2: Best-Effort Support

| Platform | Browser | Validation |
| --- | --- | --- |
| Android tablet | Chrome, current stable | Responsive emulation and available real device |
| Windows/macOS | Firefox, current stable | Automated critical-journey coverage |
| ChromeOS | Chrome, current stable | Desktop Chromium coverage and manual smoke test |

Tier 2 visual defects may be accepted when the complete draft workflow remains
correct and usable. Correctness, authorization, and data-loss defects still
block release.

## Unsupported

- Internet Explorer
- Browsers without JavaScript or WebSocket support
- Embedded in-app browsers unless separately qualified
- Browser versions outside the policy above

Unsupported clients must not be relied upon for commissioner operation.

## Responsive Validation

Validate at representative small-phone, large-phone, tablet portrait, tablet
landscape, laptop, and desktop sizes. Review:

- Horizontal draft-board navigation and sticky labels
- Fixed mobile pick action and safe-area insets
- Pick modal scrolling, search, focus, and virtual keyboard interaction
- Timer readability and expired state
- Team setup, invitations, assignment selectors, and commissioner controls
- Text scaling, keyboard navigation, touch targets, and orientation changes
- Offline, reconnecting, recovered, and error states

Browser emulation is a fast regression layer, not a replacement for real iOS
Safari and Android Chrome validation.

## Validation Record

Each release candidate should record the device or emulator, operating-system
version, browser version, orientation, test date, result, and issue links. The
first complete matrix will be established during the mobile-validation phase of
Milestone 4A.
