import { supabase } from "@/lib/supabase";

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMyProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user || userData.user.is_anonymous) {
    throw new Error("Sign in to view your profile.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url,bio,created_at,updated_at")
    .eq("id", userData.user.id)
    .single();

  if (error) {
    throw error;
  }

  return { profile: mapProfile(data as ProfileRow), email: userData.user.email };
}

export async function updateMyProfile(input: {
  displayName: string;
  avatarUrl: string | null;
  bio: string;
}) {
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 50) {
    throw new Error("Display name must be between 1 and 50 characters.");
  }
  const bio = input.bio.trim() || null;
  if (bio && bio.length > 280) {
    throw new Error("Bio must be 280 characters or fewer.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) {
    throw new Error("Sign in to update your profile.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, avatar_url: input.avatarUrl, bio })
    .eq("id", userData.user.id)
    .select("id,display_name,avatar_url,bio,created_at,updated_at")
    .single();

  if (error) throw error;
  return mapProfile(data as ProfileRow);
}

export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous || !userData.user.email) {
    throw new Error("Sign in to change your password.");
  }
  if (input.newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: input.currentPassword,
  });
  if (verifyError) {
    throw new Error("Current password is incorrect.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: input.newPassword,
  });
  if (updateError) throw updateError;
}

export async function requestMyPasswordReset(): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous || !userData.user.email) {
    throw new Error("Sign in to reset your password.");
  }
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: userData.user.email }),
  });
  if (!res.ok) {
    const data = await res.json() as { error?: string };
    throw new Error(data.error ?? "Unable to send reset email.");
  }
}

export async function uploadProfileAvatar(file: File): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) {
    throw new Error("Sign in to upload an avatar.");
  }
  const userId = userData.user.id;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `global/${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
