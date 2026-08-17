"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Reset your password</h1>
          <p className="mt-2 text-slate-400">Enter your account email and we&apos;ll send you a reset link.</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8">
          {message ? (
            <div className="rounded-xl border border-[color:var(--color-success-border)] bg-[color-mix(in_srgb,var(--color-success-muted)_45%,transparent)] px-4 py-5 text-center">
              <p className="text-sm font-medium text-[color:var(--color-product-accent)]">{message}</p>
              <Link href="/login" className="mt-3 inline-block text-sm text-[color:var(--color-product-accent)] hover:text-[color:var(--color-product-accent-hover)]">
                Back to login →
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="forgot-email">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  className="w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[var(--color-product-accent)] px-4 py-3 text-sm font-bold text-slate-950 hover:bg-[var(--color-product-accent-hover)] disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          {!message && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Remembered it?{" "}
              <Link className="text-[color:var(--color-product-accent)] hover:text-[color:var(--color-product-accent-hover)] font-medium" href="/login">
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
