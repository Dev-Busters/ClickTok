import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useGameStore } from "../../../store";
import { BALANCE } from "../../../features/economy/balance";
import { CHART_CATALOG } from "../../../features/teb/chartCatalog";
import type { NodePos, PointerInput } from "../../../features/teb/types";
import { formatCount } from "../../../lib/format";
import { ApproachTarget } from "./ApproachTarget";
import { HoldTarget } from "./HoldTarget";
import { SwipeChain } from "./SwipeChain";
import { TracePath } from "./TracePath";
import { JudgementBurst } from "./JudgementBurst";
import { RhythmHud } from "./RhythmHud";
import { RhythmPerfOverlay } from "./RhythmPerfOverlay";
import { chartCompleteFeedback, playRhythmFeedback } from "../../../features/teb/feedback";

function grade(q: number): string { return q >= .9 ? "PERFECT" : q >= .65 ? "GREAT" : q > 0 ? "GOOD" : "MISS"; }

export function RhythmPlayfield() {
  const session = useGameStore(s => s.session);
  const down = useGameStore(s => s.rhythmPointerDown);
  const move = useGameStore(s => s.rhythmPointerMove);
  const up = useGameStore(s => s.rhythmPointerUp);
  const cancel = useGameStore(s => s.rhythmPointerCancel);
  const teachSeen = useGameStore(s => s.tebSequenceTeachSeen);
  const markTeach = useGameStore(s => s.markTebSequenceTeachSeen);
  const reduced = useReducedMotion();
  const pauseRhythm = useGameStore(s => s.pauseRhythm);
  const muted = useGameStore(s => s.rhythmMuted);
  const reducedFeedback = useGameStore(s => s.reducedFeedback);
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());
  const lastJudgementAt = useRef(0);
  const lastPhase = useRef<string | null>(null);

  useEffect(() => {
    if (!session || (session.phase !== "count_in" && session.phase !== "playing")) return;
    let frame = 0;
    const tick = () => { setNow(Date.now()); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session?.phase]);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState !== "visible") pauseRhythm(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pauseRhythm]);

  useEffect(() => {
    if (session?.phase === "playing") {
      const latest = session.judgements[session.judgements.length - 1];
      if (latest && latest.at !== lastJudgementAt.current) {
        lastJudgementAt.current = latest.at;
        playRhythmFeedback(latest.label, muted, reducedFeedback);
      }
    }
    if (session?.phase === "result" && lastPhase.current === "playing") chartCompleteFeedback(reducedFeedback);
    lastPhase.current = session?.phase ?? null;
  }, [session, muted, reducedFeedback]);

  useEffect(() => {
    if (session?.phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const node = session.chart.nodes[session.nextIndex];
      if (!node) return;
      const input: PointerInput = { pointerId: -1, pos: node.pos, at: Date.now(), inputKind: "keyboard" };
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!session.pointer) down(input); else up(input);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault(); down(input);
        const checkpoints = node.kind === "trace" ? node.path ?? [] : session.chart.nodes.slice(1).map(target => target.pos);
        for (const pos of checkpoints) move({ ...input, pos, at: Date.now() });
        up({ ...input, pos: checkpoints[checkpoints.length - 1] ?? node.pos, at: node.releaseAt ?? Date.now() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, down, move, up]);

  if (!session || session.phase === "charging") return null;
  const normalize = (e: React.PointerEvent): PointerInput => {
    const rect = ref.current?.getBoundingClientRect();
    const pos: NodePos = rect ? { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height } : { x: .5, y: .5 };
    return { pointerId: e.pointerId, pos, at: Date.now() };
  };
  const sequence = session.phase === "result" ? session.sequence : session.chart.sequence;
  const def = CHART_CATALOG[sequence];
  const firstTeach = !teachSeen[sequence];
  const playing = session.phase === "playing";
  const quality = playing && session.judgements.length ? session.judgements.reduce((s, j) => s + j.quality, 0) / session.judgements.length : 1;

  return <motion.div ref={ref} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .14 }}
    onPointerDown={e => { if (!playing) return; e.currentTarget.setPointerCapture(e.pointerId); down(normalize(e)); }}
    onPointerMove={e => { if (playing) move(normalize(e)); }}
    onPointerUp={e => { if (playing) up(normalize(e)); }}
    onPointerCancel={e => cancel(e.pointerId)} onLostPointerCapture={e => { if (playing) cancel(e.pointerId); }}
    style={{ position: "absolute", inset: 0, zIndex: 80, touchAction: playing ? "none" : "auto", userSelect: "none", overflow: "hidden", pointerEvents: playing ? "auto" : "none" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle,rgba(0,0,0,.42),rgba(0,0,0,.78))", pointerEvents: "none" }} />
    {session.phase === "count_in" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "auto" }}>
      <motion.div animate={reduced ? { opacity: 1 } : { scale: [1, 1.06, 1], opacity: [0, 1, 1] }} transition={{ duration: .7 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "white", textShadow: "-2px 0 var(--cyan),2px 0 var(--red)" }}>{def.name}</div>
        <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", letterSpacing: ".18em", color: "var(--gold)" }}>
          {def.gestureHint === "tap" ? "TAP" : def.gestureHint === "hold" ? "HOLD · RELEASE" : def.gestureHint === "swipe" ? "PRESS · CONNECT" : "PRESS · TRACE"}
        </div>
        {firstTeach && <button onPointerDown={e => { e.stopPropagation(); markTeach(sequence); }} style={{ marginTop: 20, border: "1px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "6px 14px", background: "rgba(0,0,0,.45)", color: "white", fontFamily: "var(--font-mono)", fontSize: 10 }}>GOT IT / SKIP</button>}
      </motion.div>
    </div>}
    {playing && <>
      <RhythmHud combo={session.rhythmCombo} quality={quality} />
      {sequence === "swipe_chain" ? <SwipeChain nodes={session.chart.nodes} pointer={session.pointer} now={now} /> :
       sequence === "trace_arc" ? <TracePath node={session.chart.nodes[0]} pointer={session.pointer} now={now} /> :
       session.chart.nodes.map(n => n.kind === "hold" ? <HoldTarget key={n.id} node={n} now={now} activeSince={session.pointer?.nodeId === n.id ? session.pointer.startedAt : null} /> : <ApproachTarget key={n.id} node={n} now={now} />)}
      <AnimatePresence>{session.judgements.slice(-4).map(j => <JudgementBurst key={`${j.nodeId}-${j.at}`} judgement={j} />)}</AnimatePresence>
      {session.pointer && session.pointer.samples.slice(-BALANCE.teb.rhythm.trailPointCap).map((sample, i, samples) => <i key={`${sample.at}-${i}`} style={{ position: "absolute", left: `${sample.pos.x * 100}%`, top: `${sample.pos.y * 100}%`, width: 4 + i, height: 4 + i, borderRadius: "50%", background: "var(--cyan)", opacity: (i + 1) / samples.length, transform: "translate(-50%,-50%)", pointerEvents: "none" }} />)}
    </>}
    {session.phase === "result" && <motion.div initial={{ opacity: 0, scale: reduced ? 1 : .7 }} animate={{ opacity: 1, scale: 1 }} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
      <div style={{ textAlign: "center", padding: "14px 20px", borderTop: "1px solid var(--gold)", borderBottom: "1px solid var(--cyan)", background: "rgba(0,0,0,.68)", boxShadow: "0 0 28px rgba(255,210,0,.2)" }}>
        <b style={{ fontFamily: "var(--font-display)", color: "var(--gold)", letterSpacing: ".12em" }}>{def.name}</b>
        <div style={{ margin: "7px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "white" }}>CHARGE {grade(session.chargeQuality)} · RHYTHM {grade(session.performanceQuality)} · ×{session.maxRhythmCombo}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "white" }}>🪙 +{formatCount(session.reward.coins)}　👤 +{formatCount(session.reward.followers)}　♥ +{formatCount(session.reward.likes)}</div>
      </div>
    </motion.div>}
    <RhythmPerfOverlay />
  </motion.div>;
}
