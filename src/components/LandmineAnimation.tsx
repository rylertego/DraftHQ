"use client";

import { useEffect, useRef, useState } from "react";

export interface LandmineAnimationProps {
  playerName: string;
  teamName: string;
  onDismiss: () => void;
}

function playSound(src: string, volume = 1) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play();
  } catch { /* ignore autoplay blocks */ }
}

export default function LandmineAnimation({ playerName, teamName, onDismiss }: LandmineAnimationProps) {
  const [phase, setPhase] = useState<"drop" | "explode">("drop");
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    let cancelled = false;
    const audio = new Audio("/sounds/bomb leadup.mp3");
    audio.volume = 0.8;
    audio.onended = () => { if (!cancelled) setPhase("explode"); };
    void audio.play().catch((err: unknown) => {
      if (cancelled) return;
      // Only fall back on autoplay block, not on AbortError from cleanup
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        dropTimerRef.current = setTimeout(() => setPhase("explode"), 1000);
      }
    });
    return () => {
      cancelled = true;
      audio.onended = null;
      audio.pause();
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "explode") {
      playSound("/sounds/bomb blow.mp3", 1.0);
      dismissTimerRef.current = setTimeout(() => onDismissRef.current(), 6000);
    }
    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); };
  }, [phase]);

  return (
    <>
      <style>{`
        @keyframes lm-bomb-drop {
          0%   { transform: translateY(-120px) scale(0.6) rotate(-15deg); opacity: 0; }
          60%  { transform: translateY(4px) scale(1.1) rotate(6deg); opacity: 1; }
          80%  { transform: translateY(-8px) scale(0.95) rotate(-3deg); }
          100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes lm-explode {
          0%   { transform: scale(1); opacity: 1; }
          30%  { transform: scale(2.5); opacity: 0.7; }
          100% { transform: scale(5); opacity: 0; }
        }
        @keyframes lm-shockwave {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
        @keyframes lm-shake {
          0%, 100% { transform: translateX(0); }
          10%  { transform: translateX(-12px) rotate(-1deg); }
          20%  { transform: translateX(10px) rotate(1deg); }
          30%  { transform: translateX(-8px) rotate(-0.5deg); }
          40%  { transform: translateX(8px) rotate(0.5deg); }
          50%  { transform: translateX(-5px); }
          60%  { transform: translateX(5px); }
          70%  { transform: translateX(-3px); }
          80%  { transform: translateX(3px); }
        }
        @keyframes lm-card-in {
          0%   { transform: scale(0.7) translateY(20px); opacity: 0; }
          60%  { transform: scale(1.03) translateY(-3px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes lm-pulse-ring {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @keyframes lm-flicker {
          0%, 100% { opacity: 1; }
          45% { opacity: 0.85; }
          50% { opacity: 0.7; }
          55% { opacity: 0.9; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{
          background: phase === "explode"
            ? "radial-gradient(ellipse at center, rgba(120,20,0,0.55) 0%, rgba(0,0,0,0.97) 65%)"
            : "rgba(0,0,0,0.92)",
          backdropFilter: "blur(6px)",
          animation: phase === "explode" ? "lm-shake 0.55s ease-out" : undefined,
        }}
        onClick={onDismiss}
      >
        {/* Bomb drop phase */}
        {phase === "drop" && (
          <div
            style={{
              fontSize: "7rem",
              lineHeight: 1,
              animation: "lm-bomb-drop 0.9s cubic-bezier(0.22,1,0.36,1) forwards",
              filter: "drop-shadow(0 0 30px rgba(255,120,0,0.7))",
            }}
          >
            💣
          </div>
        )}

        {/* Explode + reveal combined */}
        {phase === "explode" && (
          <div className="relative flex flex-col items-center justify-center gap-6">
            {/* Shockwave ring */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: "6px solid rgba(255,180,0,0.9)",
                animation: "lm-shockwave 0.6s ease-out forwards",
                pointerEvents: "none",
              }}
            />

            {/* Player card — appears immediately with the explosion */}
            <div
              style={{
                animation: "lm-card-in 0.5s 0.1s cubic-bezier(0.22,1,0.36,1) both",
                textAlign: "center",
                padding: "2.5rem 3rem",
                maxWidth: 560,
                background: "rgba(10,4,2,0.85)",
                border: "1px solid rgba(255,80,20,0.35)",
                borderRadius: "1.25rem",
                boxShadow: "0 0 80px rgba(255,60,0,0.3), 0 8px 40px rgba(0,0,0,0.6)",
              }}
            >
              <div className="relative mx-auto mb-4" style={{ width: 100, height: 100 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(255,60,0,0.35)", animation: "lm-pulse-ring 1s ease-out infinite" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(255,60,0,0.2)", animation: "lm-pulse-ring 1s ease-out 0.4s infinite" }} />
                <div style={{ position: "relative", fontSize: "4rem", lineHeight: "100px", textAlign: "center", animation: "lm-flicker 2s ease-in-out infinite" }}>
                  💣
                </div>
              </div>

              <p style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,120,50,0.9)", marginBottom: "0.5rem" }}>
                💥 LANDMINE 💥
              </p>

              <h1 style={{ fontSize: "2.5rem", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: "0.75rem", textShadow: "0 0 40px rgba(255,100,0,0.7)" }}>
                {playerName}
              </h1>

              <p style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                drafted by <span style={{ color: "#fff", fontWeight: 700 }}>{teamName}</span>
              </p>

              <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>
                click anywhere to dismiss
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
