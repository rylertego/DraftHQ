"use client";

import { useState } from "react";
import type { DraftGradeReport, PickGrade, TeamGrade } from "@/lib/draftGrading";

// Post-draft grade board: every team with its overall grade, and every pick
// with the reasoning behind its score. Read-only.

const GRADE_TONES: Record<string, [string, string]> = {
  A: ["#10b98126", "#34d399"],
  B: ["#3b82f626", "#60a5fa"],
  C: ["#f59e0b26", "#fbbf24"],
  D: ["#ef444426", "#f87171"],
  F: ["#ef444433", "#fca5a5"],
};

function gradeStyle(grade: string) {
  const [backgroundColor, color] = GRADE_TONES[grade[0]] ?? ["#94a3b826", "#cbd5e1"];
  return { backgroundColor, color };
}

function GradeChip({ grade, size = "sm" }: { grade: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`shrink-0 rounded-lg text-center font-black tabular-nums ${
        size === "lg" ? "w-16 py-1.5 text-xl" : "w-11 py-1 text-sm"
      }`}
      style={gradeStyle(grade)}
    >
      {grade}
    </span>
  );
}

function PickRow({ pick, accent }: { pick: PickGrade; accent: string }) {
  const [open, setOpen] = useState(false);
  const hasDetail = pick.positives.length > 0 || pick.concerns.length > 0;

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-slate-600">
          {pick.round}.{String(pick.overallPickNumber).padStart(2, "0")}
        </span>
        <span className="w-10 shrink-0 text-[11px] font-black" style={{ color: accent }}>
          {pick.playerPosition}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {pick.playerName}
        </span>
        {pick.valueDelta !== null && (
          <span
            className="hidden shrink-0 text-xs tabular-nums sm:inline"
            style={{ color: pick.valueDelta >= 0 ? "#34d399" : "#f87171" }}
          >
            {pick.valueDelta >= 0 ? "+" : ""}{Math.round(pick.valueDelta)}
          </span>
        )}
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-500">
          {pick.score}
        </span>
        <GradeChip grade={pick.grade} />
        {hasDetail && (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className={`h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 pl-[5.5rem]">
          <p className="text-sm leading-relaxed text-slate-300">{pick.summary}</p>
          {pick.positives.length > 0 && (
            <ul className="mt-2 space-y-1">
              {pick.positives.map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-emerald-400">
                  <span aria-hidden>+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {pick.concerns.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {pick.concerns.map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-amber-400">
                  <span aria-hidden>−</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, accent }: { team: TeamGrade; accent: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        {team.teamLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.teamLogoUrl} alt="" className="h-12 w-12 shrink-0 object-contain" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-slate-300">
            {team.teamName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-white">{team.teamName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{team.summary}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Picks</p>
          <p className="text-sm font-bold tabular-nums text-slate-400">{team.pickScore}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Roster</p>
          <p className="text-sm font-bold tabular-nums text-slate-400">{team.constructionScore}</p>
        </div>
        <GradeChip grade={team.grade} size="lg" />
      </button>

      {open && (
        <div className="border-t border-white/8">
          {(team.strengths.length > 0 || team.weaknesses.length > 0) && (
            <div className="grid gap-3 border-b border-white/5 px-5 py-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Strengths</p>
                {team.strengths.length > 0 ? (
                  <ul className="space-y-0.5">
                    {team.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-slate-300">{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-600">None identified.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Concerns</p>
                {team.weaknesses.length > 0 ? (
                  <ul className="space-y-0.5">
                    {team.weaknesses.map((s, i) => (
                      <li key={i} className="text-xs text-slate-300">{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-600">None identified.</p>
                )}
              </div>
            </div>
          )}
          <div>
            {team.picks.map((p) => (
              <PickRow key={p.pickId} pick={p} accent={accent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DraftGradesBoard({
  report,
  accentColor,
}: {
  report: DraftGradeReport;
  accentColor: string | null;
}) {
  const accent = accentColor ?? "var(--color-league-accent)";

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h2 className="text-lg font-black uppercase tracking-wide text-white">Draft Grades</h2>
          <p className="mt-1 text-xs text-slate-500">
            Graded on the decisions as they looked at the time — value against the market, roster
            need, positional scarcity, player caliber, and roster fit. Tap a team to see every pick.
          </p>
        </div>

        {report.dataNotes.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
              About these grades
            </p>
            <ul className="mt-1.5 space-y-1">
              {report.dataNotes.map((note, i) => (
                <li key={i} className="text-xs leading-relaxed text-amber-200/80">{note}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2.5 pb-8">
          {report.teams.map((team) => (
            <TeamCard key={team.teamId} team={team} accent={accent} />
          ))}
        </div>
      </div>
    </div>
  );
}
