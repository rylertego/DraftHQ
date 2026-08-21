"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Dialog, Field, Input } from "@/components/ui";

export default function ResetDraftModal({
  onClose,
  onConfirm,
  onReset,
}: {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onReset: () => void;
}) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleReset() {
    if (confirmation !== "RESET") return;
    setIsResetting(true);
    setError("");
    try {
      await onConfirm();
      onReset();
      onClose();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset draft.");
      setIsResetting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={isResetting ? () => {} : onClose}
      size="small"
      title="Reset Draft?"
      description="This clears every pick and returns the draft to pre-draft setup. The draft and its settings page will remain available. This cannot be undone."
      initialFocusRef={inputRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isResetting}>
            Cancel
          </Button>
          {/* Solid danger is right inside a confirmation dialog — the emphasis
              is the whole point here, unlike the trigger that opens it. */}
          <Button
            variant="danger"
            loading={isResetting}
            disabled={confirmation !== "RESET"}
            onClick={() => void handleReset()}
          >
            {isResetting ? "Resetting..." : "Reset Draft"}
          </Button>
        </>
      }
    >
      <Field label="Type RESET to confirm" controlId="reset-draft-confirmation">
        <Input
          ref={inputRef}
          type="text"
          maxLength={10}
          placeholder="RESET"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
          onKeyDown={(event) => { if (event.key === "Enter") void handleReset(); }}
        />
      </Field>

      {error && <Alert status="danger">{error}</Alert>}
    </Dialog>
  );
}
