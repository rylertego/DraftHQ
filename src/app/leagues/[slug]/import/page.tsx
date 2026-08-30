import LeagueImportSetup from "./LeagueImportSetup";

export default async function LeagueImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LeagueImportSetup slug={slug} />;
}
