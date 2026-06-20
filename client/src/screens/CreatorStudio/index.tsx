import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../../store";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";
import { CurrencyBar } from "../../components/CurrencyBar";
import { UpgradeShop } from "../../components/UpgradeShop";
import { SkillsPanel } from "../../components/SkillsPanel";
import type { UpgradePillar } from "../../features/upgrades/types";
import { followerChance, engagementPerTap, openingUpgradeCost } from "../../features/onboarding/helpers";
import type { OpeningUpgradeId } from "../../features/onboarding/types";
import { formatCount } from "../../lib/format";

type StudioTab = UpgradePillar;

export function CreatorStudio({ onClose }: { onClose: () => void }) {
  const legacyPreserved = useGameStore(state => state.onboardingTeachesSeen.legacy_preserved === true);
  if (!legacyPreserved) return <OpeningCreatorStudio onClose={onClose} />;
  return <FullCreatorStudio onClose={onClose} />;
}

function OpeningCreatorStudio({ onClose }: { onClose: () => void }) {
  const wallet = useGameStore(state => state.wallet);
  const levels = useGameStore(state => state.openingUpgradeLevels);
  const levelUpgrade = useGameStore(state => state.levelOpeningUpgrade);
  const [changed, setChanged] = useState<OpeningUpgradeId | null>(null);
  const cards: OpeningUpgradeId[] = levels.audience_reach >= 1 ? ["audience_reach", "engagement_rate"] : ["audience_reach"];
  const buy = (id: OpeningUpgradeId) => {
    if (!levelUpgrade(id)) return;
    setChanged(id);
    window.setTimeout(() => setChanged(null), 900);
  };
  return <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} style={{ position: "fixed", inset: 0, zIndex: 400, background: "var(--bg)", overflowY: "auto" }}>
    <header style={{ position: "sticky", top: 0, zIndex: 2, padding: "14px 16px 10px", background: "rgba(7,8,12,.96)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onClose} aria-label="Back to Home" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "white" }}>←</button>
        <div><div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: ".06em" }}>CREATOR STUDIO</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>MAKE YOUR NEXT TAP STRONGER</div></div>
        <strong style={{ marginLeft: "auto", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 25 }}>🪙 {formatCount(wallet.coins)}</strong>
      </div>
      <div style={{ marginTop: 12, width: 56, paddingBottom: 7, borderBottom: "2px solid var(--cyan)", color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 10, textAlign: "center" }}>FYP</div>
    </header>
    <div style={{ padding: "22px 16px 40px", maxWidth: 420, margin: "0 auto" }}>
      <AnimatePresence initial={false}>
        {cards.map(id => {
          const level = levels[id];
          const cost = openingUpgradeCost(id, level);
          const audience = id === "audience_reach";
          const current = audience ? followerChance(level) : engagementPerTap(level);
          const next = audience ? followerChance(level + 1) : engagementPerTap(level + 1);
          return <motion.section key={id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, boxShadow: changed === id ? "0 0 26px rgba(37,244,238,.3)" : "0 0 0 rgba(0,0,0,0)" }} style={{ marginBottom: 14, padding: 18, borderRadius: 16, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.045)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><strong style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{audience ? "AUDIENCE REACH" : "ENGAGEMENT RATE"}</strong><span style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)", fontSize: 10 }}>LV {level}</span></div>
            <p style={{ margin: "6px 0 14px", color: "var(--dim)", fontFamily: "var(--font-mono)", fontSize: 10 }}>{audience ? "Raises the chance that a TEB tap gains 1 Follower." : "Fills the Engagement meter faster per tap."}</p>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: changed === id ? "var(--cyan)" : "white" }}>{audience ? `${Math.round(current * 100)}% → ${Math.round(next * 100)}%` : `${current.toFixed(2)} → ${next.toFixed(2)}`} <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>{audience ? "FOLLOWER CHANCE" : "ENGAGEMENT / TAP"}</small></div>
            <button disabled={wallet.coins < cost} onClick={() => buy(id)} style={{ width: "100%", marginTop: 16, padding: 12, border: 0, borderRadius: 999, background: wallet.coins >= cost ? "var(--cyan)" : "rgba(255,255,255,.08)", color: wallet.coins >= cost ? "#040608" : "var(--dim)", fontFamily: "var(--font-mono)", fontWeight: 800, letterSpacing: ".12em" }}>UPGRADE · 🪙 {cost}</button>
          </motion.section>;
        })}
      </AnimatePresence>
    </div>
  </motion.div>;
}

function FullCreatorStudio({ onClose }: { onClose: () => void }) {
  const metricsReached    = useGameStore(s => s.metricsReached);
  const affordablePillars = useGameStore(s => s.affordablePillars);
  const viewerUnlocked    = isFeatureUnlocked("viewer",  metricsReached);
  const postingUnlocked   = isFeatureUnlocked("posting", metricsReached);
  const liveUnlocked      = isFeatureUnlocked("live",    metricsReached);

  const availableTabs: StudioTab[] = [
    ...(viewerUnlocked  ? ["viewer"]  as const : []),
    ...(postingUnlocked ? ["posting"] as const : []),
    ...(liveUnlocked    ? ["live"]    as const : []),
  ];

  const [activeTab, setActiveTab] = useState<StudioTab>(
    availableTabs[0] ?? "viewer",
  );

  const TAB_LABELS: Record<StudioTab, string> = {
    viewer:  "VIEWER",
    posting: "POSTING",
    live:    "LIVE",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        zIndex: 400,
        display: 'flex', flexDirection: 'column',
        overflowY: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--text)', letterSpacing: '0.06em', lineHeight: 1 }}>
            CREATOR STUDIO
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.2em', marginTop: '2px' }}>
            YOUR UPGRADE HUB
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onClose}
          style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '50%',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            color: 'var(--dim)',
          }}
        >
          ✕
        </motion.button>
      </div>

      {/* ── Pill tabs ── */}
      {availableTabs.length > 1 && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          padding: '10px 16px 0',
          gap: 6,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {availableTabs.map(tab => {
            const hasBadge = affordablePillars.includes(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  position: 'relative',
                  padding: '7px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.16em',
                  color: activeTab === tab ? 'var(--cyan)' : 'var(--dim)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--cyan)' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: -1,
                }}
              >
                {TAB_LABELS[tab]}
                {hasBadge && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--red)',
                    boxShadow: '0 0 5px var(--red)',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Currency bar (sticky, stays visible while the list scrolls) ── */}
      <CurrencyBar />

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 40, paddingTop: 16 }}
          >
            {activeTab === "viewer" && <ViewerSection />}
            {activeTab === "posting" && <PostingSection />}
            {activeTab === "live" && <LiveSection />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── VIEWER section: clicker upgrades + element unlocks ───────────────────────

function ViewerSection() {
  return (
    <>
      <UpgradeShop pillar="viewer" />
      <SectionDivider />
      <SkillsPanel pillar="viewer" />
      {/* 16.1: ElementUnlockSection hidden — elements paused, re-home as TEB nodes later */}
    </>
  );
}

// ── POSTING section: posting-pillar upgrades (placeholder until 10.2) ────────

function PostingSection() {
  return (
    <>
      <UpgradeShop pillar="posting" />
      <SkillsPanel pillar="posting" />
      <div style={{
        padding: '32px 16px',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--dim)',
        letterSpacing: '0.12em',
      }}>
        POSTING UPGRADES COMING SOON
      </div>
    </>
  );
}

// ── LIVE section: run-stat gear + run skills ──────────────────────────────────

function LiveSection() {
  return (
    <>
      <UpgradeShop pillar="live" />
      <SectionDivider />
      <SkillsPanel pillar="live" />
    </>
  );
}


// ── Shared divider ────────────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', margin: '16px 0' }}>
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
    </div>
  );
}
