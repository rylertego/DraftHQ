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
    const redirectTo = `${window.location.origin}/profile`;
    const result = currentUser?.is_anonymous
      ? await supabase.auth.updateUser(
          {
            email: email.trim(),
            password,
            data: { display_name: name },
          },
          { emailRedirectTo: redirectTo }
        )
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: redirectTo,
          },
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
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="mb-2 text-3xl font-bold">Create Account</h1>
      <p className="mb-6 text-gray-400">Build your owner profile and commission drafts.</p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block" htmlFor="signup-name">Display Name</label>
          <input id="signup-name" required maxLength={50} className="w-full rounded border p-2" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" required className="w-full rounded border p-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" required minLength={8} className="w-full rounded border p-2" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {message && <p className="text-green-400">{message}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-400">Already registered? <Link className="text-blue-400 underline" href="/login">Log in</Link></p>
    </main>
  );
}
