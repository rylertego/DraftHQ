# Email Invitations

Commissioners can invite owners by email from team setup. The browser sends its
Supabase access token to a Next.js Route Handler, which verifies commissioner
ownership before using the server-only Supabase secret to send an Auth invite.

The secret key is never sent to the browser. Configure these variables in local
and deployment environments:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=your-secret-key
```

Add the corresponding join URL pattern to the Supabase Auth redirect allow list.
For local development, allow `http://localhost:3000/**`. Configure the deployed
application origin before sending production invitations.

Invitations are recorded in `draft_invitations`. When an invited email accepts
the Auth invite and submits the existing join form, a database trigger marks the
matching invitation accepted. The commissioner can then assign that participant
to a team.

Supabase's default email service is rate limited and intended for development.
Configure custom SMTP before using invitations for a production draft.
