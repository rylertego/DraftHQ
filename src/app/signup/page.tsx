"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCaptchaToken } from "@/lib/turnstile";
import { Alert, Button, Field, FormLayout, Input, PageShell, Panel } from "@/components/ui";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();

    if (name.length < 1 || name.length > 50) {
      setError("Display name must be between 1 and 50 characters.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    const captchaToken = await getCaptchaToken("signup");
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;
    const redirectTo = `${window.location.origin}/dashboard`;
    const result = currentUser?.is_anonymous
      ? await supabase.auth.updateUser(
          { email: email.trim(), password, data: { display_name: name } },
          { emailRedirectTo: redirectTo }
        )
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name }, emailRedirectTo: redirectTo, captchaToken },
        });

    if (result.error) {
      setError(result.error.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Check your email to confirm your account, then log in.");
    setIsSubmitting(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <PageShell width="readable">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-[var(--space-6)] text-center">
            <h1 className="text-[length:var(--font-size-page-title)] font-bold text-[color:var(--color-text-primary)]">
              Create Account
            </h1>
            <p className="mt-[var(--space-2)] text-[color:var(--color-text-secondary)]">
              Build your owner profile and commission drafts.
            </p>
          </div>

          <Panel>
            {message ? (
              <Alert status="success" title="Account created">
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
                  onSubmit={handleSubmit}
                  actions={
                    <Button type="submit" loading={isSubmitting} fullWidth>
                      {isSubmitting ? "Creating account..." : "Create Account"}
                    </Button>
                  }
                >
                  <Field label="Display Name" controlId="signup-name">
                    <Input
                      required
                      maxLength={50}
                      autoComplete="nickname"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </Field>

                  <Field label="Email" controlId="signup-email">
                    <Input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>

                  <Field
                    label="Password"
                    controlId="signup-password"
                    description="At least 8 characters."
                  >
                    <Input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>

                  {error ? <Alert status="danger">{error}</Alert> : null}
                </FormLayout>

                <p className="mt-[var(--space-5)] text-center text-sm text-[color:var(--color-text-secondary)]">
                  Already registered?{" "}
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
