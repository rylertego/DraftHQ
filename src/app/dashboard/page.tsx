"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLeague, getMyLeagueWorkspaces } from "@/lib/leagueApi";
import type { LeagueSeason, LeagueWorkspace } from "@/types/league";

const CURRENT_YEAR = new Date().getFullYear();

interface SeasonRow {
  workspace: LeagueWorkspace;
  season: LeagueSeason;
}

function groupByYear(workspaces: LeagueWorkspace[]): Map<number, SeasonRow[]> {
  const map = new Map<number, SeasonRow[]>();
  for (const workspace of workspaces) {
    if (workspace.seasons.length === 0) {
      const rows = map.get(CURRENT_YEAR) ?? [];
      rows.push({ workspace, season: { id: "", leagueId: workspace.league.id, year: CURRENT_YEAR, name: workspace.league.name, status: "upcoming", draftId: null, draft: null, sleeperLeagueId: null, championTeamId: null, sleeperSyncedAt: null, standings: [] } });
      map.set(CURRENT_YEAR, rows);
    } else {
      for (const season of workspace.seasons) {
        const rows = map.get(season.year) ?? [];
        rows.push({ workspace, season });
        map.set(season.year, rows);
      }
    }
  }
  return map;
}

function draftStatusLabel(season: LeagueSeason): { label: string; dot: string } {
  const ds = season.draft?.status;
  if (ds === "active") return { label: "Draft live now", dot: "bg-green-400 animate-pulse" };
  if (ds === "paused") return { label: "Draft paused", dot: "bg-yellow-400" };
  if (ds === "complete" || season.status === "complete") return { label: "Season complete", dot: "bg-slate-600" };
  if (season.status === "drafting") return { label: "Draft scheduled", dot: "bg-teal-400" };
  if (season.status === "active") return { label: "In season", dot: "bg-teal-400" };
  if (season.draft?.scheduledAt) {
    const d = new Date(season.draft.scheduledAt);
    const label = `Draft On: ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    return { label, dot: "bg-teal-500" };
  }
  return { label: "Upcoming", dot: "bg-slate-700" };
}

// ── Per-row context menu ──────────────────────────────────────────────────────
function LeagueRowMenu({ onDelete, leagueSlug }: { onDelete: () => void; leagueSlug: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`relative transition-opacity ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
    >
      <button
        type="button"
        aria-label="League options"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-700 hover:text-white transition-colors"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
          <circle cx="8" cy="3" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="13" r="1.2" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] w-48 rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-2xl shadow-black/60 text-sm">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); router.push(`/leagues/${leagueSlug}/settings`); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 16 16" fill="none">
              <path d="M2 14l1-4L11 2l3 3-8 8-4 1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit Settings
          </button>
          <hr className="border-slate-800" />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete league
          </button>
        </div>
      )}
    </div>
  );
}

// ── League row ────────────────────────────────────────────────────────────────
function LeagueRow({ workspace, season, onDeleteClick, isFirst, isLast }: SeasonRow & { onDeleteClick?: () => void; isFirst?: boolean; isLast?: boolean }) {
  const { label, dot } = draftStatusLabel(season);
  const league = workspace.league;
  const memberCount = workspace.members.length;
  const draft = season.draft;
  const role = workspace.canManage ? "Commissioner" : "Member";
  const myTeam = workspace.myTeam;

  return (
    <Link
      href={`/leagues/${league.slug}`}
      className={`group flex items-center gap-5 border-b border-slate-800 px-6 py-5 hover:bg-slate-800/40 transition-colors last:border-b-0 ${isFirst ? "rounded-t-xl" : ""} ${isLast ? "rounded-b-xl" : ""}`}
    >
      {/* Logo */}
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-slate-800 shadow-lg">
        {league.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={league.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl font-black text-slate-400">{league.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors truncate">
          {league.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
          {draft && (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Regular Draft
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <circle cx="6" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2 13c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="11" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10 9.1c.32-.07.65-.1 1-.1 2.21 0 4 1.79 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
          {draft?.rounds && (
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {draft.rounds} rounds
            </span>
          )}
          <span className={`flex items-center gap-1.5 font-semibold ${workspace.canManage ? "text-teal-400" : "text-slate-400"}`}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 2l1.5 3H13l-2.75 2 1 3.5L8 8.75 4.75 10.5l1-3.5L3 5h3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            {role}
          </span>
          {myTeam && (
            <Link
              href={`/leagues/${league.slug}/my-team`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Team Owner
            </Link>
          )}
        </div>
      </div>

      {/* Status + menu */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {label}
        </span>
        {onDeleteClick && (
          <LeagueRowMenu onDelete={onDeleteClick} leagueSlug={league.slug} />
        )}
        {!onDeleteClick && (
          <svg className="h-4 w-4 text-slate-700 group-hover:text-teal-500 transition-colors" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </Link>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteLeagueModal({
  workspace, onCancel, onDeleted,
}: { workspace: LeagueWorkspace; onCancel: () => void; onDeleted: (id: string) => void }) {
  const [confirm, setConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  async function handleDelete() {
    if (confirm !== "DELETE") return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteLeague(workspace.league.id);
      onDeleted(workspace.league.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete league.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-950/60">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-white">Delete &ldquo;{workspace.league.name}&rdquo;?</h2>
            <p className="mt-1 text-sm text-slate-400">
              This will permanently delete the league, all seasons, and all associated drafts. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type <span className="font-mono text-red-400">DELETE</span> to confirm
          </label>
          <input
            ref={inputRef}
            type="text"
            maxLength={10}
            className="w-full"
            placeholder="DELETE"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleDelete(); }}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={confirm !== "DELETE" || isDeleting}
            className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isDeleting ? "Deleting..." : "Delete League"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<LeagueWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LeagueWorkspace | null>(null);

  useEffect(() => {
    let active = true;
    void getMyLeagueWorkspaces()
      .then((results) => { if (active) setWorkspaces(results); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Unable to load leagues."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  function handleDeleted(leagueId: string) {
    setWorkspaces((prev) => prev.filter((w) => w.league.id !== leagueId));
    setDeleteTarget(null);
  }

  const byYear = groupByYear(workspaces);
  if (!byYear.has(CURRENT_YEAR)) byYear.set(CURRENT_YEAR, []);
  const currentRows = byYear.get(CURRENT_YEAR) ?? [];

  return (
    <div className="flex-1">
      <div className="px-6 py-8">

        {error && (
          <div className="mb-6 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">

          {/* ── Main column ── */}
          <div className="space-y-8">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-800/50" />
                ))}
              </div>
            ) : (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Leagues</h2>
                  <Link
                    href="/leagues/new"
                    className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors"
                  >
                    + Create League
                  </Link>
                </div>

                {currentRows.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
                    <p className="font-semibold text-white">You don&apos;t have any leagues yet.</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create a new league or{" "}
                      <Link href="/join" className="text-teal-400 underline hover:text-teal-300">
                        join one with an invite
                      </Link>
                      .
                    </p>
                    <div className="mt-5 flex items-center justify-center gap-3">
                      <Link
                        href="/leagues/new"
                        className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors"
                      >
                        Create League
                      </Link>
                      <Link
                        href="/create"
                        className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Standalone Draft
                      </Link>
                    </div>
                  </div>
                )}

                {currentRows.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900">
                    {currentRows.map((row, i) => (
                      <LeagueRow
                        key={`${row.workspace.league.id}-${row.season.id}`}
                        {...row}
                        isFirst={i === 0}
                        isLast={i === currentRows.length - 1}
                        onDeleteClick={row.workspace.canManage ? () => setDeleteTarget(row.workspace) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm font-bold text-white">Quick actions</p>
              <div className="mt-3 space-y-2">
                <Link
                  href="/leagues/new"
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 hover:border-teal-600 hover:bg-teal-950/20 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4 text-teal-400" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  New League
                </Link>
                <Link
                  href="/create"
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 hover:border-teal-600 hover:bg-teal-950/20 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4 text-teal-400" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Standalone Draft
                </Link>
                <Link
                  href="/join"
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 hover:border-teal-600 hover:bg-teal-950/20 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4 text-teal-400" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8h9M8 5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 3h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Join a Draft
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm font-bold text-white">VPNs can disrupt drafts</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                If you&apos;re using a VPN, disable it during your draft — VPNs can cause connection drops and real-time sync issues.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {deleteTarget && (
        <DeleteLeagueModal
          workspace={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
