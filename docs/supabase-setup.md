# Supabase Setup

## Create a project

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. Open the project's **Connect** dialog or **API Keys** settings.
3. Copy the project URL and publishable key.

Use a publishable key (or the legacy `anon` key), never a `secret` or
`service_role` key, for variables prefixed with `NEXT_PUBLIC_`.

## Configure local development

Copy `.env.example` to `.env.local` and replace the placeholder values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Restart the Next.js development server after changing environment variables.
Next.js embeds `NEXT_PUBLIC_` variables in the browser bundle at build time.

## Configure deployment

Add the same two variables to the deployment environment before building the
application. Keep production and preview projects or keys separate when needed.

Database migrations live in `supabase/migrations/`. Apply them with the Supabase
CLI for a linked project, or paste the migration into the SQL editor while the
project is being bootstrapped.

Enable anonymous sign-ins under **Authentication > Providers > Anonymous**.
Anonymous users receive the authenticated database role and are still subject
to row-level security policies.

The current schema grants clients read-only access to rooms they belong to and
to the player catalog. Draft mutations will be added later as validated database
functions; do not add direct table write policies for browser clients.

The client validates these variables when `src/lib/supabase.ts` is imported.
Hosted project URLs must use HTTPS; HTTP is accepted only for local development.
