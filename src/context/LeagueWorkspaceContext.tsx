"use client";

import { createContext, useContext } from "react";
import type { LeagueAccessFailure } from "@/lib/leagueAccess";
import type { LeagueWorkspace } from "@/types/league";

interface LeagueWorkspaceContextValue {
  workspace: LeagueWorkspace | null;
  isLoading: boolean;
  error: string;
  /** Why the load failed, when it did. Null while loading or on success. */
  failure: LeagueAccessFailure | null;
  reload: () => void;
}

export const LeagueWorkspaceContext = createContext<LeagueWorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(LeagueWorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside LeagueWorkspaceContext");
  return ctx;
}
