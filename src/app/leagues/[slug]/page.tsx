import LeagueHome from "./LeagueHome";

interface LeagueHomePageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeagueHomePage({ params }: LeagueHomePageProps) {
  const { slug } = await params;
  return <LeagueHome slug={slug} />;
}
