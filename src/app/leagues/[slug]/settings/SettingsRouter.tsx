"use client";

import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import LeagueSettingsForm from "./LeagueSettingsForm";
import MemberSettings from "./MemberSettings";

/**
 * Settings means two different things depending on who is asking.
 *
 * A commissioner configures the league. A member has exactly one setting that
 * is theirs — whether they are in it. Showing the commissioner's form to a
 * member, even read-only, would repeat the mistake the owner dashboard was
 * built to fix: a screen of controls belonging to someone else.
 */
export default function SettingsRouter({ slug }: { slug: string }) {
  const { workspace, isLoading } = useWorkspace();

  // The workspace layout renders the access-denied screen when this fails, so
  // there is nothing to handle here beyond waiting for the role to be known.
  if (!workspace) return isLoading ? null : null;

  return workspace.canManage ? <LeagueSettingsForm slug={slug} /> : <MemberSettings />;
}
