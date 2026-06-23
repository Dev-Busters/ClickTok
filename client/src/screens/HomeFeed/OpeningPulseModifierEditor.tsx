import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { normalizePulseAngle, OPENING_PULSE_ZONE_COST, openingPulseModifierLabel } from "../../features/onboarding/helpers";
import type { OpeningPulseModifierId, OpeningPulseModifierKind } from "../../features/onboarding/types";

type OpeningPulseModifierEditorProps = {
  angle: number;
  valid: boolean;
  canAfford: boolean;
  coins: number;
  firstPlacement: boolean;
  selectedId: OpeningPulseModifierId;
  selectedKind: OpeningPulseModifierKind;
  selectedOwned: boolean;
  ownedIds: readonly OpeningPulseModifierId[];
  onSelectZone: (id: OpeningPulseModifierId) => void;
  onAngleChange: (angle: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const ZONE_OPTIONS: ReadonlyArray<{ id: OpeningPulseModifierId; kind: OpeningPulseModifierKind; title: string; copy: string; color: string }> = [
  { id: "passive_boost_1", kind: "passive", title: "PASSIVE BOOST", copy: "Arms the next event for +1 Follower if you tap it.", color: "#b56cff" },
  { id: "blue_event_1", kind: "event", title: "BLUE EVENT", copy: "Tap for +2 Followers, then the pulse reverses direction.", color: "#37a6ff" },
];

function pointerAngle(event: PointerEvent<HTMLDivElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  return normalizePulseAngle(Math.atan2(x, -y) * 180 / Math.PI);
}

export function OpeningPulseModifierEditor({ angle, valid, canAfford, coins, firstPlacement, selectedId, selectedKind, selectedOwned, ownedIds, onSelectZone, onAngleChange, onConfirm, onCancel }: OpeningPulseModifierEditorProps) {
  const activePointer = useRef<number | null>(null);
  const confirmEnabled = valid && (selectedOwned || canAfford);

  const moveFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    onAngleChange(pointerAngle(event));
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 12 : 3;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onAngleChange(normalizePulseAngle(angle - step));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onAngleChange(normalizePulseAngle(angle + step));
    } else if (event.key === "Enter" && confirmEnabled) {
      event.preventDefault();
      onConfirm();
    } else if (event.key === "Escape" && !firstPlacement) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <>
      <div
        data-pulse-modifier-editor
        data-draft-angle={Math.round(angle)}
        data-placement-valid={valid ? "true" : "false"}
        role="slider"
        tabIndex={0}
        aria-label="Second timing zone position"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(angle)}
        aria-valuetext={`${Math.round(angle)} degrees, ${valid ? "available" : "overlapping an active zone"}`}
        onKeyDown={keyDown}
        onPointerDown={event => {
          if (!event.isPrimary || !["mouse", "touch", "pen"].includes(event.pointerType)) return;
          event.preventDefault();
          event.stopPropagation();
          activePointer.current = event.pointerId;
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
          moveFromPointer(event);
        }}
        onPointerMove={event => {
          if (activePointer.current !== event.pointerId) return;
          event.preventDefault();
          moveFromPointer(event);
        }}
        onPointerUp={event => {
          if (activePointer.current === event.pointerId) activePointer.current = null;
        }}
        onPointerCancel={event => {
          if (activePointer.current === event.pointerId) activePointer.current = null;
        }}
        onLostPointerCapture={event => {
          if (activePointer.current === event.pointerId) activePointer.current = null;
        }}
        style={{ position: "absolute", inset: -20, zIndex: 20, borderRadius: "50%", cursor: "grab", touchAction: "none", boxShadow: valid ? `0 0 0 1px ${selectedKind === "event" ? "rgba(55,166,255,.22)" : "rgba(181,108,255,.22)"}` : "0 0 0 1px rgba(255,49,93,.3)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ position: "absolute", zIndex: 24, top: 226, left: "50%", translate: "-50% 0", width: 292, padding: 12, borderRadius: 13, border: `1px solid ${valid ? selectedKind === "event" ? "rgba(55,166,255,.58)" : "rgba(181,108,255,.58)" : "rgba(255,49,93,.65)"}`, background: "rgba(6,9,13,.96)", boxShadow: "0 14px 38px rgba(0,0,0,.5)", textAlign: "center" }}
      >
        <strong style={{ display: "block", color: valid ? selectedKind === "event" ? "#65bdff" : "#d2a8ff" : "#ff607f", fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: ".07em" }}>{valid ? "TEB EDITOR" : "ZONE OVERLAP"}</strong>
        <span style={{ display: "block", margin: "2px 0 9px", color: "rgba(255,255,255,.62)", fontFamily: "var(--font-mono)", fontSize: 8, lineHeight: 1.45, letterSpacing: ".08em" }}>{valid ? "SELECT A ZONE · DRAG GHOST · ARROWS FINE-TUNE" : "MOVE THE RED GHOST AWAY FROM ACTIVE ZONES"}</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
          {ZONE_OPTIONS.map(option => {
            const selected = option.id === selectedId;
            const owned = ownedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectZone(option.id)}
                data-teb-zone-option={option.id}
                data-selected={selected ? "true" : "false"}
                style={{
                  minHeight: 76,
                  padding: "9px 8px",
                  borderRadius: 11,
                  border: `1px solid ${selected ? option.color : "rgba(255,255,255,.12)"}`,
                  background: selected ? `${option.color}22` : "rgba(255,255,255,.045)",
                  color: "white",
                  textAlign: "left",
                  boxShadow: selected ? `0 0 18px ${option.color}33` : "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, color: option.color, fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 900, letterSpacing: ".08em" }}>
                  {option.title}
                  <span style={{ color: owned ? "#75ffb5" : "var(--gold)" }}>{owned ? "OWNED" : `${OPENING_PULSE_ZONE_COST}G`}</span>
                </span>
                <span style={{ display: "block", marginTop: 5, color: "rgba(255,255,255,.62)", fontFamily: "var(--font-mono)", fontSize: 7.5, lineHeight: 1.35, letterSpacing: ".035em" }}>{option.copy}</span>
              </button>
            );
          })}
        </div>
        <div style={{ marginBottom: 9, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,.55)", letterSpacing: ".08em" }}>
          <span>{openingPulseModifierLabel(selectedId)}</span>
          <span style={{ color: canAfford || selectedOwned ? "var(--gold)" : "#ff607f" }}>{coins} GOLD</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!firstPlacement && <button onClick={onCancel} style={{ flex: 1, minHeight: 40, borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.72)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 900, letterSpacing: ".1em" }}>CANCEL</button>}
          <button disabled={!confirmEnabled} onClick={onConfirm} style={{ flex: 1.4, minHeight: 40, border: 0, borderRadius: 999, background: confirmEnabled ? selectedKind === "event" ? "#37a6ff" : "#b56cff" : "rgba(255,49,93,.18)", color: confirmEnabled ? "#041008" : "rgba(255,255,255,.35)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 900, letterSpacing: ".1em", cursor: confirmEnabled ? "pointer" : "not-allowed" }}>{!valid ? "MOVE ZONE" : !selectedOwned && !canAfford ? "NEED 5 GOLD" : selectedOwned ? "MOVE ZONE" : firstPlacement && Math.round(angle) === 180 ? "BUY AT 6 O'CLOCK" : "BUY + PLACE"}</button>
        </div>
      </motion.div>
    </>
  );
}
