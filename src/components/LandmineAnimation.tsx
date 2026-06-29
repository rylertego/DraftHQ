"use client";

import { useEffect, useRef, useState } from "react";

export interface LandmineAnimationProps {
  playerName: string;
  teamName: string;
  onDismiss: () => void;
}

export default function LandmineAnimation({ playerName, teamName, onDismiss }: LandmineAnimationProps) {
  const [phase, setPhase] = useState<"drop" | "explode" | "reveal">("drop");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // drop → explode → reveal → auto-dismiss
    timerRef.current = setTimeout(() => setPhase("explode"), 900);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (phase === "explode") {
      timerRef.current = setTimeout(() => setPhase("reveal"), 600);
    } else if (phase === "reveal") {
      timerRef.current = setTimeout(() => onDismiss(), 5000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, onDismiss]);

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
        @keyframes lm-reveal-in {
          0%   { transform: scale(0.6) translateY(30px); opacity: 0; }
          60%  { transform: scale(1.05) translateY(-4px); opacity: 1; }
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
          background: phase === "reveal"
            ? "radial-gradient(ellipse at center, rgba(255,60,0,0.18) 0%, rgba(0,0,0,0.92) 70%)"
            : "rgba(0,0,0,0.88)",
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

        {/* Explosion phase */}
        {phase === "explode" && (
          <div className="relative flex items-center justify-center">
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
              }}
            />
            <div
              style={{
                fontSize: "7rem",
                lineHeight: 1,
                animation: "lm-explode 0.6s ease-out forwards",
                filter: "drop-shadow(0 0 60px rgba(255,200,0,1))",
              }}
            >
              💥
            </div>
          </div>
        )}

        {/* Reveal phase */}
        {phase === "reveal" && (
          <div
            style={{
              animation: "lm-reveal-in 0.55s cubic-bezier(0.22,1,0.36,1) forwards",
              textAlign: "center",
              padding: "0 2rem",
              maxWidth: 560,
            }}
          >
            {/* Pulse ring behind icon */}
            <div className="relative mx-auto mb-4" style={{ width: 120, height: 120 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(255,60,0,0.35)",
                  animation: "lm-pulse-ring 1s ease-out infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(255,60,0,0.2)",
                  animation: "lm-pulse-ring 1s ease-out 0.4s infinite",
                }}
              />
              <div
                style={{
                  position: "relative",
                  fontSize: "4.5rem",
                  lineHeight: "120px",
                  textAlign: "center",
                  animation: "lm-flicker 2s ease-in-out infinite",
                }}
              >
                💣
              </div>
            </div>

            <p
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "rgba(255,120,50,0.9)",
                marginBottom: "0.5rem",
              }}
            >
              💥 LANDMINE 💥
            </p>

            <h1
              style={{
                fontSize: "2.5rem",
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.1,
                marginBottom: "0.75rem",
                textShadow: "0 0 40px rgba(255,100,0,0.7)",
              }}
            >
              {playerName}
            </h1>

            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.6)",
                fontWeight: 500,
              }}
            >
              drafted by <span style={{ color: "#fff", fontWeight: 700 }}>{teamName}</span>
            </p>

            <p
              style={{
                marginTop: "2.5rem",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.25)",
                letterSpacing: "0.05em",
              }}
            >
              click anywhere to dismiss
            </p>
          </div>
        )}
      </div>
    </>
  );
}
