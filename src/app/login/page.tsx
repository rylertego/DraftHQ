"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCaptchaToken } from "@/lib/turnstile";
import DraftHQLockup from "@/components/brand/DraftHQLockup";
import { Alert, Button, Field, FormLayout, Input, PageShell, Panel } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const captchaToken = await getCaptchaToken("login");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken },
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <PageShell width="readable">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-[var(--space-6)] text-center">
            <DraftHQLockup className="mx-auto mb-[var(--space-5)] h-28 w-auto" />
            <h1 className="text-[length:var(--font-size-page-title)] font-bold text-[color:var(--color-text-primary)]">
              Welcome back
            </h1>
            <p className="mt-[var(--space-2)] text-[color:var(--color-text-secondary)]">
              Log in to your DraftHQ account.
            </p>
          </div>

          <Panel>
            <FormLayout
              onSubmit={handleSubmit}
              actions={
                <Button type="submit" loading={isSubmitting} fullWidth>
                  {isSubmitting ? "Logging in..." : "Log In"}
                </Button>
              }
            >
              <Field label="Email" controlId="login-email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label="Password" controlId="login-password">
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              <div className="-mt-[var(--space-2)] text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[color:var(--color-text-secondary)] underline-offset-4 hover:text-[color:var(--color-text-primary)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {error ? <Alert status="danger">{error}</Alert> : null}
            </FormLayout>

            <p className="mt-[var(--space-5)] text-center text-sm text-[color:var(--color-text-secondary)]">
              New here?{" "}
              <Link
                className="font-medium text-[color:var(--color-product-accent)] underline-offset-4 hover:underline"
                href="/signup"
              >
                Create an account
              </Link>
            </p>
          </Panel>
        </div>
      </PageShell>
    </main>
  );
}
