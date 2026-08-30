"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createLeague } from "@/lib/leagueApi";
import { leagueImportPath, slugFromLeagueName } from "@/lib/leagueOnboarding";
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
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const slug = slugFromLeagueName(name);
    if (!slug) {
      setError("Use at least one letter or number in the league name.");
      return;
    }
    setIsCreating(true);
    try {
      const league = await createLeague({ name, slug });
      router.push(leagueImportPath(league.slug));
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
                  onChange={(e) => setName(e.target.value)}
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
