import { motion } from "framer-motion";
import { formatCount } from "../../lib/format";
import type { WatchDrop } from "../../store/slices/spectateSlice";

// ——— Viewer result sheet ————————————————————————————————————————————————————

export function DropSheet({ drop, onBack }: { drop: WatchDrop; onBack: () => void }) {
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
