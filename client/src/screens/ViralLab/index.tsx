import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BALANCE } from "../../features/economy/balance";
import {
  viralityUpgradeCost,
  viralityUpgradeValue,
  visibleViralityUpgrades,
  VIRALITY_UPGRADES,
} from "../../features/virality/catalog";
import type { ViralityUpgradeId } from "../../features/virality/types";
import { formatCount } from "../../lib/format";
import { useGameStore } from "../../store";

/**
 * THE VIRAL LAB — the Virality shop (docs/18 §4).
 *
 * Deliberately a full-screen sheet rather than a sixth bottom-nav tab: locked design
 * decision #4 fixes the nav at TikTok's five (Home / Discover / ＋ / Inbox / Profile),
 * and Creator Studio already establishes "shop = sheet" as the pattern here.
 *
 * Header lives outside the scrollable region (flex layout), NOT `position: sticky`
 * inside it — sticky inside a Framer Motion element that animates a transform is a known
 * iOS Safari failure mode where the header scrolls out of reach with no way back.
 */
export function ViralLab({ onClose }: { onClose: () => void }) {
  const wallet = useGameStore(state => state.wallet);
  const levels = useGameStore(state => state.viralityUpgradeLevels);
  const buy = useGameStore(state => state.levelViralityUpgrade);
  const [changed, setChanged] = useState<{ id: ViralityUpgradeId; kind: "unlocked" | "leveled" } | null>(null);

  const cards = visibleViralityUpgrades(levels);
  const owned = VIRALITY_UPGRADES.reduce((sum, upgrade) => sum + levels[upgrade.id], 0);
  const perWord = BALANCE.onboarding.virality.perWord + BALANCE.onboarding.virality.perLetter * 5;

  const purchase = (id: ViralityUpgradeId) => {
    const kind = levels[id] === 0 ? "unlocked" : "leveled";
    if (!buy(id)) return;
    setChanged({ id, kind });
    window.setTimeout(() => setChanged(null), 900);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed", inset: 0, zIndex: 400, background: "var(--bg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      <header style={{ flexShrink: 0, zIndex: 2, padding: "14px 16px 12px", background: "rgba(7,8,12,.96)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onClose}
            aria-label="Back to Home"
            style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "white" }}
          >←</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 27, letterSpacing: ".06em", lineHeight: 1 }}>THE VIRAL LAB</div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.4, color: "rgba(255,255,255,.66)", letterSpacing: ".08em" }}>
              SPEND VIRALITY · GO VIRAL HARDER
            </div>
          </div>
          <strong
            data-virality-balance
            style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 5, color: "var(--red)", fontFamily: "var(--font-display)", fontSize: 25, textShadow: "0 0 14px rgba(255,31,75,.55)" }}
          >🔥 {formatCount(Math.floor(wallet.virality))}</strong>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "18px 16px 40px" }}>
        <div style={{ maxWidth: 420, margin: "0 auto" }}>

          {/* Where the currency comes from. The Lab is the only place it's spent, and the
              letter chain is the only place it's earned — say both, once, up front. */}
          <section style={{ marginBottom: 20, padding: "13px 15px", borderRadius: 14, border: "1px solid rgba(255,31,75,.3)", background: "linear-gradient(145deg,rgba(38,12,20,.9),rgba(14,16,22,.96))" }}>
            <strong style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 900, letterSpacing: ".14em", color: "var(--red)" }}>HOW TO EARN VIRALITY</strong>
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,.76)" }}>
              Catch the <strong style={{ color: "var(--gold)" }}>V·I·R·A·L</strong> letters in your feed, in order.
              Each letter pays {BALANCE.onboarding.virality.perLetter}, and finishing the word
              pays {BALANCE.onboarding.virality.perWord} more — <strong style={{ color: "#fff" }}>{perWord} per word</strong>.
              It's the only way to earn it.
            </p>
          </section>

          <AnimatePresence initial={false}>
            {cards.map(def => {
              const level = levels[def.id];
              const cost = viralityUpgradeCost(def.id, level);
              const isNew = level === 0;
              const justChanged = changed?.id === def.id;
              const affordable = wallet.virality >= cost;
              const accent = isNew ? def.color : "var(--cyan)";
              return (
                <motion.section
                  key={def.id}
                  data-virality-upgrade={def.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{
                    opacity: 1, y: 0,
                    boxShadow: justChanged
                      ? `0 0 30px color-mix(in srgb, ${def.color} 45%, transparent)`
                      : isNew ? `0 0 20px color-mix(in srgb, ${def.color} 14%, transparent)` : "0 0 0 rgba(0,0,0,0)",
                  }}
                  style={{
                    marginBottom: 14, padding: 18, borderRadius: 16,
                    border: `1px solid ${isNew ? `color-mix(in srgb, ${def.color} 55%, transparent)` : "rgba(255,255,255,.14)"}`,
                    background: "linear-gradient(145deg,rgba(26,29,38,.98),rgba(14,16,22,.98))",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontFamily: "var(--font-display)", fontSize: 23, lineHeight: 1, color: def.color }}>{def.name}</strong>
                    <span style={{
                      flexShrink: 0, padding: "5px 7px", borderRadius: 999,
                      border: `1px solid ${accent}`, background: "rgba(255,255,255,.04)",
                      fontFamily: "var(--font-mono)", color: accent, fontSize: 9, fontWeight: 900, letterSpacing: ".08em",
                    }}>{isNew ? "NEW" : `LEVEL ${level}`}</span>
                  </div>

                  <p style={{ margin: "9px 0 15px", color: "rgba(255,255,255,.76)", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.55 }}>{def.blurb}</p>

                  <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 7px", fontFamily: "var(--font-display)", fontSize: 28, color: justChanged ? def.color : "white" }}>
                    {viralityUpgradeValue(def.id, level)} → {viralityUpgradeValue(def.id, level + 1)}
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "rgba(255,255,255,.6)" }}>{def.unit}</small>
                  </div>

                  <button
                    disabled={!affordable}
                    onClick={() => purchase(def.id)}
                    style={{
                      width: "100%", marginTop: 16, padding: 13, border: 0, borderRadius: 999,
                      background: affordable ? def.color : "rgba(255,255,255,.1)",
                      color: affordable ? "#040608" : "rgba(255,255,255,.45)",
                      fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 900, letterSpacing: ".12em",
                      cursor: affordable ? "pointer" : "not-allowed",
                    }}
                  >{isNew ? "UNLOCK" : "LEVEL UP"} · 🔥 {cost}</button>
                </motion.section>
              );
            })}
          </AnimatePresence>

          {/* Tells the player more exists without spoiling what — the same drip the
              onboarding ladder uses, so the Lab keeps a reason to come back. */}
          {cards.length < VIRALITY_UPGRADES.length && (
            <div style={{ marginTop: 4, padding: "14px 12px", borderRadius: 12, border: "1px dashed rgba(255,255,255,.16)", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", color: "rgba(255,255,255,.42)" }}>
              {VIRALITY_UPGRADES.length - cards.length} MORE UNLOCK AS YOU BUY · {owned} OWNED
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
