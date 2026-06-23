import LeagueSeasons from "./LeagueSeasons";

export default async function LeagueSeasonsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LeagueSeasons slug={slug} />;
}
