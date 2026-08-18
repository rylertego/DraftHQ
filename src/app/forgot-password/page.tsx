"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Alert, Button, Field, FormLayout, Input, PageShell, Panel } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setMessage("If an account exists for that email, a password reset link is on its way.");
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <PageShell width="readable">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-[var(--space-6)] text-center">
            <h1 className="text-[length:var(--font-size-page-title)] font-bold text-[color:var(--color-text-primary)]">
              Reset your password
            </h1>
            <p className="mt-[var(--space-2)] text-[color:var(--color-text-secondary)]">
              Enter your account email and we&apos;ll send you a reset link.
            </p>
          </div>

          <Panel>
            {message ? (
              <Alert status="success" title="Check your email">
                <p>{message}</p>
                <Link
                  href="/login"
                  className="mt-[var(--space-2)] inline-block font-medium text-[color:var(--color-product-accent)] underline-offset-4 hover:underline"
                >
                  Back to login →
                </Link>
              </Alert>
            ) : (
              <>
                <FormLayout
                  onSubmit={(e) => void handleSubmit(e)}
                  actions={
                    <Button type="submit" loading={isSubmitting} fullWidth>
                      {isSubmitting ? "Sending..." : "Send Reset Link"}
                    </Button>
                  }
                >
                  <Field label="Email" controlId="forgot-email">
                    <Input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>

                  {error ? <Alert status="danger">{error}</Alert> : null}
                </FormLayout>

                <p className="mt-[var(--space-5)] text-center text-sm text-[color:var(--color-text-secondary)]">
                  Remembered it?{" "}
                  <Link
                    className="font-medium text-[color:var(--color-product-accent)] underline-offset-4 hover:underline"
                    href="/login"
                  >
                    Log in
                  </Link>
                </p>
              </>
            )}
          </Panel>
        </div>
      </PageShell>
    </main>
  );
}
