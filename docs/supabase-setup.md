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

Database migrations will live in `supabase/migrations/`. No schema migrations
have been added yet.

The client validates these variables when `src/lib/supabase.ts` is imported.
Hosted project URLs must use HTTPS; HTTP is accepted only for local development.
