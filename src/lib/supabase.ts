import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

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

let anonymousSignIn: Promise<User> | null = null;

export async function ensureAnonymousUser() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (sessionData.session?.user) {
    return sessionData.session.user;
  }

  if (!anonymousSignIn) {
    anonymousSignIn = supabase.auth.signInAnonymously().then(({ data, error }) => {
      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Supabase did not return an anonymous user.");
      }

      return data.user;
    });
  }

  try {
    return await anonymousSignIn;
  } finally {
    anonymousSignIn = null;
  }
}
