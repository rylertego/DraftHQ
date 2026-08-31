import MyTeamForm from "./MyTeamForm";

export default async function MyTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ teamId?: string }>;
}) {
  const { slug } = await params;
  const { teamId } = await searchParams;
  return <MyTeamForm slug={slug} teamId={teamId ?? null} />;
}
