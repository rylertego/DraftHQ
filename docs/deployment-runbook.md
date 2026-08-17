# DraftHQ Deployment Runbook

_Last updated: 2026-08-13. Production domain: **drafthq.net**._

Six systems have to agree on one URL and one sending identity. This records what
they are, how they connect, and the failure each one produces when it drifts —
because every one of these fails *quietly*.

---

## The one rule

`NEXT_PUBLIC_SITE_URL` is the spine. Supabase's redirect allowlist, the Spotify
redirect URI, and every link in outgoing email are all derived from or compared
against it. Change it in one place and the other three must follow.

**No trailing slash.** Several call sites build URLs by concatenation, so
`https://drafthq.net/` yields `//spotify-callback`.

**It is `NEXT_PUBLIC_*`, so it is inlined at build time.** Editing it in Vercel
without redeploying changes nothing. This looks exactly like "the fix didn't
work".

---

## 1. Vercel

**Domains:** `drafthq.net` (primary) + `www.drafthq.net` redirecting to it. DNS
lives at Cloudflare.

**Environment variables (Production):**

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://drafthq.net` | Build-time. Redeploy after changing. |
| `RESEND_FROM` | `DraftHQ <noreply@drafthq.net>` | Runtime. Still needs a redeploy to apply. |
| `SUPABASE_SECRET_KEY` | — | Server-only. **Never** prefix with `NEXT_PUBLIC_`. |
| `RANKINGS_SYNC_SECRET` | — | Without it the sync endpoint 503s and ADP never lands. |
| `OPENAI_API_KEY` | — | Optional. Only used by `/api/announcer/speak`, which is disabled. |
| `NEXT_PUBLIC_AI_ANNOUNCER_ENABLED` | unset | Set to `true` to enable AI announcers. |

Env changes only apply to **new** deployments. Always redeploy.

---

## 2. Supabase — auth redirects

Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://drafthq.net`
- **Redirect URLs:** `https://drafthq.net/**` and `http://localhost:3000/**`

**Failure mode:** invitation and password-reset links verify at Supabase, then
refuse to redirect and dead-end. The email arrives and looks perfect. This is the
step most likely to be forgotten because nothing fails until a real user clicks.

> League invites are Supabase auth links: `…supabase.co/auth/v1/verify?token=…&redirect_to=<site>/dashboard?invitation=…`.
> The Supabase URL in the email is expected, not a bug.

---

## 3. Resend — transactional email

Domain `drafthq.net` is **verified** (DKIM on the root, SPF via MX + TXT on the
`send` subdomain, DMARC `p=none`). Provider: Cloudflare, region us-east-1.

`RESEND_FROM` must be an address on that verified domain. The code default is
Resend's shared sandbox sender, `onboarding@resend.dev`.

> **The sandbox sender only delivers to your own account email.** Everything else
> returns **403** — and the API routes log the error but still return success, so
> the app reports the invite as sent. Every league invitation to anyone else
> failed silently this way until 2026-08-13. If invites "work for you but nobody
> else gets them", this is why.

`noreply@drafthq.net` is valid even though SPF sits on `send.drafthq.net` — that
subdomain is only the bounce/Return-Path. DKIM on the root authorizes the From.

Check **Resend → Logs** after any send. Delivery failures appear there, not in
the app.

**Receiving:** leave Resend's "Enable Receiving" off. Use Cloudflare Email
Routing to forward `hello@drafthq.net` to a real inbox. Do not let it overwrite
the `send` MX record Resend added.

---

## 4. Spotify

Developer Dashboard → app → Redirect URIs: `https://drafthq.net/spotify-callback`.

The code builds this from `NEXT_PUBLIC_SITE_URL` and Spotify compares it
**literally** — any mismatch fails with `INVALID_CLIENT`.

Worth knowing: search runs on app **client credentials**, so any owner can pick
songs without connecting Spotify. Only *playback* uses a per-user OAuth token and
needs Premium, on whichever device is playing. Owners on phones need nothing.

---

## 5. Database migrations

> **`supabase_migrations.schema_migrations` is empty.** Everything to date was
> applied by pasting into the SQL editor, so `list_migrations` reports nothing
> and the CLI would think the database is virgin. **Do not run `supabase db push`
> without thinking hard first.**

Verify deployment by probing for the actual column, bucket, function, or policy —
never by trusting that table.

---

## Order of operations

DNS at Cloudflare → Vercel domain verifies → `NEXT_PUBLIC_SITE_URL` → Supabase
redirect allowlist → Spotify URI → Resend last (DNS propagation is slowest).
**Redeploy at the end.**

## The single test that proves the whole chain

Send a league invitation **to an address that is not your Resend account email**,
from production.

That exercises `RESEND_FROM` on the verified domain, the invite link built from
`NEXT_PUBLIC_SITE_URL`, and Supabase accepting the redirect — in one action. Then
confirm a **200** in Resend → Logs and click the link through to the dashboard.

Testing with your own address proves almost nothing: the sandbox sender delivers
to you even when it is misconfigured for everyone else.
