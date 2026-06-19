import DraftRoom from "./DraftRoom";

interface DraftBoardPageProps {
  searchParams: Promise<{
    draftId?: string | string[];
  }>;
}

export default async function DraftBoardPage({
  searchParams,
}: DraftBoardPageProps) {
  const draftIdParam = (await searchParams).draftId;
  const draftId = typeof draftIdParam === "string" ? draftIdParam : null;

  return <DraftRoom draftId={draftId} />;
}
