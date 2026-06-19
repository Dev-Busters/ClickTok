export function RhythmHud({ combo, quality }: { combo: number; quality: number }) {
  return <div style={{ position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: 14, right: 14, display: "flex", justifyContent: "space-between",
    fontFamily: "var(--font-display)", color: "white", textShadow: "0 2px 5px #000", pointerEvents: "none", zIndex: 4 }}>
    <span>{combo > 0 ? `×${combo}` : ""}</span><span>{Math.round(quality * 100)}%</span>
  </div>;
}
