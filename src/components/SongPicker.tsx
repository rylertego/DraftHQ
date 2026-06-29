"use client";
import { useState, useEffect, useRef } from "react";
import type { WalkUpSong } from "@/types/draft";
import { isSpotifyConnected } from "@/lib/spotifyAuth";
import { useLeagueTheme } from "@/context/LeagueThemeContext";

interface SearchResult {
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  url: string;
  previewUrl?: string | null;
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDv(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return dv;
}

const YoutubeLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
  </svg>
);

const SpotifyLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

interface Props {
  onSelect: (song: WalkUpSong) => void;
  onClose: () => void;
}

export default function SongPicker({ onSelect, onClose }: Props) {
  const { accentColor } = useLeagueTheme();
  const spotifyFirst = isSpotifyConnected();
  const [tab, setTab] = useState<"youtube" | "spotify">(spotifyFirst ? "spotify" : "youtube");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    setLoading(true); setError("");
    const endpoint = tab === "youtube" ? "/api/music/youtube-search" : "/api/music/spotify-search";
    fetch(`${endpoint}?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((d: { results?: SearchResult[]; error?: string }) => {
        if (d.error) setError(d.error);
        else setResults(d.results ?? []);
      })
      .catch(() => setError("Search failed"))
      .finally(() => setLoading(false));
  }, [debouncedQuery, tab]);

  function handleSelect(r: SearchResult) {
    const base = { platform: tab as "youtube" | "spotify", trackId: r.trackId, url: r.url, title: r.title, artist: r.artist, thumbnail: r.thumbnail, previewUrl: r.previewUrl };
    if (tab === "spotify") {
      const q = encodeURIComponent(`${r.title} ${r.artist ?? ""}`.trim());
      fetch(`/api/music/youtube-search?q=${q}`)
        .then((res) => res.json() as Promise<{ results?: Array<{ trackId: string }> }>)
        .then(({ results }) => { onSelect({ ...base, youtubeTrackId: results?.[0]?.trackId ?? null }); })
        .catch(() => { onSelect({ ...base, youtubeTrackId: null }); });
    } else {
      onSelect(base);
    }
  }

  const tabs = spotifyFirst
    ? [{ id: "spotify" as const, label: "Spotify", Icon: SpotifyLogo }, { id: "youtube" as const, label: "YouTube", Icon: YoutubeLogo }]
    : [{ id: "youtube" as const, label: "YouTube", Icon: YoutubeLogo }];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold text-white">Add a Walk-Up Song</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => { setTab(id); setQuery(""); setResults([]); setError(""); }}
                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors"
                style={active ? { color: accentColor, borderBottom: `2px solid ${accentColor}` } : { color: "#94a3b8" }}
              >
                <Icon />
                {label}
              </button>
            );
          })}
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={inputRef}
            type="text"
            placeholder={`Search ${tab === "youtube" ? "YouTube" : "Spotify"}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2"
            style={{ ["--tw-ring-color" as string]: accentColor }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}40`)}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "")}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
            {loading && (
              <div className="flex items-center justify-center py-8 text-slate-500 text-sm">Searching…</div>
            )}
            {!loading && results.length === 0 && debouncedQuery && !error && (
              <div className="flex items-center justify-center py-8 text-slate-500 text-sm">No results</div>
            )}
            {results.filter((r) => r.trackId).map((r, i) => (
              <button
                key={r.trackId ?? i}
                onClick={() => handleSelect(r)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
              >
                {r.thumbnail ? (
                  <img src={r.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{r.title}</p>
                  <p className="truncate text-xs text-slate-400">{r.artist}</p>
                </div>
                <div className="shrink-0 rounded-full p-1.5" style={{ background: `${accentColor}20`, color: accentColor }}>
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                    <path d="M2 2l8 4-8 4V2z"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
