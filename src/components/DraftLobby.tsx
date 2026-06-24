"use client";

import Link from "next/link";
import type { Draft, DraftParticipant, Team } from "@/types/draft";

interface DraftLobbyProps {
  draft: Draft;
  participants: DraftParticipant[];
  teams: Team[];
  onlineUserIds: string[];
  currentUserId: string;
  leagueLogoUrl?: string;
  isCommissioner: boolean;
  allTeamsAssigned: boolean;
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
  isCommissioner,
  allTeamsAssigned,
  isStarting,
  onStart,
}: DraftLobbyProps) {
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
          href={isCommissioner ? `/teams?draftId=${draft.id}` : "/dashboard"}
          className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← {isCommissioner ? "Back to Setup" : "Leave"}
        </Link>
        <span className="rounded-full border border-teal-800/60 bg-teal-950/60 px-3 py-1 text-xs font-semibold text-teal-400">
          {onlineCount} online
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        {isCommissioner && (
          <button
            type="button"
            disabled={isStarting || !allTeamsAssigned}
            onClick={onStart}
            className="mb-2 rounded-xl bg-teal-500 px-10 py-3 text-sm font-extrabold uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-teal-900/40 hover:bg-teal-400 disabled:opacity-50 transition-colors"
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
          {draft.name}
        </h1>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
          {year} Draft
        </p>

        {!allTeamsAssigned && isCommissioner && (
          <p className="mt-2 rounded-xl border border-yellow-700/50 bg-yellow-950/40 px-4 py-2 text-sm text-yellow-400">
            Assign an owner to every team before starting.
          </p>
        )}
      </div>

      {/* Lobby roster */}
      <div className="w-full max-w-2xl border-t border-white/5 px-6 py-6">
        <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
          In the Lobby · {draft.teamCount} Teams
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {participantsWithTeam.map((p) => (
            <div
              key={p.id}
              className={[
                "flex items-center gap-2 rounded-xl border px-3 py-2",
                p.isSelf
                  ? "border-teal-700/60 bg-teal-950/40"
                  : "border-slate-700/60 bg-slate-900/40",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  p.isOnline ? "bg-teal-400" : "bg-slate-600",
                ].join(" ")}
              />
              <span className="text-sm font-medium text-white">
                {p.displayName}
                {p.isSelf && (
                  <span className="ml-1 text-xs font-normal text-teal-400">(you)</span>
                )}
              </span>
              {p.teamName && (
                <span className="ml-1 text-xs text-slate-500">{p.teamName}</span>
              )}
            </div>
          ))}
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
