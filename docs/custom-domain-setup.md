# Custom domain setup — drafthq.net

The code changes for the domain are already merged (see "What the repo now does"
below). Everything remaining is dashboard work that has to be done by hand.

Do the steps in order: DNS first, then Supabase, then Resend. Auth emails will
point at the wrong host until Supabase is updated, so don't announce the domain
before step 2 is done.

## 1. Vercel — attach the domain

1. Project → **Settings → Domains → Add**, enter `drafthq.net`.
2. Add `www.drafthq.net` as well and set it to **redirect to `drafthq.net`**
   (or the reverse — just pick one canonical host and make it match
   `NEXT_PUBLIC_SITE_URL` exactly).
3. Vercel shows the DNS records to create at your registrar. **Use the values on
   that domain card, not values copied from a blog post** — apex A records and
   CNAME targets are now assigned per project (e.g. `216.198.79.1` or
   `xyz.vercel-dns-017.com`), and the older `76.76.21.21` /
   `cname.vercel-dns.com` pair is legacy.
   - Apex `drafthq.net` → **A** record (apex domains cannot use CNAME).
   - `www` → **CNAME** to the target shown.
4. Wait for the domain card to go green. TLS is provisioned automatically once
   DNS resolves.
5. **Settings → Environment Variables**, set for Production:
   - `NEXT_PUBLIC_SITE_URL=https://drafthq.net`
   - `RESEND_FROM=DraftHQ <noreply@drafthq.net>` — **only after step 3 below**.
6. Redeploy. `NEXT_PUBLIC_*` values are inlined at build time, so an existing
   deployment will keep using the old origin until it is rebuilt.

Keep `draft-hq.vercel.app` working; it stays as a fallback host.

## 2. Supabase — auth URLs (project `kogyejhzzggrkekbcppm`)

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://drafthq.net`
- **Redirect URLs** (allow-list, exact matches):
  - `https://drafthq.net/**`
  - `https://www.drafthq.net/**`
  - `https://draft-hq.vercel.app/**` (keep while the fallback host is live)
  - `http://localhost:3000/**` (local dev)

This matters because `generateLink` calls in
`src/app/api/auth/reset-password/route.ts` and
`src/app/api/leagues/[leagueId]/members/route.ts` pass a `redirectTo`. Supabase
silently falls back to the Site URL when `redirectTo` is not on the allow-list,
so a missing entry shows up as "password reset link sends me to the wrong site"
rather than as an error.

Signup confirmation emails are sent by Supabase itself and build their links
from Site URL, so step 2 alone fixes those.

### Optional: custom auth email sender

Supabase's built-in auth email sender is rate-limited and sends from a Supabase
address. To send auth mail from `drafthq.net`, set **Project Settings → Auth →
SMTP Settings** to Resend's SMTP credentials (host `smtp.resend.com`, port 465,
user `resend`, password = a Resend API key) with sender
`noreply@drafthq.net`. Requires step 3 first.

## 3. Resend — verify the domain

Transactional mail (invites, password resets) goes through Resend, not Supabase.

1. Resend → **Domains → Add Domain** → `drafthq.net`.
2. Add the DKIM/SPF (and DMARC, if offered) records it lists at your registrar.
3. Wait for **Verified**.
4. Only then set `RESEND_FROM=DraftHQ <noreply@drafthq.net>` in Vercel and
   redeploy.

Until `RESEND_FROM` is set, the app sends from the shared
`onboarding@resend.dev` sender, which Resend only permits delivery to your own
account address — invites to other people will not arrive. Setting it before the
domain verifies makes Resend reject every send. So: verify, then flip the
variable.

## What the repo now does

- `src/lib/email.ts` exports `emailFrom()`, reading `RESEND_FROM` and defaulting
  to the resend.dev sender. All three Resend call sites use it.
- `src/lib/emailTemplates.ts` builds the email logo URL from
  `https://drafthq.net` instead of the old `draft-hq.vercel.app`. This is a
  constant, not `NEXT_PUBLIC_SITE_URL`, because email clients fetch the image
  directly and must never be handed a localhost URL.
- `supabase/config.toml` lists the drafthq.net origins in
  `additional_redirect_urls`. That file configures the **local** stack only —
  the hosted project still needs step 2.
- `.env.example` documents `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, and
  `RESEND_FROM`.

## Verifying

After DNS is green and the redeploy finishes:

1. `https://drafthq.net` loads, and `www` redirects to it.
2. Sign up with a fresh address — the confirmation link points at `drafthq.net`.
3. Request a password reset — the email arrives, the link lands on
   `https://drafthq.net/reset-password`, and the reset completes.
4. Send a team invite to an address you control — check the `From` header is
   `noreply@drafthq.net` and the join link uses `drafthq.net`.
