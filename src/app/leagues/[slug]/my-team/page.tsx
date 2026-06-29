import MyTeamForm from "./MyTeamForm";

export default async function MyTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MyTeamForm slug={slug} />;
}
