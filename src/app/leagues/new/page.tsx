"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createLeague } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user || data.user.is_anonymous) {
        router.replace("/login");
        return;
      }
      setIsCheckingAccount(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  function updateName(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    try {
      const league = await createLeague({ name, slug });
      router.push(`/leagues/${league.slug}/settings`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create the league."
      );
      setIsCreating(false);
    }
  }

  if (isCheckingAccount) {
    return <main className="mx-auto max-w-2xl p-8">Checking your account...</main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Create League</h1>
      <p className="mb-6 text-gray-400">
        Create the persistent identity that future drafts can share.
      </p>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block" htmlFor="league-name">
            League Name
          </label>
          <input
            id="league-name"
            required
            maxLength={100}
            className="w-full rounded border p-2"
            value={name}
            onChange={(event) => updateName(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="league-slug">
            League URL Slug
          </label>
          <input
            id="league-slug"
            required
            minLength={3}
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="w-full rounded border p-2"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
          />
          <p className="mt-1 text-sm text-gray-500">/leagues/{slug || "your-league"}</p>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isCreating}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "Create League"}
        </button>
      </form>
    </main>
  );
}
