"use client";
import { useEffect } from "react";

export default function SpotifyPopupCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("spotify_access_token");
    const refresh_token = params.get("spotify_refresh_token");
    const expires_in = params.get("spotify_expires_in");

    if (access_token && refresh_token && window.opener) {
      window.opener.postMessage(
        { type: "spotify-auth-success", access_token, refresh_token, expires_in: Number(expires_in ?? 3600) },
        window.location.origin
      );
    }
    window.close();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className="text-slate-400 text-sm">Connecting to Spotify…</p>
    </div>
  );
}
