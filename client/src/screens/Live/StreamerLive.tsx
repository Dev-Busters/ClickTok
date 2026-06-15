import { motion } from "framer-motion";
import { useState } from "react";
import { useGameStore } from "../../store";
import { useRunLoop } from "../../hooks/useRunLoop";
import { ProgressBar } from "../../components/ProgressBar";
import { LiveFeed } from "../../components/LiveFeed";
import { ReactionHotbar } from "../../components/ReactionHotbar";
import { HeartRain } from "../../components/HeartRain";
import { VideoCanvas } from "../../components/VideoCanvas";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";
import { BALANCE } from "../../features/economy/balance";
import { streamerSendRef } from "../../party/socketRefs";
import { hypeColor, formatTimer } from "./shared";

const GRADE_COLOR: Record<string, string> = {
  S: 'var(--gold)',
  A: 'var(--cyan)',
  B: 'var(--text)',
  C: 'var(--dim)',
  D: 'var(--dim)',
  FLOP: 'var(--red)',
};

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

export function StreamerLive() {
  useRunLoop();

  const phase = useGameStore(s => s.phase);
  const params = useGameStore(s => s.params);
  const handle = useGameStore(s => s.handle);
  const streamId = useGameStore(s => s.streamId);
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
        <ProgressBar value={hype} color={hypeColor(hype)} label="HYPE" segments={10} />
      </div>

      {/* Stream time progress bar */}
      {phase === "live" && params && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 16px 0" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", letterSpacing: "0.14em", color: "var(--dim)", flexShrink: 0 }}>
            STREAM TIME
          </span>
          <div style={{ flex: 1, height: "2px", background: "rgba(255,255,255,0.10)", borderRadius: "1px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, (clockSec / params.durationSec) * 100)}%`,
              background: "var(--cyan)",
              borderRadius: "1px",
              transition: "width 0.5s linear",
            }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "var(--dim)", flexShrink: 0 }}>
            {Math.max(0, Math.ceil((params.durationSec - clockSec) / 60))}m
          </span>
        </div>
      )}

      {/* Stage + live feed */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <VideoCanvas
          seed={streamId ? `${streamId}${handle}` : handle}
          topic={params.topic}
          intensity={hype / 100}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
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
