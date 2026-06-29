"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Set a new password</h1>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8">
          {linkInvalid ? (
            <div className="text-center">
              <p className="text-sm text-red-400">
                This reset link is invalid or has expired.
              </p>
              <Link href="/forgot-password" className="mt-3 inline-block text-sm text-teal-400 hover:text-teal-300">
                Request a new link →
              </Link>
            </div>
          ) : message ? (
            <p className="text-center text-sm font-medium text-teal-300">{message}</p>
          ) : (
            <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="reset-password">
                  New Password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  required
                  minLength={8}
                  disabled={!isReady}
                  className="w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="reset-confirm-password">
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  required
                  minLength={8}
                  disabled={!isReady}
                  className="w-full"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {error && <p className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={!isReady || isSubmitting}
                className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Saving..." : "Save New Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
