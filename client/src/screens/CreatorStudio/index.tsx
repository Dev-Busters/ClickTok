import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../../store";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";
import { CurrencyBar } from "../../components/CurrencyBar";
import { UpgradeShop } from "../../components/UpgradeShop";
import { SkillsPanel } from "../../components/SkillsPanel";
import type { UpgradePillar } from "../../features/upgrades/types";

type StudioTab = UpgradePillar;

export function CreatorStudio({ onClose }: { onClose: () => void }) {
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
