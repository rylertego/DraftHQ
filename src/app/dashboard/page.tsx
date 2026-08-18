"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLeague, getMyLeagueWorkspaces } from "@/lib/leagueApi";
import type { LeagueSeason, LeagueWorkspace } from "@/types/league";
import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageShell,
  Panel,
  Section,
  Skeleton,
} from "@/components/ui";
import DraftHQMark from "@/components/brand/DraftHQMark";

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
  if (season.status === "drafting") return { label: "Draft scheduled", dot: "bg-[var(--color-product-accent-hover)]" };
  if (season.status === "active") return { label: "In season", dot: "bg-[var(--color-product-accent-hover)]" };
  if (season.draft?.scheduledAt) {
    const d = new Date(season.draft.scheduledAt);
    const label = `Draft On: ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    return { label, dot: "bg-[var(--color-product-accent)]" };
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
    // The row is a role="link" that navigates on click and on Enter/Space.
    // Without stopping propagation here, opening this menu also navigated into
    // the league — the menu appeared and vanished in one gesture.
    // preventDefault alone does not do it: it cancels the default action, not
    // the bubble up to the row handler.
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`relative transition-opacity ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
    >
      <button
        type="button"
        aria-label="League options"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
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
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/leagues/${leagueSlug}/settings`); }}
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
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete(); }}
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
  const router = useRouter();
  const { label, dot } = draftStatusLabel(season);
  const league = workspace.league;
  const memberCount = workspace.members.length;
  const draft = season.draft;
  const role = workspace.canManage ? "Commissioner" : "Member";
  const myTeam = workspace.myTeam;
  const leagueHref = `/leagues/${league.slug}`;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(leagueHref)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(leagueHref); }}
      className={`group flex cursor-pointer items-center gap-5 border-b border-slate-800 px-6 py-5 hover:bg-slate-800/40 transition-colors last:border-b-0 ${isFirst ? "rounded-t-xl" : ""} ${isLast ? "rounded-b-xl" : ""}`}
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
        <p className="text-lg font-bold text-white group-hover:text-[color:var(--color-product-accent-hover)] transition-colors truncate">
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
          {/* Badge budget: only mark the exception. "Commissioner" says
              something; "Member" is the default state and just added a second
              role tag to every row. */}
          {workspace.canManage && (
            <span className="flex items-center gap-1.5 font-semibold text-[color:var(--color-product-accent)]">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <path d="M8 2l1.5 3H13l-2.75 2 1 3.5L8 8.75 4.75 10.5l1-3.5L3 5h3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              {role}
            </span>
          )}
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
          <svg className="h-4 w-4 text-slate-700 group-hover:text-[color:var(--color-product-accent)] transition-colors" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
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
    <Dialog
      open
      onClose={onCancel}
      size="small"
      title={`Delete “${workspace.league.name}”?`}
      description="This will permanently delete the league, all seasons, and all associated drafts. This cannot be undone."
      initialFocusRef={inputRef}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={isDeleting}
            disabled={confirm !== "DELETE"}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? "Deleting..." : "Delete League"}
          </Button>
        </>
      }
    >
      <Field label="Type DELETE to confirm" controlId="dashboard-delete-confirm">
        <Input
          ref={inputRef}
          type="text"
          maxLength={10}
          placeholder="DELETE"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleDelete(); }}
        />
      </Field>

      {error && <Alert status="danger">{error}</Alert>}
    </Dialog>
  );
}

// A nav row, not a button: these are destinations, and three identical centred
// buttons said nothing about which was which. The icon carries the accent so
// the panel has some colour without the whole row being tinted.
function QuickAction({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-product-accent-border)] hover:bg-[var(--color-surface-3)] hover:text-[color:var(--color-text-primary)]"
    >
      <svg className="h-4 w-4 shrink-0 text-[color:var(--color-product-accent)]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {children}
      </svg>
      {label}
    </Link>
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
    <PageShell width="workspace">
      {error && (
        <div className="mb-[var(--space-5)]">
          <Alert status="danger">{error}</Alert>
        </div>
      )}

      <div className="grid gap-[var(--space-6)] lg:grid-cols-[1fr_280px]">
        {/* ── Main column ── */}
        <div>
          {isLoading ? (
            <div className="flex flex-col gap-[var(--space-3)]">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} height="row" label={i === 0 ? "Loading leagues" : undefined} />
              ))}
            </div>
          ) : (
            <Section title="Leagues" actions={
              <LinkButton href="/leagues/new" variant="primary" scope="product">
                + Create League
              </LinkButton>
            }>
              {currentRows.length === 0 ? (
                // A dashed placeholder surface, not bare text on the canvas: EmptyState is
                // designed to sit inside a container and reads as an unfinished page
                // without one.
                <div className="rounded-[var(--radius-panel)] border border-dashed border-[color:var(--color-border-strong)] bg-[var(--color-surface-1)]/40">
                <EmptyState
                  identity={<DraftHQMark className="h-12 w-auto opacity-40" title="" />}
                  title="You don't have any leagues yet."
                  description="Create a new league, or join one with an invite."
                  action={
                    <>
                      <LinkButton href="/leagues/new" variant="primary" scope="product">
                        Create League
                      </LinkButton>
                      <LinkButton href="/create" variant="secondary" scope="product">
                        Standalone Draft
                      </LinkButton>
                      <LinkButton href="/join" variant="tertiary" scope="product">
                        Join with an invite
                      </LinkButton>
                    </>
                  }
                />
              </div>
              ) : (
                <div className="rounded-[var(--radius-panel)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-1)]">
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
            </Section>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="flex flex-col gap-[var(--space-4)]">
          <Panel title="Quick actions">
            <div className="flex flex-col gap-[var(--space-2)]">
              <QuickAction href="/leagues/new" label="New League">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </QuickAction>
              <QuickAction href="/create" label="Standalone Draft">
                <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </QuickAction>
              <QuickAction href="/join" label="Join a Draft">
                <path d="M2 8h9M8 5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 3h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </QuickAction>
            </div>
          </Panel>

          <Panel title="VPNs can disrupt drafts">
            <p className="text-xs leading-relaxed text-[color:var(--color-text-secondary)]">
              If you&apos;re using a VPN, disable it during your draft — VPNs can cause
              connection drops and real-time sync issues.
            </p>
          </Panel>
        </aside>
      </div>

      {deleteTarget && (
        <DeleteLeagueModal
          workspace={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </PageShell>
  );
}
