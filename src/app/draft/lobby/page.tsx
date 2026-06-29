import DraftRoom from "../DraftRoom";

interface DraftLobbyPageProps {
  searchParams: Promise<{
    draftId?: string | string[];
    leagueSlug?: string | string[];
  }>;
}

export default async function DraftLobbyPage({ searchParams }: DraftLobbyPageProps) {
  const params = await searchParams;
  const draftId = typeof params.draftId === "string" ? params.draftId : null;
  const leagueSlug = typeof params.leagueSlug === "string" ? params.leagueSlug : null;

  return <DraftRoom draftId={draftId} leagueSlug={leagueSlug} lobbyOnly />;
}
