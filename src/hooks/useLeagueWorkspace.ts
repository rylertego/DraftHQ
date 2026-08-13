"use client";

import { useCallback, useEffect, useState } from "react";
import { getLeagueWorkspace } from "@/lib/leagueApi";
import { classifyLeagueLoadError, type LeagueAccessFailure } from "@/lib/leagueAccess";
import type { LeagueWorkspace } from "@/types/league";

export function useLeagueWorkspace(slug: string) {
  const [workspace, setWorkspace] = useState<LeagueWorkspace | null>(null);
  const [error, setError] = useState("");
  // Why it failed, not just that it did — an unauthorized visitor needs a
  // different screen from a network blip.
  const [failure, setFailure] = useState<LeagueAccessFailure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    void getLeagueWorkspace(slug)
      .then((result) => {
        if (active) {
          setWorkspace(result);
          setError("");
          setFailure(null);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the league."
          );
          setFailure(classifyLeagueLoadError(loadError));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug, rev]);

  const reload = useCallback(() => setRev((r) => r + 1), []);

  return { workspace, error, failure, isLoading, reload };
}
