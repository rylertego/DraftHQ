import DraftRoom from "./DraftRoom";

interface DraftBoardPageProps {
  searchParams: Promise<{
    draftId?: string | string[];
    leagueSlug?: string | string[];
  }>;
}

export default async function DraftBoardPage({
  searchParams,
}: DraftBoardPageProps) {
  const params = await searchParams;
  const draftId = typeof params.draftId === "string" ? params.draftId : null;
  const leagueSlug = typeof params.leagueSlug === "string" ? params.leagueSlug : null;

  return <DraftRoom draftId={draftId} leagueSlug={leagueSlug} />;
}
