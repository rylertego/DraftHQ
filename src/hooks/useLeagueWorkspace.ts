"use client";

import { useCallback, useEffect, useState } from "react";
import { getLeagueWorkspace } from "@/lib/leagueApi";
import type { LeagueWorkspace } from "@/types/league";

export function useLeagueWorkspace(slug: string) {
  const [workspace, setWorkspace] = useState<LeagueWorkspace | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    void getLeagueWorkspace(slug)
      .then((result) => {
        if (active) setWorkspace(result);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the league."
          );
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

  return { workspace, error, isLoading, reload };
}
