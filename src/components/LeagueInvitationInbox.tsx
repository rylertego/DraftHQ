"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyLeagueInvitations, respondToLeagueInvitation } from "@/lib/leagueApi";
import type { LeagueInvitationInboxItem } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";

export default function LeagueInvitationInbox({ userId }: { userId: string }) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<LeagueInvitationInboxItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const items = await getMyLeagueInvitations();
      setInvitations(items);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invitations.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const channel = supabase
      .channel(`league-invitations:${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "league_invitations", filter: `invited_user_id=eq.${userId}`,
      }, () => void load())
      .subscribe();
    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function respond(invitation: LeagueInvitationInboxItem, response: "accepted" | "declined") {
    setBusyId(invitation.invitationId);
    setError("");
    try {
      const slug = await respondToLeagueInvitation(invitation.invitationId, response);
      setInvitations((current) => current.filter((item) => item.invitationId !== invitation.invitationId));
      if (response === "accepted" && slug) {
        setOpen(false);
        router.push(`/leagues/${slug}`);
        router.refresh();
      }
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : "Unable to respond to invitation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" aria-label="League invitations" onClick={() => setOpen((value) => !value)} className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 transition-colors hover:border-slate-600 hover:text-white">
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
          <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 7l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {invitations.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-black text-slate-950">{invitations.length > 9 ? "9+" : invitations.length}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/70">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="font-bold text-white">League Invitations</p>
            <p className="mt-0.5 text-xs text-slate-500">Joining assigns any team reserved for you.</p>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto p-2">
            {invitations.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">No pending invitations.</p> : invitations.map((invitation) => (
              <div key={invitation.invitationId} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800">
                    {(invitation.teamLogoUrl || invitation.leagueLogoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={invitation.teamLogoUrl || invitation.leagueLogoUrl || ""} alt="" className="h-full w-full object-contain" />
                    ) : <span className="font-black text-orange-400">{invitation.leagueName.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{invitation.leagueName}</p>
                    <p className="truncate text-xs text-slate-400">{invitation.teamName ? `Team: ${invitation.teamName}` : "League member invitation"}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyId === invitation.invitationId} onClick={() => void respond(invitation, "declined")} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50">Decline</button>
                  <button type="button" disabled={busyId === invitation.invitationId} onClick={() => void respond(invitation, "accepted")} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-orange-400 disabled:opacity-50">{busyId === invitation.invitationId ? "Joining..." : "Join League"}</button>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="border-t border-red-900 bg-red-950/40 px-4 py-2 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
