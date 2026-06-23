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

export default function DraftChat({
  draftId,
  participantId,
  isCommissioner,
}: DraftChatProps) {
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
        {
          event: "INSERT",
          schema: "public",
          table: "draft_messages",
          filter: `draft_id=eq.${draftId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            draft_id: string;
            participant_id: string | null;
            display_name: string;
            content: string;
            kind: "chat" | "announcement" | "system";
            created_at: string;
          };
          const msg: DraftMessage = {
            id: row.id,
            draftId: row.draft_id,
            participantId: row.participant_id,
            displayName: row.display_name,
            content: row.content,
            kind: row.kind,
            createdAt: row.created_at,
          };
          setMessages((prev) => [...prev, msg]);
          setUnread((n) => (isOpen ? 0 : n + 1));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
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
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const canChat = Boolean(participantId);

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 shadow-lg border border-gray-600 hover:bg-gray-700 transition-colors"
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
        <div className="fixed bottom-0 left-0 z-40 flex h-[min(500px,80vh)] w-[340px] flex-col rounded-tr-xl border border-gray-700 bg-gray-950/95 shadow-2xl backdrop-blur">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                Draft Chat
              </span>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs hover:bg-gray-600"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {messages.length === 0 && (
              <p className="mt-4 text-center text-xs text-gray-600">
                No messages yet. Say hello!
              </p>
            )}

            {messages.map((msg) => {
              if (msg.kind === "system") {
                return (
                  <div key={msg.id} className="py-0.5 text-center">
                    <span className="text-[11px] text-gray-500 italic">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              if (msg.kind === "announcement") {
                return (
                  <div
                    key={msg.id}
                    className="rounded border border-yellow-700/50 bg-yellow-950/40 px-3 py-1.5"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-400 uppercase tracking-wide mb-0.5">
                      <span>📣</span> Commissioner Announcement
                    </div>
                    <p className="text-sm text-yellow-100">{msg.content}</p>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-2 py-0.5">
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-800 text-[10px] font-bold text-white"
                    aria-hidden
                  >
                    {msg.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-green-400">
                      {msg.displayName}
                    </span>
                    <p className="text-sm leading-snug text-gray-200 break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {canChat ? (
            <div className="border-t border-gray-700 p-2 space-y-1.5">
              {isCommissioner && (
                <button
                  type="button"
                  onClick={() => setIsAnnounce((a) => !a)}
                  className={[
                    "w-full rounded px-3 py-1 text-xs font-semibold transition-colors",
                    isAnnounce
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700",
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
                  className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                />
                <button
                  type="button"
                  disabled={!input.trim() || isSending}
                  onClick={() => void handleSend()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
                  aria-label="Send"
                >
                  ↑
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-700 px-4 py-3">
              <p className="text-center text-xs text-gray-500">
                Join the draft to chat.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
