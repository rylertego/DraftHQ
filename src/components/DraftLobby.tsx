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
      <div className="relative flex h-44 w-36 items-center justify-center">
        <svg viewBox="0 0 120 140" className="absolute inset-0 h-full w-full drop-shadow-2xl" aria-hidden>
          <path d="M60 4 L108 22 L108 84 Q108 120 60 138 Q12 120 12 84 L12 22 Z" fill="#15803d" />
          <path d="M60 12 L100 28 L100 84 Q100 116 60 132 Q20 116 20 84 L20 28 Z" fill="#16a34a" />
        </svg>
        <img
          src={logoUrl}
          alt="League logo"
          className="relative z-10 h-20 w-20 rounded-full object-cover"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 120 140" className="h-44 w-36 drop-shadow-2xl" aria-label="DraftHQ logo">
      {/* Outer shield */}
      <path d="M60 4 L108 22 L108 84 Q108 120 60 138 Q12 120 12 84 L12 22 Z" fill="#14532d" />
      {/* Inner shield */}
      <path d="M60 12 L100 28 L100 84 Q100 116 60 132 Q20 116 20 84 L20 28 Z" fill="#16a34a" />
      {/* Football shape */}
      <ellipse cx="60" cy="78" rx="22" ry="30" fill="none" stroke="white" strokeWidth="3" opacity="0.9" />
      {/* Center seam */}
      <line x1="60" y1="50" x2="60" y2="106" stroke="white" strokeWidth="2" opacity="0.85" />
      {/* Laces */}
      <line x1="51" y1="65" x2="69" y2="65" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      <line x1="51" y1="75" x2="69" y2="75" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      <line x1="51" y1="85" x2="69" y2="85" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
    </svg>
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
          "radial-gradient(ellipse at 50% 45%, #0d2d1a 0%, #030f07 55%, #020709 100%)",
      }}
    >
      {/* Top bar */}
      <div className="flex w-full items-center justify-between px-6 pt-5 pb-2">
        <Link
          href={isCommissioner ? `/teams?draftId=${draft.id}` : "/dashboard"}
          className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300"
        >
          ← {isCommissioner ? "Back to Setup" : "Leave"}
        </Link>
        <span className="rounded-full bg-green-900/60 px-3 py-1 text-xs font-semibold text-green-400">
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
            className="mb-2 rounded-lg bg-green-500 px-10 py-3 text-sm font-extrabold uppercase tracking-[0.2em] text-white shadow-lg shadow-green-900/60 hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            {isStarting ? "Starting..." : "Start Draft"}
          </button>
        )}

        {!isCommissioner && (
          <p className="mb-2 rounded-full bg-gray-800/60 px-5 py-2 text-sm text-gray-400">
            Waiting for the commissioner to start the draft...
          </p>
        )}

        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-gray-400">
          Welcome to the
        </p>

        <ShieldLogo logoUrl={leagueLogoUrl} />

        <h1 className="mt-2 text-4xl font-extrabold uppercase tracking-widest text-white drop-shadow-lg sm:text-5xl">
          {draft.name}
        </h1>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
          {year} Draft
        </p>

        {!allTeamsAssigned && isCommissioner && (
          <p className="mt-2 rounded border border-yellow-700/50 bg-yellow-950/40 px-4 py-2 text-sm text-yellow-400">
            Assign an owner to every team before starting.
          </p>
        )}
      </div>

      {/* Lobby roster */}
      <div className="w-full max-w-2xl border-t border-white/5 px-6 py-6">
        <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
          In the Lobby · {draft.teamCount} Teams
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {participantsWithTeam.map((p) => (
            <div
              key={p.id}
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                p.isSelf
                  ? "border-green-700/60 bg-green-950/40"
                  : "border-gray-700/60 bg-gray-900/40",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  p.isOnline ? "bg-green-400" : "bg-gray-600",
                ].join(" ")}
              />
              <span className="text-sm font-medium text-white">
                {p.displayName}
                {p.isSelf && (
                  <span className="ml-1 text-xs font-normal text-green-500">
                    (you)
                  </span>
                )}
              </span>
              {p.teamName && (
                <span className="ml-1 text-xs text-gray-500">{p.teamName}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Join code for commissioner */}
      {isCommissioner && (
        <div className="pb-20 text-center">
          <p className="text-xs text-gray-600">
            Join code:{" "}
            <span className="font-mono font-bold text-gray-400">
              {draft.joinCode}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
