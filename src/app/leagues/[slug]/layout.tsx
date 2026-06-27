import WorkspaceLayoutClient from "./WorkspaceLayoutClient";

export default async function LeagueWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <WorkspaceLayoutClient slug={slug}>{children}</WorkspaceLayoutClient>;
}
