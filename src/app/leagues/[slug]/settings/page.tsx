import LeagueSettingsForm from "./LeagueSettingsForm";

interface LeagueSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeagueSettingsPage({
  params,
}: LeagueSettingsPageProps) {
  const { slug } = await params;
  return <LeagueSettingsForm slug={slug} />;
}
