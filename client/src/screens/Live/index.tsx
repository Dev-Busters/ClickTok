import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { useGameStore } from "../../store";
import { useRunLoop } from "../../hooks/useRunLoop";
import { ProgressBar } from "../../components/ProgressBar";
import { LiveFeed } from "../../components/LiveFeed";
import { ReactionHotbar } from "../../components/ReactionHotbar";
import { HeartRain } from "../../components/HeartRain";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";
import { BALANCE } from "../../features/economy/balance";
import type { GiftTier, LiveStreamSummary, QuickChatId, SpectatorEvent } from "../../party/types";
import { spectatorSocketRef, streamerSendRef } from "../../party/socketRefs";
import type { WatchDrop } from "../../store/slices/spectateSlice";

function hypeColor(hype: number): string {
  if (hype >= 80) return 'var(--red)';
  if (hype >= 50) return 'var(--gold)';
  return 'var(--cyan)';
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const GRADE_COLOR: Record<string, string> = {
  S: 'var(--gold)',
  A: 'var(--cyan)',
  B: 'var(--text)',
  C: 'var(--dim)',
  D: 'var(--dim)',
  FLOP: 'var(--red)',
};

// ——— Spectator feed (read-only) ——————————————————————————————————————————————

const CHAT_NAMES = [
  "sk8rboi_22", "luvr.gurl", "xX_dr4gon_Xx", "mia.lol", "notyourbf",
  "pixel.pup", "ratio_king", "zoomin_zara", "yeet_lord", "chronically.on",
  "vibes0nly", "g0blincore", "sleepy.steve", "itsgigi", "fr_fr_no_cap",
];

const GIFT_EMOJI: Record<string, string> = {
  rose: "🌹", heart: "💗", galaxy: "🌌", lion: "🦁",
};

function eventHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h;
}

function SpecFeedItem({ ev }: { ev: SpectatorEvent }) {
  const h = eventHash(ev.id);
  const name = ev.fromHandle ?? CHAT_NAMES[h % CHAT_NAMES.length];
  const hue = h % 360;
  const isReal = ev.real;

  if (ev.type === "gift" && ev.giftTier) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        style={{
          alignSelf: "flex-end",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "7px 13px",
          background: "rgba(0,0,0,0.55)",
          border: isReal ? "1px solid var(--cyan)" : "1px solid var(--gold)",
          borderRadius: "999px",
          boxShadow: isReal ? "0 0 12px rgba(37,244,238,0.3)" : "0 0 12px rgba(245,166,35,0.25)",
        }}
      >
        <span style={{ fontSize: "18px" }}>{GIFT_EMOJI[ev.giftTier] ?? "🎁"}</span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#fff" }}>
          {ev.giftTier.charAt(0).toUpperCase() + ev.giftTier.slice(1)}
        </span>
        {isReal && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--cyan)" }}>
            @{name}
          </span>
        )}
      </motion.div>
    );
  }

  const danger = ev.type === "troll";
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      style={{
        alignSelf: "flex-start",
        maxWidth: "80%",
        display: "flex",
        alignItems: "flex-start",
        gap: "7px",
        padding: "6px 12px 6px 7px",
        background: "rgba(0,0,0,0.4)",
        borderRadius: "16px",
        border: isReal ? "1px solid rgba(37,244,238,0.4)" : "none",
        boxShadow: isReal ? "0 0 8px rgba(37,244,238,0.2)" : "none",
      }}
    >
      <div style={{
        width: "22px", height: "22px", flexShrink: 0,
        borderRadius: "50%",
        background: `linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${(hue + 70) % 360},65%,38%))`,
      }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 600,
          color: danger ? "var(--red)" : isReal ? "var(--cyan)" : "rgba(255,255,255,0.55)",
        }}>
          {isReal ? `@${name}` : name}
        </span>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: "13px",
          color: danger ? "var(--red)" : "#fff",
          lineHeight: 1.25,
        }}>
          {danger ? `😡 ${ev.text ?? ""}` : (ev.text ?? "")}
        </span>
      </div>
    </motion.div>
  );
}

function SpectatorFeed({ events }: { events: SpectatorEvent[] }) {
  const nonWaves = events.filter(e => e.type !== "hype_wave");
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: "12px",
        right: "12px",
        bottom: "8px",
        maxHeight: "65%",
        display: "flex",
        flexDirection: "column-reverse",
        gap: "7px",
        overflow: "hidden",
        maskImage: "linear-gradient(180deg, transparent 0%, black 18%)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 18%)",
      }}>
        <AnimatePresence initial={false}>
          {[...nonWaves].reverse().map(ev => (
            <SpecFeedItem key={ev.id} ev={ev} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ——— Viewer result sheet ————————————————————————————————————————————————————

function DropSheet({ drop, onBack }: { drop: WatchDrop; onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div className="chroma" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.06em", color: "var(--text)" }}>
        WATCH DROP
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--dim)", letterSpacing: "0.12em" }}>
        {drop.watchSec}s watched
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px 20px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--cyan)",
        borderRadius: "4px",
        minWidth: "220px",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.18em", marginBottom: "2px" }}>
          REWARDS
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--gold)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--gold)" }} />
            Coins
          </span>
          <span>+{formatCount(drop.coins)}</span>
        </div>
        {drop.diamonds > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--cyan)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
              <span style={{ width: "8px", height: "8px", background: "var(--cyan)", transform: "rotate(45deg)" }} />
              Diamond
            </span>
            <span>+{drop.diamonds}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)" }}>
          <span>❤️ Likes</span>
          <span>+{formatCount(drop.likes)}</span>
        </div>
        {drop.followers > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)" }}>
            <span>👤 Followers</span>
            <span>+{drop.followers}</span>
          </div>
        )}
        {drop.jackpotCoins > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontFamily: "var(--font-mono)", fontSize: "13px",
            color: "var(--gold)",
            borderTop: "1px solid var(--gold)",
            paddingTop: "6px",
            marginTop: "2px",
          }}>
            <span>🚀 EARLY JACKPOT</span>
            <span>+{formatCount(drop.jackpotCoins)}</span>
          </div>
        )}
        {drop.shoutoutFollowers > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontFamily: "var(--font-mono)", fontSize: "13px",
            color: "var(--cyan)",
            borderTop: "1px solid var(--cyan)",
            paddingTop: "6px",
            marginTop: "2px",
          }}>
            <span>📣 SHOUTOUT</span>
            <span>+{drop.shoutoutFollowers} 👤</span>
          </div>
        )}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onBack}
        style={{
          padding: "14px 28px",
          fontFamily: "var(--font-display)",
          fontSize: "18px",
          letterSpacing: "0.12em",
          color: "#000",
          background: "var(--cyan)",
          border: "none",
          cursor: "pointer",
        }}
      >
        BACK TO DISCOVER
      </motion.button>
    </motion.div>
  );
}

// ——— Viewer action bar (4.3) ————————————————————————————————————————————————

const QUICK_CHAT_PRESETS: { id: QuickChatId; label: string }[] = [
  { id: "w", label: "W" },
  { id: "fire", label: "🔥🔥🔥" },
  { id: "icon", label: "an icon" },
  { id: "ratio", label: "ratio" },
];

const GIFT_TIERS: GiftTier[] = ["rose", "heart", "galaxy", "lion"];
const GIFT_EMOJI_VIB: Record<GiftTier, string> = { rose: "🌹", heart: "💗", galaxy: "🌌", lion: "🦁" };

function ViewerActionBar({ spectating }: { spectating: LiveStreamSummary | null }) {
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

// ——— Spectator Live screen ————————————————————————————————————————————————————

function SpectatorLive() {
  const spectating = useGameStore(s => s.spectating);
  const liveSnapshot = useGameStore(s => s.liveSnapshot);
  const spectateFeed = useGameStore(s => s.spectateFeed);
  const realViewers = useGameStore(s => s.realViewers);
  const pendingDrop = useGameStore(s => s.pendingDrop);
  const leaveStream = useGameStore(s => s.leaveStream);
  const setTab = useGameStore(s => s.setTab);

  // After dismissing the drop sheet, go back to Discover.
  const handleBackToDiscover = () => {
    useGameStore.setState({ pendingDrop: null });
    setTab("discover");
  };

  // If the stream ended and the drop sheet is showing (spectating is now null).
  if (pendingDrop) {
    return (
      <div style={{ position: "absolute", inset: 0, background: "var(--bg)", zIndex: 50 }}>
        <DropSheet drop={pendingDrop} onBack={handleBackToDiscover} />
      </div>
    );
  }

  // Should always have spectating here, but guard for type safety.
  if (!spectating) return null;

  const snap = liveSnapshot;
  const hype = snap?.hype ?? spectating.hype;
  const viewers = snap?.viewers ?? spectating.viewers;
  const clockSec = snap?.clockSec ?? 0;
  const durationSec = snap?.durationSec ?? 180;
  const modifiers = snap?.modifiers ?? [];
  const streamHandle = spectating.handle;

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      zIndex: 50,
    }}>
      {/* Top bar — streamer's host pill + viewers + LEAVE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 12px 4px 4px", borderRadius: "999px", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: avatarGradient(streamHandle),
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid var(--red)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "12px", color: "#fff" }}>
              {streamHandle.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700, color: "#fff" }}>@{streamHandle}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.14em",
            color: "#fff", background: "var(--red)", borderRadius: "3px", padding: "2px 6px",
            animation: "dot-pulse 1.6s ease-in-out infinite",
          }}>
            LIVE
          </span>
          {realViewers > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--cyan)", letterSpacing: "0.08em" }}>
              👤 {realViewers} real
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6Z" />
            </svg>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
              {formatCount(viewers)}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => leaveStream()}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.14em",
              color: "#fff",
              background: "rgba(37,244,238,0.18)",
              border: "1px solid var(--cyan)",
              borderRadius: "999px",
              padding: "7px 14px",
              cursor: "pointer",
            }}
          >
            LEAVE
          </motion.button>
        </div>
      </div>

      {/* Topic + timer */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", padding: "8px 16px 0" }}>
        {snap && (
          <>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--gold)" }}>#{snap.topic}</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--text)", lineHeight: 1 }}>
              {formatTimer(durationSec - clockSec)}
            </span>
          </>
        )}
      </div>

      {/* Modifier chips */}
      {modifiers.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px", padding: "8px 16px 0" }}>
          {modifiers.map(modId => (
            <div
              key={modId}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.1em",
                color: "var(--gold)",
                border: "1px solid var(--gold)",
                borderRadius: "999px",
                padding: "3px 10px",
              }}
            >
              {modId.replace(/_/g, " ").toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Hype meter */}
      <div style={{ padding: "20px 16px 0" }}>
        <ProgressBar value={hype} color={hypeColor(hype)} label="HYPE" />
      </div>

      {/* Stage + spectator feed */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 60%, ${hypeColor(hype)}, transparent 70%)`,
          opacity: 0.10 + (hype / 100) * 0.22,
          transition: "opacity 0.5s",
          pointerEvents: "none",
        }} />
        <HeartRain hype={hype} />
        <SpectatorFeed events={spectateFeed} />
      </div>

      <ViewerActionBar spectating={spectating} />
    </div>
  );
}

// ——— Shoutout button (4.3) ——————————————————————————————————————————————————

function ShoutoutButton({ handle, streamerTotalFollowers }: { handle: string; streamerTotalFollowers: number }) {
  const [sent, setSent] = useState(false);
  const creatorLevel = 1 + Math.floor(Math.log10(Math.max(1, streamerTotalFollowers)));
  const followers = BALANCE.social.shoutoutFollowersPerLevel * creatorLevel;

  const doShoutout = () => {
    if (sent) return;
    setSent(true);
    streamerSendRef.current?.({ type: "shoutout", handle, followers });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.18em" }}>
        TOP GIFTER
      </div>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: "var(--text)" }}>
        @{handle}
      </div>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={doShoutout}
        disabled={sent}
        style={{
          padding: "10px 20px",
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          letterSpacing: "0.1em",
          color: sent ? "var(--dim)" : "#000",
          background: sent ? "rgba(255,255,255,0.08)" : "var(--gold)",
          border: sent ? "1px solid var(--dim)" : "none",
          cursor: sent ? "default" : "pointer",
        }}
      >
        {sent ? `SHOUTED OUT (+${formatCount(followers)} 👤)` : `📣 SHOUT OUT (+${formatCount(followers)} 👤)`}
      </motion.button>
    </div>
  );
}

// ——— Streamer Live screen (unchanged from pre-4.2) ————————————————————————————

function StreamerLive() {
  useRunLoop();

  const phase = useGameStore(s => s.phase);
  const params = useGameStore(s => s.params);
  const handle = useGameStore(s => s.handle);
  const viewers = useGameStore(s => s.viewers);
  const realViewers = useGameStore(s => s.realViewers);
  const peakViewers = useGameStore(s => s.peakViewers);
  const hype = useGameStore(s => s.hype);
  const clockSec = useGameStore(s => s.clockSec);
  const collected = useGameStore(s => s.collected);
  const lastResult = useGameStore(s => s.lastResult);
  const boonChoices = useGameStore(s => s.boonChoices);
  const realGiftLog = useGameStore(s => s.realGiftLog);
  const wallet = useGameStore(s => s.wallet);
  const endRun = useGameStore(s => s.endRun);
  const applyBoon = useGameStore(s => s.applyBoon);
  const returnToChannel = useGameStore(s => s.returnToChannel);
  const setTab = useGameStore(s => s.setTab);

  // 04 §12.3: display total = sim + realViewerWeight × realViewers.
  const displayViewers = Math.round(viewers + BALANCE.social.realViewerWeight * realViewers);
  // Top gifter from realGiftLog for the post-run shoutout.
  const topGifter = (() => {
    if (!realGiftLog.length) return null;
    const byHandle = new Map<string, number>();
    for (const g of realGiftLog) byHandle.set(g.handle, (byHandle.get(g.handle) ?? 0) + g.coins);
    let best: { handle: string; coins: number } | null = null;
    for (const [h, c] of byHandle) if (!best || c > best.coins) best = { handle: h, coins: c };
    return best;
  })();

  if (!params) return null;

  const handleBack = () => {
    returnToChannel();
    setTab("home");
  };

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      zIndex: 50,
    }}>
      {/* Top bar — TikTok LIVE: host pill left, viewers + end right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 12px 4px 4px", borderRadius: "999px", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: avatarGradient(handle),
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid var(--red)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "12px", color: "#fff" }}>
              {(handle || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700, color: "#fff" }}>@{handle}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.14em",
            color: "#fff", background: "var(--red)", borderRadius: "3px", padding: "2px 6px",
            animation: "dot-pulse 1.6s ease-in-out infinite",
          }}>
            LIVE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6Z" />
            </svg>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
              {formatCount(displayViewers)}
            </span>
            {realViewers > 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--cyan)", letterSpacing: "0.08em" }}>
                👤 {realViewers}
              </span>
            )}
          </div>
          {phase === "live" && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => endRun("voluntary")}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.14em",
                color: "#fff",
                background: "rgba(255,31,75,0.25)",
                border: "1px solid var(--red)",
                borderRadius: "999px",
                padding: "7px 14px",
                cursor: "pointer",
              }}
            >
              END
            </motion.button>
          )}
        </div>
      </div>

      {/* Topic + timer row */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", padding: "8px 16px 0" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--gold)" }}>#{params.topic}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--text)", lineHeight: 1 }}>
          {formatTimer(params.durationSec - clockSec)}
        </span>
      </div>

      {/* Run modifier chips (2.7) */}
      {params.modifiers.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px", padding: "8px 16px 0" }}>
          {params.modifiers.map(mod => (
            <div
              key={mod.id}
              title={mod.description}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.1em",
                color: "var(--gold)",
                border: "1px solid var(--gold)",
                borderRadius: "999px",
                padding: "3px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {mod.name.toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Hype meter */}
      <div style={{ padding: "20px 16px 0" }}>
        <ProgressBar value={hype} color={hypeColor(hype)} label="HYPE" />
      </div>

      {/* Stage + live feed */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 60%, ${hypeColor(hype)}, transparent 70%)`,
          opacity: 0.10 + (hype / 100) * 0.22,
          transition: "opacity 0.5s",
          pointerEvents: "none",
        }} />
        {phase === "live" && <HeartRain hype={hype} />}
        {phase === "live" && <LiveFeed />}
      </div>

      {/* Collected ticker */}
      {phase === "live" && (
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "6px 16px 4px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 600, color: "var(--gold)", background: "rgba(0,0,0,0.45)", borderRadius: "999px", padding: "4px 12px" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 5px var(--gold)" }} />
            {formatCount(collected.coins)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-ui)", fontSize: "12px", fontWeight: 600, color: "var(--cyan)", background: "rgba(0,0,0,0.45)", borderRadius: "999px", padding: "4px 12px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--cyan)", boxShadow: "0 0 5px var(--cyan)", transform: "rotate(45deg)" }} />
            {formatCount(collected.diamonds)}
          </span>
        </div>
      )}

      {/* Reaction hotbar */}
      {phase === "live" && <ReactionHotbar />}

      {/* Results overlay */}
      {phase === "results" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div className="chroma" style={{ fontFamily: "var(--font-display)", fontSize: "32px", letterSpacing: "0.06em", color: "var(--text)" }}>
            STREAM ENDED
          </div>
          {lastResult && (
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: "64px",
              lineHeight: 1,
              color: GRADE_COLOR[lastResult.grade] ?? "var(--text)",
              textShadow: `0 0 24px ${GRADE_COLOR[lastResult.grade] ?? "var(--text)"}`,
            }}>
              {lastResult.grade}
            </div>
          )}
          <div style={{ display: "flex", gap: "32px" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--cyan)" }}>{formatCount(peakViewers)}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.18em" }}>PEAK VIEWERS</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: hypeColor(hype) }}>{Math.round(hype)}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.18em" }}>FINAL HYPE</div>
            </div>
            {lastResult && (
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--gold)" }}>{lastResult.giftsCollected}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.18em" }}>GIFTS</div>
              </div>
            )}
          </div>
          {lastResult && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "14px 20px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--dim)",
              borderRadius: "4px",
              minWidth: "220px",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.18em", marginBottom: "2px" }}>
                REWARDS
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)" }}>
                <span>👥 Followers</span>
                <span>+{formatCount(lastResult.rewards.followers)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--gold)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--gold)" }} />
                  Coins
                </span>
                <span>+{formatCount(lastResult.rewards.coins)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--cyan)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "8px", height: "8px", background: "var(--cyan)", transform: "rotate(45deg)" }} />
                  Diamonds
                </span>
                <span>+{formatCount(lastResult.rewards.diamonds)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)" }}>
                <span>❤️ Likes</span>
                <span>+{formatCount(lastResult.rewards.likes)}</span>
              </div>
            </div>
          )}
          {boonChoices && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "280px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--dim)", letterSpacing: "0.18em" }}>
                PICK A BONUS
              </div>
              {boonChoices.map(boon => (
                <motion.button
                  key={boon.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => applyBoon(boon.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    padding: "10px 14px",
                    fontFamily: "var(--font-ui)",
                    textAlign: "left",
                    color: "var(--text)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--gold)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "15px", letterSpacing: "0.06em", color: "var(--gold)" }}>
                    {boon.name.toUpperCase()}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--dim)" }}>{boon.description}</span>
                </motion.button>
              ))}
            </div>
          )}

          {/* 4.3: Shoutout the top real gifter post-run */}
          {topGifter && (
            <ShoutoutButton
              handle={topGifter.handle}
              streamerTotalFollowers={wallet.totalFollowers}
            />
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleBack}
            style={{
              padding: "14px 28px",
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              letterSpacing: "0.12em",
              color: "#000",
              background: "var(--cyan)",
              border: "none",
              cursor: "pointer",
            }}
          >
            BACK TO CHANNEL
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

// ——— Top-level Live: routes to streamer or spectator mode ————————————————————

export function Live() {
  const spectating = useGameStore(s => s.spectating);
  const pendingDrop = useGameStore(s => s.pendingDrop);

  if (spectating !== null || pendingDrop !== null) {
    return <SpectatorLive />;
  }

  return <StreamerLive />;
}
