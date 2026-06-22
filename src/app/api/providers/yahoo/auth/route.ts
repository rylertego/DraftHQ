import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildYahooAuthUrl } from "@/lib/providers/yahoo";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user || data.user.is_anonymous) {
    return Response.json(
      { error: "A persistent commissioner account is required." },
      { status: 401 }
    );
  }

  // State encodes the Supabase user ID so the callback can verify the same user
  // completed the OAuth flow.
  const state = Buffer.from(
    JSON.stringify({ userId: data.user.id, nonce: crypto.randomUUID() })
  ).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set("yahoo_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  try {
    const authUrl = buildYahooAuthUrl(state);
    return Response.json({ authUrl });
  } catch (buildError) {
    return Response.json(
      {
        error:
          buildError instanceof Error
            ? buildError.message
            : "Yahoo OAuth is not configured.",
      },
      { status: 500 }
    );
  }
}
