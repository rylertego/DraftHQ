import { redirect } from "next/navigation";

// Forward Spotify's redirect to the API route handler, which can modify cookies
export default async function SpotifyCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams(params).toString();
  redirect(`/api/music/spotify-callback?${qs}`);
}
