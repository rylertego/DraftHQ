import { supabase } from "@/lib/supabase";
import type { ProviderLeaguePreview } from "@/lib/providers/types";

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in with a persistent account to import leagues.");
  return token;
}

async function fetchPreview(
  url: string,
  extraHeaders: Record<string, string> = {}
): Promise<ProviderLeaguePreview> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
  });
  const body = (await response.json()) as { preview?: ProviderLeaguePreview; error?: string };
  if (!response.ok || body.error) {
    throw new Error(body.error ?? "Preview failed.");
  }
  if (!body.preview) throw new Error("No preview data returned.");
  return body.preview;
}

export async function getEspnLeaguePreview(input: {
  leagueId: string;
  year: string;
  espnS2?: string;
  swid?: string;
}): Promise<ProviderLeaguePreview> {
  const params = new URLSearchParams({ leagueId: input.leagueId, year: input.year });
  const headers: Record<string, string> = {};
  if (input.espnS2) headers["x-espn-s2"] = input.espnS2;
  if (input.swid) headers["x-espn-swid"] = input.swid;
  return fetchPreview(`/api/providers/espn/preview?${params.toString()}`, headers);
}

export async function getFleaflickerLeaguePreview(input: {
  leagueId: string;
}): Promise<ProviderLeaguePreview> {
  const params = new URLSearchParams({ leagueId: input.leagueId });
  return fetchPreview(`/api/providers/fleaflicker/preview?${params.toString()}`);
}

export async function getMflLeaguePreview(input: {
  leagueId: string;
  year: string;
  apiKey?: string;
}): Promise<ProviderLeaguePreview> {
  const params = new URLSearchParams({ leagueId: input.leagueId, year: input.year });
  if (input.apiKey) params.set("apiKey", input.apiKey);
  return fetchPreview(`/api/providers/mfl/preview?${params.toString()}`);
}
