"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Alert, Button, Field, FormLayout, Input, PageShell, Panel } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let settled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setIsReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      if (data.session) {
        setIsReady(true);
      } else {
        setLinkInvalid(true);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Password updated. Redirecting...");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <PageShell width="readable">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-[var(--space-6)] text-center">
            <h1 className="text-[length:var(--font-size-page-title)] font-bold text-[color:var(--color-text-primary)]">
              Set a new password
            </h1>
          </div>

          <Panel>
            {linkInvalid ? (
              <Alert status="danger" title="Link expired">
                <p>This reset link is invalid or has expired.</p>
                <Link
                  href="/forgot-password"
                  className="mt-[var(--space-2)] inline-block font-medium text-[color:var(--color-product-accent)] underline-offset-4 hover:underline"
                >
                  Request a new link →
                </Link>
              </Alert>
            ) : message ? (
              <Alert status="success">{message}</Alert>
            ) : (
              <FormLayout
                onSubmit={(e) => void handleSubmit(e)}
                actions={
                  <Button type="submit" loading={isSubmitting} disabled={!isReady} fullWidth>
                    {isSubmitting ? "Saving..." : "Save New Password"}
                  </Button>
                }
              >
                <Field
                  label="New Password"
                  controlId="reset-password"
                  description="At least 8 characters."
                >
                  <Input
                    type="password"
                    required
                    minLength={8}
                    disabled={!isReady}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>

                <Field label="Confirm New Password" controlId="reset-confirm-password">
                  <Input
                    type="password"
                    required
                    minLength={8}
                    disabled={!isReady}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>

                {error ? <Alert status="danger">{error}</Alert> : null}
              </FormLayout>
            )}
          </Panel>
        </div>
      </PageShell>
    </main>
  );
}
