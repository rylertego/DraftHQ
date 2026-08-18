"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  changeMyPassword,
  getMyProfile,
  requestMyPasswordReset,
  updateMyProfile,
  uploadProfileAvatar,
} from "@/lib/profileApi";
import DeleteAccountPanel from "@/components/DeleteAccountPanel";
import {
  Alert,
  Avatar,
  Button,
  Field,
  FileUpload,
  FormLayout,
  Input,
  PageHeader,
  PageShell,
  Panel,
  Textarea,
} from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    let active = true;
    void getMyProfile()
      .then((result) => {
        if (!active) return;
        setEmail(result.email ?? "");
        setDisplayName(result.profile.displayName);
        setAvatarUrl(result.profile.avatarUrl);
        setBio(result.profile.bio ?? "");
      })
      .catch(() => { if (active) router.replace("/login"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [router]);

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    // Captured synchronously: the FileUpload primitive does not forward a ref,
    // and this element still has to be cleared afterwards so re-picking the
    // same file fires another change event.
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setIsUploadingAvatar(true);
    setError("");
    try {
      const url = await uploadProfileAvatar(file);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image.");
    } finally {
      setIsUploadingAvatar(false);
      input.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);
    try {
      const profile = await updateMyProfile({ displayName, avatarUrl, bio });
      setDisplayName(profile.displayName);
      setAvatarUrl(profile.avatarUrl);
      setBio(profile.bio ?? "");
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage("Password updated.");
    } catch (changeError) {
      setPasswordError(changeError instanceof Error ? changeError.message : "Unable to change your password.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleForgotPassword() {
    setPasswordError("");
    setPasswordMessage("");
    setIsSendingReset(true);
    try {
      await requestMyPasswordReset();
      setPasswordMessage("Check your email for a password reset link.");
    } catch (resetError) {
      setPasswordError(resetError instanceof Error ? resetError.message : "Unable to send reset email.");
    } finally {
      setIsSendingReset(false);
    }
  }

  const initials = displayName.charAt(0).toUpperCase() || "?";

  if (isLoading) {
    return (
      <PageShell width="readable">
        <p className="text-[color:var(--color-text-secondary)]">Loading profile...</p>
      </PageShell>
    );
  }

  return (
    <PageShell width="readable">
      <PageHeader title="Owner Profile" description={email} />

      <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-6)]">
        <Panel>
          <FormLayout
            onSubmit={(e) => void handleSubmit(e)}
            actions={
              <Button type="submit" loading={isSaving} disabled={isUploadingAvatar}>
                {isSaving ? "Saving..." : "Save Profile"}
              </Button>
            }
          >
            <div className="flex items-start gap-[var(--space-4)]">
              <Avatar name={displayName || initials} src={avatarUrl} size="large" />
              <div className="flex min-w-0 flex-col items-start gap-[var(--space-2)]">
                <FileUpload
                  label="Avatar"
                  description="JPG, PNG, GIF, WebP · max 5 MB"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  disabled={isUploadingAvatar}
                  onChange={(e) => void handleAvatarChange(e)}
                />
                {avatarUrl && (
                  <Button variant="tertiary" onClick={() => setAvatarUrl(null)}>
                    Remove photo
                  </Button>
                )}
              </div>
            </div>

            <Field label="Display Name" controlId="profile-name">
              <Input
                required
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>

            <Field label="Bio" controlId="profile-bio">
              <Textarea
                maxLength={280}
                rows={3}
                placeholder="Tell leagues a little about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </Field>
            <p className="-mt-[var(--space-2)] text-right text-xs tabular-nums text-[color:var(--color-text-muted)]">
              {bio.length}/280
            </p>

            {error && <Alert status="danger">{error}</Alert>}
            {message && <Alert status="success">{message}</Alert>}
          </FormLayout>
        </Panel>

        <Panel
          title="Change Password"
          description="Confirm your current password to set a new one."
        >
          <FormLayout
            onSubmit={(e) => void handleChangePassword(e)}
            actions={
              <>
                <Button type="submit" loading={isChangingPassword}>
                  {isChangingPassword ? "Saving..." : "Change Password"}
                </Button>
                <Button
                  variant="tertiary"
                  loading={isSendingReset}
                  onClick={() => void handleForgotPassword()}
                >
                  {isSendingReset ? "Sending..." : "Forgot Password?"}
                </Button>
              </>
            }
          >
            <Field label="Current Password" controlId="current-password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>

            <Field label="New Password" controlId="new-password" description="At least 8 characters.">
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>

            <Field label="Confirm New Password" controlId="confirm-new-password">
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </Field>

            {passwordError && <Alert status="danger">{passwordError}</Alert>}
            {passwordMessage && <Alert status="success">{passwordMessage}</Alert>}
          </FormLayout>
        </Panel>

        <DeleteAccountPanel />
      </div>
    </PageShell>
  );
}
