"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/create");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="mb-2 text-3xl font-bold">Log In</h1>
      <p className="mb-6 text-gray-400">Continue to your draft room account.</p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" required className="w-full rounded border p-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" required className="w-full rounded border p-2" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {isSubmitting ? "Logging in..." : "Log In"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-400">New here? <Link className="text-blue-400 underline" href="/signup">Create an account</Link></p>
    </main>
  );
}
