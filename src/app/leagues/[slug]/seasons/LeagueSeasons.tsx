"use client";

import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";
import {
  Alert,
  EmptyState,
  LinkButton,
  Panel,
  Section,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import type { LeagueSeason } from "@/types/league";

// One definition of the row geometry, shared by the header and every row. Two
// copies drift — the teams table and the members list both did, and in both
// cases an `auto` track sized to each grid's own content so the columns quietly
// disagreed. Every track here is fixed or fractional for that reason.
const SEASON_GRID =
  "grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem_9rem_6rem_11rem]";

function providerLabel(season: LeagueSeason) {
  return season.sleeperLeagueId ? "Sleeper" : "Manual";
}

function draftStateLabel(season: LeagueSeason) {
  if (!season.draft) return "No draft";
  if (season.draft.status === "setup") return "Pre-draft";
  if (season.draft.status === "active") return "Live";
  if (season.draft.status === "paused") return "Paused";
  return "Complete";
}

export default function LeagueSeasons({ slug }: { slug: string }) {
  const { workspace, error, isLoading } = useLeagueWorkspace(slug);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--space-3)]" aria-label="Loading seasons">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="row" label={i === 0 ? "Loading seasons" : undefined} />
        ))}
      </div>
    );
  }

  if (error || !workspace) {
    return <Alert status="danger">{error || "League not found."}</Alert>;
  }

  const { seasons, canManage } = workspace;

  return (
    <Section
      title="Seasons"
      actions={
        canManage ? (
          <LinkButton href={`/leagues/${slug}/seasons/new`} variant="primary" scope="league">
            New Season
          </LinkButton>
        ) : undefined
      }
    >
      {seasons.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-[color:var(--color-border-strong)]">
          <EmptyState
            title="No seasons yet"
            description="A season holds a draft and the standings that follow it. Create one to get started."
            action={
              canManage ? (
                <LinkButton href={`/leagues/${slug}/seasons/new`} variant="primary" scope="league">
                  Create the first season
                </LinkButton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <Panel>
          <div
            className={`hidden border-b border-[color:var(--color-border-subtle)] pb-[var(--space-2)] text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] md:grid ${SEASON_GRID}`}
          >
            <span>Season</span>
            <span>Source</span>
            <span>Draft</span>
            <span>Teams</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="flex flex-col">
            {seasons.map((season) => (
              <article
                key={season.id}
                className={`items-center border-b border-[color:var(--color-border-subtle)] py-[var(--space-3)] last:border-b-0 ${SEASON_GRID}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-[color:var(--color-text-primary)]">{season.name}</p>
                  <p className="text-xs capitalize text-[color:var(--color-text-muted)]">{season.status}</p>
                </div>

                <span className="text-sm text-[color:var(--color-text-secondary)]">
                  {providerLabel(season)}
                </span>

                <span>
                  <StatusBadge
                    status={
                      season.draft?.status === "active"
                        ? "success"
                        : season.draft?.status === "paused"
                          ? "warning"
                          : season.draft
                            ? "info"
                            : "neutral"
                    }
                    dot={season.draft?.status === "active"}
                  >
                    {draftStateLabel(season)}
                  </StatusBadge>
                </span>

                <span className="text-sm tabular-nums text-[color:var(--color-text-secondary)]">
                  {season.draft ? season.draft.teamCount : "—"}
                </span>

                <div className="flex justify-start md:justify-end">
                  {season.draft ? (
                    <LinkButton
                      href={
                        season.draft.status === "setup"
                          ? `/teams?draftId=${season.draft.id}&tab=settings&leagueSlug=${slug}`
                          : `/draft?draftId=${season.draft.id}&leagueSlug=${slug}`
                      }
                      variant="secondary"
                      scope="league"
                    >
                      {season.draft.status === "setup" ? "Configure Draft" : "Open Draft"}
                    </LinkButton>
                  ) : (
                    <span className="text-sm text-[color:var(--color-text-muted)]">No draft yet</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </Section>
  );
}
