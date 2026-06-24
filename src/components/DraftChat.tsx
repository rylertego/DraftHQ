"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getDraftMessages, sendDraftMessage } from "@/lib/draftApi";
import type { DraftMessage } from "@/types/draft";

interface DraftChatProps {
  draftId: string;
  participantId: string | null;
  isCommissioner: boolean;
}

export default function DraftChat({ draftId, participantId, isCommissioner }: DraftChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAnnounce, setIsAnnounce] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
          const msg: DraftMessage = {
            id: row.id, draftId: row.draft_id, participantId: row.participant_id,
            displayName: row.display_name, content: row.content,
            kind: row.kind, createdAt: row.created_at,
          };
          setMessages((prev) => [...prev, msg]);
          setUnread((n) => (isOpen ? 0 : n + 1));
        }
      )
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [draftId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
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

  const canChat = Boolean(participantId);

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800 shadow-lg hover:bg-slate-700 transition-colors"
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className="text-xl">💬</span>
        {unread > 0 && !isOpen && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 z-40 flex h-[min(500px,80vh)] w-[340px] flex-col rounded-tr-2xl border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                Draft Chat
              </span>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {messages.length === 0 && (
              <p className="mt-4 text-center text-xs text-slate-600">No messages yet. Say hello!</p>
            )}

            {messages.map((msg) => {
              if (msg.kind === "system") {
                return (
                  <div key={msg.id} className="py-0.5 text-center">
                    <span className="text-[11px] italic text-slate-500">{msg.content}</span>
                  </div>
                );
              }

              if (msg.kind === "announcement") {
                return (
                  <div key={msg.id} className="rounded-xl border border-yellow-700/50 bg-yellow-950/40 px-3 py-1.5">
                    <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-yellow-400">
                      <span>📣</span> Commissioner Announcement
                    </div>
                    <p className="text-sm text-yellow-100">{msg.content}</p>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-2 py-0.5">
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-900 text-[10px] font-bold text-teal-200"
                    aria-hidden
                  >
                    {msg.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-teal-400">{msg.displayName}</span>
                    <p className="break-words text-sm leading-snug text-slate-200">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {canChat ? (
            <div className="border-t border-slate-800 p-2 space-y-1.5">
              {isCommissioner && (
                <button
                  type="button"
                  onClick={() => setIsAnnounce((a) => !a)}
                  className={[
                    "w-full rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                    isAnnounce
                      ? "bg-yellow-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700",
                  ].join(" ")}
                >
                  {isAnnounce ? "📣 Sending as Announcement" : "Commish Announce"}
                </button>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  maxLength={500}
                  placeholder={isAnnounce ? "Commissioner announcement..." : "Type message..."}
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-teal-500 focus:outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                />
                <button
                  type="button"
                  disabled={!input.trim() || isSending}
                  onClick={() => void handleSend()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-40 transition-colors"
                  aria-label="Send"
                >
                  ↑
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-800 px-4 py-3">
              <p className="text-center text-xs text-slate-500">Join the draft to chat.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
