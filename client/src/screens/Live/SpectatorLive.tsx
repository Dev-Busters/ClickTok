import { motion } from "framer-motion";
import { useGameStore } from "../../store";
import { ProgressBar } from "../../components/ProgressBar";
import { HeartRain } from "../../components/HeartRain";
import { VideoCanvas } from "../../components/VideoCanvas";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";
import { hypeColor, formatTimer } from "./shared";
import { SpectatorFeed } from "./SpectatorFeed";
import { DropSheet } from "./DropSheet";
import { ViewerActionBar } from "./ViewerActionBar";

// ——— Spectator Live screen ————————————————————————————————————————————————————

export function SpectatorLive() {
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
        <ProgressBar value={hype} color={hypeColor(hype)} label="HYPE" segments={10} />
      </div>

      {/* Stage + spectator feed */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <VideoCanvas
          seed={`${spectating.streamId}${spectating.handle}`}
          topic={spectating.topic}
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
        <HeartRain hype={hype} />
        <SpectatorFeed events={spectateFeed} />
      </div>

      <ViewerActionBar spectating={spectating} />
    </div>
  );
}
