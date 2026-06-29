"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

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

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setIsSubmitting(false);

    if (resetError) {
      setError(resetError.message);
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
            <div className="rounded-xl border border-teal-800 bg-teal-950/30 px-4 py-5 text-center">
              <p className="text-sm font-medium text-teal-300">{message}</p>
              <Link href="/login" className="mt-3 inline-block text-sm text-teal-400 hover:text-teal-300">
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
                className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          {!message && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Remembered it?{" "}
              <Link className="text-teal-400 hover:text-teal-300 font-medium" href="/login">
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
