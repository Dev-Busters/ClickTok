import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { normalizePulseAngle } from "../../features/onboarding/helpers";

type OpeningPulseModifierEditorProps = {
  angle: number;
  valid: boolean;
  firstPlacement: boolean;
  onAngleChange: (angle: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function pointerAngle(event: PointerEvent<HTMLDivElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  return normalizePulseAngle(Math.atan2(x, -y) * 180 / Math.PI);
}

export function OpeningPulseModifierEditor({ angle, valid, firstPlacement, onAngleChange, onConfirm, onCancel }: OpeningPulseModifierEditorProps) {
  const activePointer = useRef<number | null>(null);

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
    } else if (event.key === "Enter" && valid) {
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
        style={{ position: "absolute", inset: -20, zIndex: 20, borderRadius: "50%", cursor: "grab", touchAction: "none", boxShadow: valid ? "0 0 0 1px rgba(73,255,154,.16)" : "0 0 0 1px rgba(255,49,93,.3)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ position: "absolute", zIndex: 24, top: 226, left: "50%", translate: "-50% 0", width: 276, padding: 12, borderRadius: 13, border: `1px solid ${valid ? "rgba(73,255,154,.5)" : "rgba(255,49,93,.65)"}`, background: "rgba(6,9,13,.96)", boxShadow: "0 14px 38px rgba(0,0,0,.5)", textAlign: "center" }}
      >
        <strong style={{ display: "block", color: valid ? "#75ffb5" : "#ff607f", fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: ".07em" }}>{valid ? "POSITION TIMING ZONE" : "ZONE OVERLAP"}</strong>
        <span style={{ display: "block", margin: "2px 0 10px", color: "rgba(255,255,255,.62)", fontFamily: "var(--font-mono)", fontSize: 8, lineHeight: 1.45, letterSpacing: ".08em" }}>{valid ? "DRAG AROUND THE RING · ARROWS FINE-TUNE" : "MOVE THE RED GHOST AWAY FROM ACTIVE ZONES"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {!firstPlacement && <button onClick={onCancel} style={{ flex: 1, minHeight: 40, borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.72)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 900, letterSpacing: ".1em" }}>CANCEL</button>}
          <button disabled={!valid} onClick={onConfirm} style={{ flex: 1.4, minHeight: 40, border: 0, borderRadius: 999, background: valid ? "#62ffa6" : "rgba(255,49,93,.18)", color: valid ? "#041008" : "rgba(255,255,255,.35)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 900, letterSpacing: ".1em", cursor: valid ? "pointer" : "not-allowed" }}>{firstPlacement && Math.round(angle) === 180 ? "PLACE AT 6 O'CLOCK" : "PLACE ZONE"}</button>
        </div>
      </motion.div>
    </>
  );
}
