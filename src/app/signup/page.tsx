"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

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
          options: { data: { display_name: name }, emailRedirectTo: redirectTo },
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
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="mt-2 text-slate-400">Build your owner profile and commission drafts.</p>
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
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="signup-name">
                  Display Name
                </label>
                <input
                  id="signup-name"
                  required
                  maxLength={50}
                  className="w-full"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="signup-email">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  className="w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="signup-password">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={8}
                  className="w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
              </div>
              {error && <p className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}

          {!message && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Already registered?{" "}
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
