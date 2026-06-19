import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable."
  );
}

try {
  const url = new URL(supabaseUrl);
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isAllowedProtocol =
    url.protocol === "https:" || (url.protocol === "http:" && isLoopback);

  if (!isAllowedProtocol) {
    throw new Error("Supabase URL must use HTTPS unless it is local.");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Invalid URL.";
  throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${message}`);
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
