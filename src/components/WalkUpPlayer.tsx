"use client";
import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import type { WalkUpSong } from "@/types/draft";
import { getSpotifyToken } from "@/lib/spotifyAuth";

export interface WalkUpPlayerHandle {
  play: (song: WalkUpSong, playbackOffsetSeconds?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  duck: () => void;
  unduck: () => void;
  setVolume: (v: number) => void; // 0–100
}

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number }) => void;
            onError?: () => void;
          };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifySDKPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  stopVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
  destroy: () => void;
}

interface SpotifyPlaybackState {
  paused?: boolean;
  position?: number;
  duration?: number;
}

interface SpotifySDKPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (state: ({ device_id?: string } & SpotifyPlaybackState) | null) => void) => void;
  removeListener: (event: string) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  setVolume: (v: number) => Promise<void>;
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id; s.src = src; s.async = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

const DUCK_VOLUME = 8;

interface WalkUpPlayerProps {
  onEnded?: () => void;
  onPlaying?: () => void;
  onPlaybackBlocked?: () => void;
}

const WalkUpPlayer = forwardRef<WalkUpPlayerHandle, WalkUpPlayerProps>(function WalkUpPlayer({ onEnded, onPlaying, onPlaybackBlocked }, ref) {
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytReadyRef = useRef(false);
  const ytReadyToPlayRef = useRef(false); // true only after onReady fires
  const pendingSongRef = useRef<WalkUpSong | null>(null); // queued if YT not ready yet
  const spSDKPlayerRef = useRef<SpotifySDKPlayer | null>(null);
  const spDeviceIdRef = useRef<string | null>(null);
  const currentPlatformRef = useRef<"youtube" | "spotify-sdk" | "preview" | null>(null);
  const spPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(55);
  const playbackStartedRef = useRef(false);
  const activeRef = useRef(true);
  const playbackRequestRef = useRef(0);
  const spotifyPlayAbortRef = useRef<AbortController | null>(null);
  const onEndedRef = useRef(onEnded);
  const onPlayingRef = useRef(onPlaying);
  const onPlaybackBlockedRef = useRef(onPlaybackBlocked);

  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onPlayingRef.current = onPlaying; }, [onPlaying]);
  useEffect(() => { onPlaybackBlockedRef.current = onPlaybackBlocked; }, [onPlaybackBlocked]);

  // ── YouTube setup ──────────────────────────────────────────────────────
  const initYT = useCallback(() => {
    if (!activeRef.current || ytReadyRef.current || !ytContainerRef.current) return;
    ytReadyRef.current = true;
    ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
      videoId: "",
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0 },
      events: {
        onReady: (e) => {
          if (!activeRef.current) { e.target.destroy(); return; }
          ytPlayerRef.current = e.target;
          ytReadyToPlayRef.current = true;
          // Play any song that was requested before the player finished loading
          const pending = pendingSongRef.current;
          if (pending) {
            pendingSongRef.current = null;
            const videoId = pending.platform === "youtube" ? pending.trackId : pending.youtubeTrackId!;
            e.target.loadVideoById({ videoId, startSeconds: pending.startSeconds ?? 0 });
            e.target.setVolume(volumeRef.current);
          }
        },
        onStateChange: (e) => {
          if (e.data === 1) {
            playbackStartedRef.current = true;
            onPlayingRef.current?.();
          }
          if (e.data === 0 && playbackStartedRef.current) onEndedRef.current?.();
        },
        onError: () => onPlaybackBlockedRef.current?.(),
      },
    });
  }, []);

  useEffect(() => {
    const prev = window.onYouTubeIframeAPIReady;
    const onReady = () => { prev?.(); initYT(); };
    window.onYouTubeIframeAPIReady = onReady;
    if (window.YT?.Player) { initYT(); }
    else { void loadScript("https://www.youtube.com/iframe_api", "yt-iframe-api"); }
    return () => {
      if (window.onYouTubeIframeAPIReady === onReady) window.onYouTubeIframeAPIReady = prev;
    };
  }, [initYT]);

  // ── Spotify Web Playback SDK setup ─────────────────────────────────────
  useEffect(() => {
    const initSDK = () => {
      if (!activeRef.current || spSDKPlayerRef.current) return;
      const player = new window.Spotify.Player({
        name: "DraftHQ Walk-Up Player",
        getOAuthToken: (cb) => {
          void getSpotifyToken().then((token) => { if (activeRef.current && token) cb(token); });
        },
        volume: volumeRef.current / 100,
      });
      player.addListener("ready", (state) => {
        if (state?.device_id) spDeviceIdRef.current = state.device_id;
      });
      player.addListener("not_ready", () => { spDeviceIdRef.current = null; });
      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        if (!state.paused) {
          playbackStartedRef.current = true;
          onPlayingRef.current?.();
        }
        if (playbackStartedRef.current && state.paused && state.position === 0 && (state.duration ?? 0) > 0) onEndedRef.current?.();
      });
      void player.connect();
      spSDKPlayerRef.current = player;
    };

    const prev = window.onSpotifyWebPlaybackSDKReady;
    const onReady = () => { prev?.(); initSDK(); };
    window.onSpotifyWebPlaybackSDKReady = onReady;

    void loadScript("https://sdk.scdn.co/spotify-player.js", "spotify-sdk").then(() => {
      if (window.Spotify?.Player) initSDK();
    });

    return () => {
      if (window.onSpotifyWebPlaybackSDKReady === onReady) window.onSpotifyWebPlaybackSDKReady = prev;
      void spSDKPlayerRef.current?.pause().catch(() => {});
      spSDKPlayerRef.current?.disconnect();
      spSDKPlayerRef.current = null;
    };
  }, []);

  const stopAll = useCallback(() => {
    playbackRequestRef.current += 1;
    spotifyPlayAbortRef.current?.abort();
    spotifyPlayAbortRef.current = null;
    try { ytPlayerRef.current?.stopVideo(); } catch {}
    void spSDKPlayerRef.current?.pause().catch(() => {});
    if (spPreviewAudioRef.current) { spPreviewAudioRef.current.pause(); spPreviewAudioRef.current.currentTime = 0; }
    pendingSongRef.current = null;
    currentPlatformRef.current = null;
  }, []);

  const pause = useCallback(() => {
    try { ytPlayerRef.current?.pauseVideo(); } catch {}
    void spSDKPlayerRef.current?.pause().catch(() => {});
    spPreviewAudioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    if (currentPlatformRef.current === "youtube") {
      try { ytPlayerRef.current?.playVideo(); } catch { onPlaybackBlockedRef.current?.(); }
    } else if (currentPlatformRef.current === "spotify-sdk") {
      void spSDKPlayerRef.current?.resume().catch(() => onPlaybackBlockedRef.current?.());
    } else if (currentPlatformRef.current === "preview") {
      void spPreviewAudioRef.current?.play().then(() => onPlayingRef.current?.()).catch(() => onPlaybackBlockedRef.current?.());
    }
  }, []);

  const playYT = useCallback((videoId: string, startSeconds: number) => {
    const yt = ytPlayerRef.current;
    if (!yt || !ytReadyToPlayRef.current) return false;
    yt.loadVideoById({ videoId, startSeconds });
    yt.setVolume(volumeRef.current);
    return true;
  }, []);

  const play = useCallback((song: WalkUpSong, playbackOffsetSeconds = 0) => {
    if (!activeRef.current) return;
    stopAll();
    const requestId = playbackRequestRef.current;
    playbackStartedRef.current = false;
    const startSeconds = Math.max(0, (song.startSeconds ?? 0) + playbackOffsetSeconds);
    currentPlatformRef.current = song.platform === "spotify" ? "spotify-sdk" : song.platform as "youtube" | "preview";

    if (song.platform === "youtube" || (song.platform === "spotify" && song.youtubeTrackId && !spDeviceIdRef.current)) {
      const videoId = song.platform === "youtube" ? song.trackId : song.youtubeTrackId!;
      currentPlatformRef.current = "youtube";
      if (!playYT(videoId, startSeconds)) {
        // YT player not ready yet — queue the song; onReady will pick it up
        pendingSongRef.current = { ...song, startSeconds };
      }
      return;
    }

    if (song.platform === "spotify") {
      if (spDeviceIdRef.current) {
        currentPlatformRef.current = "spotify-sdk";
        const deviceId = spDeviceIdRef.current;
        void getSpotifyToken().then(async (token) => {
          if (!activeRef.current || requestId !== playbackRequestRef.current) return;
          if (!token) { playSpotifyFallback(song, playbackOffsetSeconds, requestId); return; }
          const controller = new AbortController();
          spotifyPlayAbortRef.current = controller;
          const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              uris: [`spotify:track:${song.trackId}`],
              position_ms: startSeconds * 1000,
            }),
          });
          if (spotifyPlayAbortRef.current === controller) spotifyPlayAbortRef.current = null;
          if (!activeRef.current || requestId !== playbackRequestRef.current) return;
          if (!res.ok) { playSpotifyFallback(song, playbackOffsetSeconds, requestId); }
          else {
            playbackStartedRef.current = true;
            onPlayingRef.current?.();
          }
        }).catch(() => {
          if (activeRef.current && requestId === playbackRequestRef.current) {
            playSpotifyFallback(song, playbackOffsetSeconds, requestId);
          }
        });
        return;
      }

      // SDK not ready — try YouTube cross-search result
      if (song.youtubeTrackId) {
        currentPlatformRef.current = "youtube";
        if (!playYT(song.youtubeTrackId, startSeconds)) {
          pendingSongRef.current = { ...song, startSeconds };
        }
        return;
      }

      playSpotifyFallback(song, playbackOffsetSeconds, requestId);
    }
  }, [stopAll, playYT]);

  function playSpotifyFallback(song: WalkUpSong, playbackOffsetSeconds = 0, requestId = playbackRequestRef.current) {
    const playPreview = (url: string) => {
      if (!activeRef.current || requestId !== playbackRequestRef.current) return;
      currentPlatformRef.current = "preview";
      if (!spPreviewAudioRef.current || spPreviewAudioRef.current.src !== url) {
        spPreviewAudioRef.current = new Audio(url);
        spPreviewAudioRef.current.loop = false;
        spPreviewAudioRef.current.onended = () => onEndedRef.current?.();
      }
      spPreviewAudioRef.current.volume = volumeRef.current / 100;
      const beginPlayback = () => {
        if (!activeRef.current || requestId !== playbackRequestRef.current) return undefined;
        const duration = spPreviewAudioRef.current?.duration;
        const requestedTime = Math.max(0, (song.startSeconds ?? 0) + playbackOffsetSeconds);
        if (spPreviewAudioRef.current) {
          spPreviewAudioRef.current.currentTime = duration && Number.isFinite(duration)
            ? Math.min(requestedTime, Math.max(0, duration - 0.1))
            : requestedTime;
        }
        return spPreviewAudioRef.current?.play();
      };
      const playback = spPreviewAudioRef.current.readyState >= 1
        ? beginPlayback()
        : new Promise<void>((resolve, reject) => {
            spPreviewAudioRef.current!.addEventListener("loadedmetadata", () => {
              void beginPlayback()?.then(resolve).catch(reject);
            }, { once: true });
          });
      playback?.then(() => {
        playbackStartedRef.current = true;
        onPlayingRef.current?.();
      }).catch(() => onPlaybackBlockedRef.current?.());
    };

    if (song.previewUrl) { playPreview(song.previewUrl); return; }

    // Spotify iFrame embed API is shut down for third parties — nothing more to try
    fetch(`/api/music/spotify-preview?trackId=${encodeURIComponent(song.trackId)}`)
      .then((r) => r.json() as Promise<{ previewUrl: string | null }>)
      .then(({ previewUrl }) => {
        if (activeRef.current && requestId === playbackRequestRef.current && previewUrl) playPreview(previewUrl);
      })
      .catch(() => {});
  }

  const duck = useCallback(() => {
    const duckVolume = Math.min(DUCK_VOLUME, volumeRef.current);
    if (currentPlatformRef.current === "youtube") {
      try { ytPlayerRef.current?.setVolume(duckVolume); } catch {}
    } else if (currentPlatformRef.current === "preview") {
      if (spPreviewAudioRef.current) spPreviewAudioRef.current.volume = duckVolume / 100;
    } else if (currentPlatformRef.current === "spotify-sdk") {
      void spSDKPlayerRef.current?.setVolume(duckVolume / 100).catch(() => {});
    }
  }, []);

  const unduck = useCallback(() => {
    if (currentPlatformRef.current === "youtube") {
      try { ytPlayerRef.current?.setVolume(volumeRef.current); } catch {}
    } else if (currentPlatformRef.current === "preview") {
      if (spPreviewAudioRef.current) spPreviewAudioRef.current.volume = volumeRef.current / 100;
    } else if (currentPlatformRef.current === "spotify-sdk") {
      void spSDKPlayerRef.current?.setVolume(volumeRef.current / 100).catch(() => {});
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    if (currentPlatformRef.current === "youtube") {
      try { ytPlayerRef.current?.setVolume(v); } catch {}
    } else if (currentPlatformRef.current === "preview") {
      if (spPreviewAudioRef.current) spPreviewAudioRef.current.volume = v / 100;
    } else if (currentPlatformRef.current === "spotify-sdk") {
      void spSDKPlayerRef.current?.setVolume(v / 100).catch(() => {});
    }
  }, []);

  useImperativeHandle(ref, () => ({ play, pause, resume, stop: stopAll, duck, unduck, setVolume }), [play, pause, resume, stopAll, duck, unduck, setVolume]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      stopAll();
      try { ytPlayerRef.current?.destroy(); } catch {}
      ytPlayerRef.current = null;
      ytReadyToPlayRef.current = false;
      spSDKPlayerRef.current?.disconnect();
      spSDKPlayerRef.current = null;
      if (spPreviewAudioRef.current) {
        spPreviewAudioRef.current.pause();
        spPreviewAudioRef.current.removeAttribute("src");
        spPreviewAudioRef.current.load();
        spPreviewAudioRef.current = null;
      }
    };
  }, [stopAll]);

  return (
    <div aria-hidden className="pointer-events-none fixed" style={{ left: -9999, top: -9999 }}>
      <div ref={ytContainerRef} style={{ width: 1, height: 1, overflow: "hidden" }} />
    </div>
  );
});

export default WalkUpPlayer;
