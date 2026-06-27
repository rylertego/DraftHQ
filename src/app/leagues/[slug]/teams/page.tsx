import LeagueTeams from "./LeagueTeams";

export default async function LeagueTeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LeagueTeams slug={slug} />;
}
