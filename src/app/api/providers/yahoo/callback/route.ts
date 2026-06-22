import { cookies } from "next/headers";
import { exchangeYahooCode, type YahooTokens } from "@/lib/providers/yahoo";

const DONE_HTML = (message: string, isError: boolean) => `<!doctype html>
<html><body><script>
  var payload = ${JSON.stringify({ type: "yahoo_oauth_done", error: isError ? message : null })};
  if (window.opener) {
    window.opener.postMessage(payload, window.location.origin);
    window.close();
  } else {
    document.body.innerText = ${JSON.stringify(isError ? "Error: " + message : "Connected. You may close this window.")};
  }
</script></body></html>`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const html = (msg: string, isError: boolean) =>
    new Response(DONE_HTML(msg, isError), {
      headers: { "Content-Type": "text/html" },
    });

  if (oauthError) {
    return html(`Yahoo declined the request: ${oauthError}`, true);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("yahoo_oauth_state")?.value;

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return html("OAuth state mismatch. Please try again.", true);
  }

  cookieStore.delete("yahoo_oauth_state");

  let tokens: YahooTokens;
  try {
    tokens = await exchangeYahooCode(code);
  } catch (exchangeError) {
    const message =
      exchangeError instanceof Error ? exchangeError.message : "Token exchange failed.";
    return html(message, true);
  }

  cookieStore.set("yahoo_tokens", JSON.stringify(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });

  return html("Connected.", false);
}
