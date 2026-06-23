import NewSeasonForm from "./NewSeasonForm";

export default async function NewSeasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <NewSeasonForm slug={slug} />;
}
