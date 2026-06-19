import JoinDraftForm from "../JoinDraftForm";

interface JoinDraftLinkPageProps {
  params: Promise<{
    joinCode: string;
  }>;
}

export default async function JoinDraftLinkPage({
  params,
}: JoinDraftLinkPageProps) {
  const { joinCode } = await params;

  return <JoinDraftForm initialJoinCode={joinCode} />;
}
