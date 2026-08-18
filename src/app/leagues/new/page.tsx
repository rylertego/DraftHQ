"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createLeague } from "@/lib/leagueApi";
import {
  Alert,
  Button,
  Field,
  FormLayout,
  Input,
  PageHeader,
  PageShell,
  Panel,
} from "@/components/ui";

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
    <PageShell width="readable">
      <div className="mx-auto w-full max-w-[420px]">
        <Link
          href="/dashboard"
          className="mb-[var(--space-6)] inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-secondary)]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dashboard
        </Link>

        <PageHeader
          title="Create League"
          description="A persistent home for your seasons and drafts."
        />

        <div className="mt-[var(--space-5)]">
          <Panel>
            <FormLayout
              onSubmit={handleSubmit}
              actions={
                <Button type="submit" loading={isCreating} fullWidth>
                  {isCreating ? "Creating..." : "Create League"}
                </Button>
              }
            >
              <Field label="League Name" controlId="league-name">
                <Input
                  autoFocus
                  required
                  maxLength={100}
                  placeholder="The Brotherhood of Champions"
                  value={name}
                  onChange={(e) => updateName(e.target.value)}
                />
              </Field>

              <Field
                label="URL Slug"
                controlId="league-slug"
                description={`drafthq.net/leagues/${slug || "your-league"}`}
              >
                <Input
                  required
                  minLength={3}
                  maxLength={60}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                />
              </Field>

              {error && <Alert status="danger">{error}</Alert>}
            </FormLayout>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
