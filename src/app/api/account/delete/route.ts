import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Deletes the caller's account: app data first via delete_my_account(), then
// the auth.users row via the admin API.
//
// The order is deliberate. Removing the login first would leave orphaned rows
// with no way for the user to reach them again — the opposite of what someone
// asking for deletion wants. If the RPC fails, we stop and the account is
// still intact and usable.
//
// The identity comes from the bearer token, never from the request body, so
// this endpoint can only ever delete the caller.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return Response.json({ error: "Sign in to delete your account." }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user;

  if (userError || !user) {
    return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  // Anonymous draft guests have no account to delete.
  if (user.is_anonymous) {
    return Response.json({ error: "Guest sessions have no account to delete." }, { status: 400 });
  }

  if (!supabaseUrl || !publishableKey) {
    return Response.json({ error: "Server is misconfigured." }, { status: 500 });
  }

  // Run the cleanup as the user so auth.uid() inside the RPC resolves to them
  // and its own ownership guard applies.
  const asUser = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error: cleanupError } = await asUser.rpc("delete_my_account");

  if (cleanupError) {
    // 22023 is the league-owner refusal, which is the user's to resolve.
    const status = cleanupError.code === "22023" ? 409 : 400;
    return Response.json(
      { error: cleanupError.message || "Could not delete your account." },
      { status }
    );
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (authError) {
    // App data is gone but the login remains. Say so plainly rather than
    // reporting success — this needs a human to finish.
    return Response.json(
      {
        error:
          "Your league data was removed, but the login could not be deleted. Contact privacy@drafthq.net to finish.",
      },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
