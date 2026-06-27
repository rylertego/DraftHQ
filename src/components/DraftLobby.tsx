"use client";

import Link from "next/link";
import type { Draft, DraftParticipant, Team } from "@/types/draft";
import { useLeagueTheme } from "@/context/LeagueThemeContext";

interface DraftLobbyProps {
  draft: Draft;
  participants: DraftParticipant[];
  teams: Team[];
  onlineUserIds: string[];
  currentUserId: string;
  leagueLogoUrl?: string;
  leagueName?: string;
  leagueSlug?: string;
  isCommissioner: boolean;
  isStarting: boolean;
  onStart: () => void;
}

function ShieldLogo({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="League logo" className="h-28 w-28 rounded-full object-cover drop-shadow-2xl ring-4 ring-teal-800/40" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/branding/logo-Photoroom.png" alt="DraftHQ" className="h-40 w-auto drop-shadow-2xl" />
  );
}

export default function DraftLobby({
  draft,
  participants,
  teams,
  onlineUserIds,
  currentUserId,
  leagueLogoUrl,
  leagueName,
  leagueSlug,
  isCommissioner,
  isStarting,
  onStart,
}: DraftLobbyProps) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const year = new Date(draft.createdAt).getFullYear();

  const participantsWithTeam = participants.map((p) => {
    const team = teams.find((t) => t.id === p.teamId);
    const isOnline = onlineUserIds.includes(p.userId);
    const isSelf = p.userId === currentUserId;
    return { ...p, teamName: team?.name ?? null, isOnline, isSelf };
  });

  const onlineCount = participantsWithTeam.filter((p) => p.isOnline).length;

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center overflow-y-auto"
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #0d2626 0%, #030f0f 55%, #020617 100%)",
      }}
    >
      {/* Top bar */}
      <div className="flex w-full items-center justify-between px-6 pt-5 pb-2">
        <Link
          href={
            isCommissioner
              ? `/teams?draftId=${draft.id}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`
              : leagueSlug
                ? `/leagues/${leagueSlug}`
                : "/dashboard"
          }
          className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← {isCommissioner ? "Back to Setup" : "Leave"}
        </Link>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: primary + "55", backgroundColor: primary + "15", color: primary }}>
          {onlineCount} online
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        {isCommissioner && (
          <button
            type="button"
            disabled={isStarting}
            onClick={onStart}
            className="mb-2 rounded-xl px-10 py-3 text-sm font-extrabold uppercase tracking-[0.2em] shadow-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: primary, color: secondary }}
          >
            {isStarting ? "Starting..." : "Start Draft"}
          </button>
        )}

        {!isCommissioner && (
          <p className="mb-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-5 py-2 text-sm text-slate-400">
            Waiting for the commissioner to start the draft...
          </p>
        )}

        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
          Welcome to the
        </p>

        <ShieldLogo logoUrl={leagueLogoUrl} />

        <h1 className="mt-2 text-4xl font-extrabold uppercase tracking-widest text-white drop-shadow-lg sm:text-5xl">
          {leagueName ?? draft.name}
        </h1>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
          {draft.name}
        </p>

      </div>

      {/* Lobby roster */}
      <div className="w-full max-w-3xl border-t border-white/5 px-6 py-6">
        <p className="mb-5 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
          In the Lobby · {draft.teamCount} Teams
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {participantsWithTeam.map((p) => {
            const initials = p.displayName.charAt(0).toUpperCase();
            return (
              <div
                key={p.id}
                className="flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center"
                style={p.isSelf
                  ? { borderColor: primary + "55", backgroundColor: primary + "12" }
                  : { borderColor: "rgba(100,116,139,0.25)", backgroundColor: "rgba(15,23,42,0.4)" }
                }
              >
                {/* Avatar with online indicator */}
                <div className="relative">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold"
                    style={{
                      backgroundColor: primary + "22",
                      color: primary,
                      boxShadow: p.isSelf ? `0 0 0 2px ${primary}` : "none",
                    }}
                  >
                    {initials}
                  </div>
                  <span
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-[#020617]"
                    style={{ backgroundColor: p.isOnline ? primary : "#475569" }}
                  />
                </div>
                {/* Name */}
                <div className="min-w-0 w-full">
                  <p className="truncate text-sm font-semibold text-white">
                    {p.displayName}
                    {p.isSelf && <span className="ml-1 text-xs font-normal" style={{ color: primary }}>(you)</span>}
                  </p>
                  {p.teamName
                    ? <p className="truncate text-xs text-slate-500">{p.teamName}</p>
                    : <p className="text-xs text-slate-600 italic">No team</p>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isCommissioner && (
        <div className="pb-20 text-center">
          <p className="text-xs text-slate-600">
            Join code:{" "}
            <span className="font-mono font-bold text-slate-400">{draft.joinCode}</span>
          </p>
        </div>
      )}
    </div>
  );
}
