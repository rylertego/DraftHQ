import TeamSetupForm from "./TeamSetupForm";

interface TeamSetupPageProps {
  searchParams: Promise<{
    draftId?: string | string[];
  }>;
}

export default async function TeamSetupPage({
  searchParams,
}: TeamSetupPageProps) {
  const draftIdParam = (await searchParams).draftId;
  const draftId = typeof draftIdParam === "string" ? draftIdParam : null;

  return <TeamSetupForm draftId={draftId} />;
}
