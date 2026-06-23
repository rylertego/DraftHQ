import LeagueMembers from "./LeagueMembers";

export default async function LeagueMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LeagueMembers slug={slug} />;
}
