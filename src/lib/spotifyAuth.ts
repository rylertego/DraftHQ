"use client";

export function initiateSpotifyPopup(onSuccess: () => void): void {
  const w = 500, h = 700;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;
  const popupReturn = `${window.location.origin}/spotify-popup-callback`;
  const popup = window.open(
    `/api/music/spotify-auth?returnTo=${encodeURIComponent(popupReturn)}`,
    "spotify-auth",
    `width=${w},height=${h},left=${left},top=${top},popup=1`
  );

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function cleanup() {
    window.removeEventListener("message", onMessage);
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null; }
  }

  function onMessage(e: MessageEvent) {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type !== "spotify-auth-success") return;
    cleanup();
    const { access_token, refresh_token, expires_in } = e.data as { access_token: string; refresh_token: string; expires_in: number };
    localStorage.setItem("spotify_access_token", access_token);
    localStorage.setItem("spotify_refresh_token", refresh_token);
    localStorage.setItem("spotify_token_expiry", String(Date.now() + expires_in * 1000));
    onSuccess();
  }

  window.addEventListener("message", onMessage);

  // Remove the listener if the popup is closed without completing auth
  if (popup) {
    pollTimer = setInterval(() => {
      if (popup.closed) cleanup();
    }, 500);
  }
}

/** Called once after full-page OAuth redirect — reads tokens from URL fragment. */
export function consumeSpotifyCallback(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.slice(1);
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const token = params.get("spotify_access_token");
  const refresh = params.get("spotify_refresh_token");
  const expiresIn = params.get("spotify_expires_in");
  if (!token || !refresh) return false;
  localStorage.setItem("spotify_access_token", token);
  localStorage.setItem("spotify_refresh_token", refresh);
  localStorage.setItem("spotify_token_expiry", String(Date.now() + Number(expiresIn ?? 3600) * 1000));
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

export async function getSpotifyToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("spotify_access_token");
  const expiry = Number(localStorage.getItem("spotify_token_expiry") ?? 0);
  if (token && Date.now() < expiry - 60_000) return token;

  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/music/spotify-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) { disconnectSpotify(); return null; }
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
    localStorage.setItem("spotify_access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
    localStorage.setItem("spotify_token_expiry", String(Date.now() + data.expires_in * 1000));
    return data.access_token;
  } catch {
    return null;
  }
}

export function isSpotifyConnected() {
  return typeof window !== "undefined" && !!localStorage.getItem("spotify_access_token");
}

export function disconnectSpotify() {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_token_expiry");
}
