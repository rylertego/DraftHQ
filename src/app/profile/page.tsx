"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyProfile, updateMyProfile } from "@/lib/profileApi";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getMyProfile()
      .then((result) => {
        if (!active) return;
        setEmail(result.email ?? "");
        setDisplayName(result.profile.displayName);
        setAvatarUrl(result.profile.avatarUrl ?? "");
        setBio(result.profile.bio ?? "");
      })
      .catch(() => { if (active) router.replace("/login"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);
    try {
      const profile = await updateMyProfile({ displayName, avatarUrl, bio });
      setDisplayName(profile.displayName);
      setAvatarUrl(profile.avatarUrl ?? "");
      setBio(profile.bio ?? "");
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="mx-auto w-full max-w-2xl p-8 text-slate-400">Loading profile...</main>;
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 p-6 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Owner Profile</h1>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
        <form className="space-y-5" onSubmit={handleSubmit}>
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Profile avatar preview" className="h-20 w-20 rounded-full border border-slate-700 object-cover" />
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="profile-name">
              Display Name
            </label>
            <input
              id="profile-name"
              required
              maxLength={50}
              className="w-full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="profile-avatar">
              Avatar URL
            </label>
            <input
              id="profile-avatar"
              type="url"
              maxLength={2048}
              placeholder="https://example.com/avatar.jpg"
              className="w-full"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="profile-bio">
              Bio
            </label>
            <textarea
              id="profile-bio"
              maxLength={280}
              rows={4}
              className="w-full resize-none"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-slate-500">{bio.length}/280</p>
          </div>
          {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}
          {message && <p className="rounded-lg border border-teal-800 bg-teal-950/30 px-3 py-2 text-sm text-teal-300">{message}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </main>
  );
}
