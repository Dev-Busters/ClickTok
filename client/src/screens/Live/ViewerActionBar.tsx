import { motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { useGameStore } from "../../store";
import { formatCount } from "../../lib/format";
import { BALANCE } from "../../features/economy/balance";
import type { GiftTier, LiveStreamSummary, QuickChatId } from "../../party/types";
import { spectatorSocketRef } from "../../party/socketRefs";

// ——— Viewer action bar (4.3) ————————————————————————————————————————————————

const QUICK_CHAT_PRESETS: { id: QuickChatId; label: string }[] = [
  { id: "w", label: "W" },
  { id: "fire", label: "🔥🔥🔥" },
  { id: "icon", label: "an icon" },
  { id: "ratio", label: "ratio" },
];

const GIFT_TIERS: GiftTier[] = ["rose", "heart", "galaxy", "lion"];
const GIFT_EMOJI_VIB: Record<GiftTier, string> = { rose: "🌹", heart: "💗", galaxy: "🌌", lion: "🦁" };

export function ViewerActionBar({ spectating }: { spectating: LiveStreamSummary | null }) {
  const coins = useGameStore(s => s.wallet.coins);
  const liveSnapshot = useGameStore(s => s.liveSnapshot);
  const activePoll = useGameStore(s => s.activePoll);
  const myVotedChoiceIndex = useGameStore(s => s.myVotedChoiceIndex);
  const currentPollTally = useGameStore(s => s.currentPollTally);
  const recordViewerTap = useGameStore(s => s.recordViewerTap);
  const sendViewerGift = useGameStore(s => s.sendViewerGift);
  const castVote = useGameStore(s => s.castVote);

  // Tap accumulation: batched into ≤1 msg/sec.
  const tapAccumRef = useRef(0);
  const lastBatchRef = useRef(0);
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [chatCooldowns, setChatCooldowns] = useState<Partial<Record<QuickChatId, number>>>({});
  const [tapBurst, setTapBurst] = useState(0);

  const clockSec = liveSnapshot?.clockSec ?? 0;
  const earlyWindow = clockSec <= BALANCE.social.earlyBackerWindowSec;

  const handleHypeTap = useCallback(() => {
    tapAccumRef.current += 1;
    setTapBurst(b => b + 1);
    setTimeout(() => setTapBurst(b => Math.max(0, b - 1)), 600);
    recordViewerTap(1);

    const now = Date.now();
    if (now - lastBatchRef.current >= BALANCE.social.tapBatchSec * 1000) {
      lastBatchRef.current = now;
      const taps = Math.min(tapAccumRef.current, Math.round(BALANCE.social.tapMaxPerSec * BALANCE.social.tapBatchSec));
      tapAccumRef.current = 0;
      if (taps > 0) {
        spectatorSocketRef.current?.send(JSON.stringify({ type: "hypeTap", taps }));
      }
    }
  }, [recordViewerTap]);

  const handleQuickChat = (preset: QuickChatId) => {
    const now = Date.now();
    if ((chatCooldowns[preset] ?? 0) > now) return;
    setChatCooldowns(prev => ({ ...prev, [preset]: now + BALANCE.social.quickChatCooldownSec * 1000 }));
    spectatorSocketRef.current?.send(JSON.stringify({ type: "quickChat", preset }));
  };

  const handleGift = (tier: GiftTier) => {
    sendViewerGift(tier);
    setShowGiftDrawer(false);
  };

  const totalVotes = currentPollTally ? currentPollTally.reduce((a, b) => a + b, 0) : 0;

  return (
    <div style={{ padding: "8px 12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Poll overlay — appears when streamer has an active choice event */}
      {activePoll && spectating && (
        <div style={{
          background: "rgba(0,0,0,0.7)",
          border: "1px solid var(--gold)",
          borderRadius: "10px",
          padding: "10px 12px",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--gold)", letterSpacing: "0.14em", marginBottom: "6px" }}>
            AUDIENCE POLL
          </div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "var(--text)", marginBottom: "8px" }}>
            {activePoll.prompt}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {activePoll.options.map((opt, i) => {
              const voted = myVotedChoiceIndex === i;
              const voteCount = currentPollTally?.[i] ?? 0;
              const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => castVote(activePoll.pollId, i)}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    padding: "7px 10px",
                    fontFamily: "var(--font-ui)",
                    fontSize: "12px",
                    textAlign: "left",
                    color: voted ? "#000" : "var(--text)",
                    background: voted ? "var(--gold)" : "rgba(255,255,255,0.06)",
                    border: voted ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "6px",
                    cursor: myVotedChoiceIndex !== null ? "default" : "pointer",
                  }}
                >
                  {currentPollTally && (
                    <div style={{
                      position: "absolute",
                      left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: voted ? "rgba(0,0,0,0.12)" : "rgba(37,244,238,0.12)",
                      transition: "width 0.4s ease",
                    }} />
                  )}
                  <span style={{ position: "relative" }}>
                    {opt}{currentPollTally ? ` · ${pct}%` : ""}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Gift drawer */}
      {showGiftDrawer && (
        <div style={{
          background: "rgba(0,0,0,0.8)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "10px",
          padding: "10px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.14em" }}>
              SEND GIFT
            </span>
            {earlyWindow && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: "999px", padding: "2px 7px" }}>
                EARLY 🚀 JACKPOT ×3
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {GIFT_TIERS.map(tier => {
              const cost = BALANCE.run.giftCoinValue[tier];
              const canAfford = coins >= cost;
              return (
                <motion.button
                  key={tier}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => canAfford && handleGift(tier)}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                    padding: "8px 4px",
                    background: canAfford ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${canAfford ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}`,
                    borderRadius: "8px",
                    cursor: canAfford ? "pointer" : "default",
                    opacity: canAfford ? 1 : 0.45,
                  }}
                >
                  <span style={{ fontSize: "18px" }}>{GIFT_EMOJI_VIB[tier]}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--gold)" }}>
                    {formatCount(cost)}🪙
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main row: heart + quick-chat + gift */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Heart / hype-tap button */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleHypeTap}
          style={{
            width: "48px",
            height: "48px",
            flexShrink: 0,
            borderRadius: "50%",
            background: "rgba(255,31,75,0.18)",
            border: "1.5px solid var(--red)",
            fontSize: tapBurst > 0 ? "24px" : "20px",
            transition: "font-size 0.1s",
            cursor: "pointer",
          }}
        >
          ❤️
        </motion.button>

        {/* Quick-chat pills */}
        <div style={{ flex: 1, display: "flex", gap: "5px", overflow: "hidden" }}>
          {QUICK_CHAT_PRESETS.map(({ id, label }) => {
            const onCooldown = (chatCooldowns[id] ?? 0) > Date.now();
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.93 }}
                onClick={() => handleQuickChat(id)}
                style={{
                  flexShrink: 0,
                  padding: "6px 10px",
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  color: onCooldown ? "var(--dim)" : "var(--text)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "999px",
                  cursor: onCooldown ? "default" : "pointer",
                  opacity: onCooldown ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {label}
              </motion.button>
            );
          })}
        </div>

        {/* Gift button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setShowGiftDrawer(d => !d)}
          style={{
            flexShrink: 0,
            padding: "8px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            color: "#fff",
            background: showGiftDrawer ? "rgba(245,166,35,0.28)" : "rgba(255,255,255,0.08)",
            border: `1px solid ${showGiftDrawer ? "var(--gold)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: "999px",
            cursor: "pointer",
          }}
        >
          🎁 GIFT
        </motion.button>
      </div>
    </div>
  );
}
