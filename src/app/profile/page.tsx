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
        if (!active) {
          return;
        }

        setEmail(result.email ?? "");
        setDisplayName(result.profile.displayName);
        setAvatarUrl(result.profile.avatarUrl ?? "");
        setBio(result.profile.bio ?? "");
      })
      .catch(() => {
        if (active) {
          router.replace("/login");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
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
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your profile."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="mx-auto w-full max-w-2xl p-8">Loading profile...</main>;
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Owner Profile</h1>
      <p className="mb-6 text-gray-400">{email}</p>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Profile avatar preview"
            className="h-24 w-24 rounded-full border border-gray-700 object-cover"
          />
        )}
        <div>
          <label className="mb-2 block" htmlFor="profile-name">
            Display Name
          </label>
          <input
            id="profile-name"
            required
            maxLength={50}
            className="w-full rounded border p-2"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="profile-avatar">
            Avatar URL
          </label>
          <input
            id="profile-avatar"
            type="url"
            maxLength={2048}
            placeholder="https://example.com/avatar.jpg"
            className="w-full rounded border p-2"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block" htmlFor="profile-bio">
            Bio
          </label>
          <textarea
            id="profile-bio"
            maxLength={280}
            rows={4}
            className="w-full rounded border p-2"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
          <p className="mt-1 text-right text-xs text-gray-500">
            {bio.length}/280
          </p>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {message && <p className="text-green-400">{message}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </main>
  );
}
