import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { judgeVideoTiming, videoDurationMs, HIT_WINDOWS, NODE_RADIUS_PX } from "../../features/videos/authoring";
import type { AuthoredVideo, VideoJudgement, VideoJudgementLabel, VideoScore } from "../../features/videos/types";

/** How long before its hit time a node's approach ring starts closing. */
const APPROACH_MS = 900;
const COUNT_IN_MS = 1200;

const LABEL_COLOR: Record<VideoJudgementLabel, string> = {
  perfect: "var(--gold)",
  great: "var(--cyan)",
  good: "#4dff9a",
  miss: "var(--red)",
};

type Props = {
  video: AuthoredVideo;
  onExit: (score: VideoScore) => void;
};

/**
 * Plays an authored chart. Deliberately self-contained rather than routed through the
 * TEB rhythm engine: authored charts have per-node slide semantics that the procedural
 * engine's whole-chain swipe model can't express, and keeping them separate means chart
 * authoring can iterate without destabilising the shipped TEB minigame.
 */
export function ChartPreview({ video, onExit }: Props) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [startedAt] = useState(() => performance.now() + COUNT_IN_MS);
  const [nowMs, setNowMs] = useState(-COUNT_IN_MS);
  const [nextIndex, setNextIndex] = useState(0);
  const [judgements, setJudgements] = useState<VideoJudgement[]>([]);
  const [flash, setFlash] = useState<{ id: number; label: VideoJudgementLabel; x: number; y: number } | null>(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const dragging = useRef(false);
  const finished = useRef(false);

  const duration = videoDurationMs(video);

  // Refs mirror state so the rAF loop and pointer handlers read current values without
  // re-subscribing every frame.
  const nextIndexRef = useRef(0);
  const judgementsRef = useRef<VideoJudgement[]>([]);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  nextIndexRef.current = nextIndex;
  judgementsRef.current = judgements;
  comboRef.current = combo;
  maxComboRef.current = maxCombo;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const list = judgementsRef.current;
    const counts: Record<VideoJudgementLabel, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
    for (const j of list) counts[j.label]++;
    const accuracy = video.nodes.length
      ? list.reduce((sum, j) => sum + j.quality, 0) / video.nodes.length
      : 0;
    onExit({ judgements: list, accuracy, maxCombo: maxComboRef.current, counts });
  };

  const record = (nodeId: number, errorMs: number, x: number, y: number) => {
    const { label, quality } = judgeVideoTiming(errorMs);
    setJudgements(list => [...list, { nodeId, label, quality, errorMs }]);
    setFlash({ id: nodeId, label, x, y });
    setCombo(current => {
      const next = label === "miss" ? 0 : current + 1;
      setMaxCombo(m => Math.max(m, next));
      return next;
    });
    setNextIndex(index => index + 1);
  };

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const elapsed = performance.now() - startedAt;
      setNowMs(elapsed);

      // Auto-miss any node whose good window has fully passed.
      const index = nextIndexRef.current;
      const node = video.nodes[index];
      if (node && elapsed > node.hitAtMs + HIT_WINDOWS.good) {
        record(node.id, elapsed - node.hitAtMs, node.x, node.y);
      } else if (!node && elapsed > duration) {
        finish();
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localPos = (clientX: number, clientY: number) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height, rect };
  };

  const tryHit = (clientX: number, clientY: number, viaDrag: boolean) => {
    const node = video.nodes[nextIndexRef.current];
    if (!node) return;
    // A slide node only resolves while the pointer is still down from the previous node.
    if (node.kind === "slide" && !viaDrag) return;
    if (node.kind === "tap" && viaDrag) return;
    const pos = localPos(clientX, clientY);
    if (!pos) return;
    const dx = (pos.x - node.x) * pos.rect.width;
    const dy = (pos.y - node.y) * pos.rect.height;
    if (Math.hypot(dx, dy) > NODE_RADIUS_PX + 18) return;
    const elapsed = performance.now() - startedAt;
    if (elapsed < node.hitAtMs - HIT_WINDOWS.good) return; // way too early — ignore, don't punish
    record(node.id, elapsed - node.hitAtMs, node.x, node.y);
  };

  return (
    <div
      ref={fieldRef}
      data-chart-preview
      onPointerDown={e => { dragging.current = true; tryHit(e.clientX, e.clientY, false); }}
      onPointerMove={e => { if (dragging.current) tryHit(e.clientX, e.clientY, true); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      style={{
        position: "absolute", inset: 0, zIndex: 5,
        touchAction: "none", cursor: "crosshair", overflow: "hidden",
      }}
    >
      {/* Slide links */}
      <svg aria-hidden width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {video.nodes.map((node, index) => {
          if (node.kind !== "slide" || index === 0) return null;
          const prev = video.nodes[index - 1];
          const upcoming = index >= nextIndex;
          return (
            <line
              key={`link-${node.id}`}
              x1={`${prev.x * 100}%`} y1={`${prev.y * 100}%`}
              x2={`${node.x * 100}%`} y2={`${node.y * 100}%`}
              stroke={upcoming ? "rgba(37,244,238,.55)" : "rgba(255,255,255,.12)"}
              strokeWidth={6} strokeLinecap="round" strokeDasharray="2 10"
            />
          );
        })}
      </svg>

      {video.nodes.map((node, index) => {
        if (index < nextIndex) return null;
        const untilHit = node.hitAtMs - nowMs;
        if (untilHit > APPROACH_MS) return null;
        const isNext = index === nextIndex;
        // Approach ring: 2.6× → 1× as the hit time arrives.
        const approach = Math.max(0, Math.min(1, untilHit / APPROACH_MS));
        const ringScale = 1 + approach * 1.6;
        const color = node.kind === "slide" ? "var(--cyan)" : "var(--red)";
        return (
          <div
            key={node.id}
            style={{
              position: "absolute", left: `${node.x * 100}%`, top: `${node.y * 100}%`,
              width: NODE_RADIUS_PX * 2, height: NODE_RADIUS_PX * 2,
              marginLeft: -NODE_RADIUS_PX, marginTop: -NODE_RADIUS_PX,
              pointerEvents: "none",
            }}
          >
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `3px solid ${color}`,
              background: "rgba(8,10,15,.72)",
              boxShadow: isNext ? `0 0 20px ${color}` : "none",
              opacity: isNext ? 1 : .5,
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-display)", fontSize: 24, color: "#fff",
            }}>{node.id}</div>
            {isNext && (
              <div aria-hidden style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: `2px solid ${color}`, opacity: .8,
                transform: `scale(${ringScale})`,
              }} />
            )}
          </div>
        );
      })}

      {/* Judgement flash */}
      {flash && (
        <motion.div
          key={`flash-${flash.id}`}
          initial={{ opacity: 1, scale: .7, y: 0 }}
          animate={{ opacity: 0, scale: 1.2, y: -36 }}
          transition={{ duration: .55, ease: "easeOut" }}
          style={{
            position: "absolute", left: `${flash.x * 100}%`, top: `${flash.y * 100}%`,
            translate: "-50% -50%", pointerEvents: "none",
            fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 900,
            color: LABEL_COLOR[flash.label], textShadow: "0 0 14px currentColor",
          }}
        >{flash.label.toUpperCase()}</motion.div>
      )}

      {/* HUD */}
      <div style={{ position: "absolute", top: 12, left: 14, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--cyan)", pointerEvents: "none" }}>
        {nowMs < 0 ? `GET READY ${Math.ceil(-nowMs / 1000)}` : `COMBO ${combo}`}
      </div>
      <button
        onClick={finish}
        style={{
          position: "absolute", top: 8, right: 12, zIndex: 6,
          padding: "7px 12px", borderRadius: 999,
          border: "1px solid rgba(255,255,255,.2)", background: "rgba(0,0,0,.6)",
          color: "#fff", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer",
        }}
      >STOP</button>
    </div>
  );
}
