"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getDraftMessages, sendDraftMessage } from "@/lib/draftApi";
import type { DraftMessage, DraftParticipant } from "@/types/draft";

interface DraftChatProps {
  draftId: string;
  participantId: string | null;
  isCommissioner: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
  participants: DraftParticipant[];
  onlineUserIds: string[];
}

export default function DraftChat({
  draftId,
  participantId,
  isCommissioner,
  isOpen,
  onClose,
  onUnreadChange,
  participants,
  onlineUserIds,
}: DraftChatProps) {
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAnnounce, setIsAnnounce] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const unreadRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void getDraftMessages(draftId).then((msgs) => {
      if (!cancelled) setMessages(msgs);
    });

    const channel = supabase
      .channel(`draft-chat:${draftId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "draft_messages", filter: `draft_id=eq.${draftId}` },
        (payload) => {
          const row = payload.new as {
            id: string; draft_id: string; participant_id: string | null;
            display_name: string; content: string;
            kind: "chat" | "announcement" | "system"; created_at: string;
          };
          setMessages((prev) => [
            ...prev,
            {
              id: row.id, draftId: row.draft_id, participantId: row.participant_id,
              displayName: row.display_name, content: row.content,
              kind: row.kind, createdAt: row.created_at,
            },
          ]);
          if (!isOpen) {
            unreadRef.current += 1;
            onUnreadChange(unreadRef.current);
          }
        }
      )
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [draftId]);

  useEffect(() => {
    if (isOpen) {
      unreadRef.current = 0;
      onUnreadChange(0);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending || !participantId) return;
    setIsSending(true);
    setInput("");
    try {
      await sendDraftMessage(draftId, text, isAnnounce ? "announcement" : "chat");
      setIsAnnounce(false);
    } catch {
      setInput(text);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  if (!isOpen) return null;

  const onlineSet = new Set(onlineUserIds);
  const canChat = Boolean(participantId);

  return (
    <div className="fixed bottom-[58px] left-0 z-50 flex flex-col overflow-hidden rounded-tr-[var(--radius-overlay)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-1)] shadow-2xl"
      style={{ width: "min(520px, 95vw)", height: "min(480px, 70vh)" }}>

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-2)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-league-accent-hover)]" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-primary)]">Draft Chat</span>
        </div>
        <button type="button" aria-label="Close chat"
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-control)] bg-[color:var(--color-surface-1)] text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-text-primary)]"
          onClick={onClose}>
          <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Body: messages + participants */}
      <div className="flex min-h-0 flex-1">

        {/* Messages */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-[color:var(--color-border-subtle)]">
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-1.5">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-xs text-[color:var(--color-text-muted)]">No messages yet. Say hello!</p>
            )}
            {messages.map((msg) => {
              if (msg.kind === "system") {
                return (
                  <div key={msg.id} className="py-0.5 text-center">
                    <span className="text-[11px] italic text-[color:var(--color-text-muted)]">{msg.content}</span>
                  </div>
                );
              }
              if (msg.kind === "announcement") {
                return (
                  <div key={msg.id} className="rounded-[var(--radius-control)] border border-[color:var(--color-warning-border)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-3 py-2">
                    <div className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--color-warning)]">
                      Commissioner Announcement
                    </div>
                    <p className="text-sm leading-snug text-[color:var(--color-text-primary)]">{msg.content}</p>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="flex items-start gap-2 py-0.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-league-accent-muted)_60%,transparent)] text-[10px] font-black text-[color:var(--color-league-accent)]">
                    {msg.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-[color:var(--color-league-accent)]">{msg.displayName}</span>
                    <p className="break-words text-sm leading-snug text-[color:var(--color-text-primary)]">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 space-y-1.5 border-t border-[color:var(--color-border-subtle)] p-2">
            {canChat ? (
              <>
                {isCommissioner && (
                  <button type="button"
                    onClick={() => setIsAnnounce((a) => !a)}
                    className={`w-full rounded-[var(--radius-control)] px-3 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${isAnnounce ? "bg-[var(--color-warning)] text-[color:var(--color-warning-foreground)]" : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-text-secondary)]"}`}>
                    {isAnnounce ? "📣 Commissioner Announcement" : "Commish Announce"}
                  </button>
                )}
                <div className="flex gap-2">
                  <input ref={inputRef} type="text" maxLength={500}
                    placeholder={isAnnounce ? "Commissioner announcement..." : "Type a message..."}
                    className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:border-[color-mix(in_srgb,var(--color-league-accent-border)_60%,transparent)] focus:outline-none"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                  />
                  <button type="button" disabled={!input.trim() || isSending} onClick={() => void handleSend()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-league-accent)] text-[color:var(--color-league-accent-foreground)] transition-colors hover:bg-[var(--color-league-accent-hover)] disabled:opacity-30"
                    aria-label="Send">
                    <svg viewBox="0 0 14 14" fill="currentColor" className="h-4 w-4">
                      <path d="M7 1v12M7 1L3 5M7 1l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <p className="py-2 text-center text-xs text-[color:var(--color-text-muted)]">Join the draft to chat.</p>
            )}
          </div>
        </div>

        {/* Participants sidebar */}
        <div className="flex w-36 shrink-0 flex-col">
          <div className="shrink-0 border-b border-[color:var(--color-border-subtle)] px-3 py-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">In Room</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {participants.map((p) => {
              const isOnline = onlineSet.has(p.userId);
              return (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOnline ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-border-strong)]"}`} />
                  <span className={`truncate text-xs font-semibold ${isOnline ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-muted)]"}`}>
                    {p.displayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
