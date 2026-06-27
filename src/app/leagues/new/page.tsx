"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createLeague } from "@/lib/leagueApi";

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsCreating(true);
    try {
      const league = await createLeague({ name, slug });
      router.push(`/leagues/${league.slug}/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create league.");
      setIsCreating(false);
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-950 px-4 py-20">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-white">Create League</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          A persistent home for your seasons and drafts.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
              htmlFor="league-name"
            >
              League Name
            </label>
            <input
              id="league-name"
              autoFocus
              required
              maxLength={100}
              className="w-full"
              placeholder="The Brotherhood of Champions"
              value={name}
              onChange={(e) => updateName(e.target.value)}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
              htmlFor="league-slug"
            >
              URL Slug
            </label>
            <input
              id="league-slug"
              required
              minLength={3}
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className="w-full font-mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
            <p className="mt-1.5 text-xs text-slate-600">
              drafthq.app/leagues/
              <span className="text-slate-400">{slug || "your-league"}</span>
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isCreating}
            className="w-full rounded-xl bg-teal-500 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors"
          >
            {isCreating ? "Creating..." : "Create League"}
          </button>
        </form>
      </div>
    </main>
  );
}
