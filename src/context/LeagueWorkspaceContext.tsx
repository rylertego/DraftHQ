"use client";

import { createContext, useContext } from "react";
import type { LeagueWorkspace } from "@/types/league";

interface LeagueWorkspaceContextValue {
  workspace: LeagueWorkspace | null;
  isLoading: boolean;
  error: string;
  reload: () => void;
}

export const LeagueWorkspaceContext = createContext<LeagueWorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(LeagueWorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside LeagueWorkspaceContext");
  return ctx;
}
