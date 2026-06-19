import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { NodePos, PlayfieldRect, PointerInput, RhythmJudgement, RhythmNodeState, SequenceId, TebSession } from "../../features/teb/types";
import { ringScale, chargeQuality } from "../../features/teb/charge";
import { BALANCE } from "../../features/economy/balance";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";
import { track } from "../../lib/telemetry";
import { buildChart, offsetChart } from "../../features/teb/chartBuilder";
import { pickSequence } from "../../features/teb/chartCatalog";
import { distanceWeightedPathCoverage, gestureControl, holdQuality, interactionWeight, judgementLabel, swipeQuality, timingQuality, traceQuality } from "../../features/teb/judgement";
import { pointerReducer } from "../../features/teb/pointerReducer";
import { computeRhythmReward } from "../../features/teb/reward";

export type TebSlice = {
  session: TebSession | null;
  tebReadyAt: number;
  tebChargeTeachSeen: boolean;
  tebSequenceTeachSeen: Partial<Record<SequenceId, boolean>>;
  reducedFeedback: boolean;
  rhythmMuted: boolean;
  setTebChargeTeachSeen: () => void;
  markTebSequenceTeachSeen: (sequence: SequenceId) => void;
  setReducedFeedback: (value: boolean) => void;
  setRhythmMuted: (value: boolean) => void;
  beginCharge: () => void;
  releaseCharge: (rect: PlayfieldRect) => void;
  rhythmPointerDown: (input: PointerInput) => void;
  rhythmPointerMove: (input: PointerInput) => void;
  rhythmPointerUp: (input: PointerInput) => void;
  rhythmPointerCancel: (pointerId: number) => void;
  pauseRhythm: () => void;
  tickTebSession: () => void;
  dismissResult: () => void;
};

let sequenceBag: SequenceId[] = [];
let previousSequence: SequenceId | null = null;

const dist = (a: NodePos, b: NodePos) => Math.hypot(a.x - b.x, a.y - b.y);
const activeSession = (session: TebSession | null): session is Extract<TebSession, { phase: "playing" }> => session?.phase === "playing";

function updateNode(session: Extract<TebSession, { phase: "playing" }>, index: number, state: RhythmNodeState, quality: number, at: number) {
  const node = session.chart.nodes[index];
  const label = judgementLabel(quality);
  const judgement: RhythmJudgement = { nodeId: node.id, kind: node.kind, label, quality, at, pos: node.pos };
  const chart = { ...session.chart, nodes: session.chart.nodes.map((n, i) => i === index ? { ...n, state, quality, completedAt: at } : i === index + 1 ? { ...n, state: "active" as const } : n) };
  const rhythmCombo = label === "miss" ? 0 : label === "good" ? session.rhythmCombo : session.rhythmCombo + 1;
  return { ...session, chart, judgements: [...session.judgements, judgement], nextIndex: index + 1, rhythmCombo, maxRhythmCombo: Math.max(session.maxRhythmCombo, rhythmCombo), pointer: null };
}

function updateSwipe(session: Extract<TebSession, { phase: "playing" }>, quality: number, at: number) {
  const label = judgementLabel(quality);
  const judgements = session.chart.nodes.map(node => ({ nodeId: node.id, kind: node.kind, label, quality, at, pos: node.pos } as RhythmJudgement));
  const rhythmCombo = label === "miss" ? 0 : label === "good" ? session.rhythmCombo : session.rhythmCombo + 1;
  return { ...session, chart: { ...session.chart, nodes: session.chart.nodes.map(node => ({ ...node, state: quality ? "resolved" as const : "missed" as const, quality, completedAt: at })) },
    judgements: [...session.judgements, ...judgements], nextIndex: session.chart.nodes.length, rhythmCombo,
    maxRhythmCombo: Math.max(session.maxRhythmCombo, rhythmCombo), pointer: null };
}

function resolveSession(set: (patch: Partial<FullState>) => void, get: () => FullState, session: Extract<TebSession, { phase: "playing" }>, now: number, cancelled = false) {
  const judged = session.judgements;
  const totalWeight = session.chart.nodes.reduce((sum, n) => sum + interactionWeight(n.kind), 0);
  const performanceQuality = totalWeight ? judged.reduce((sum, j) => sum + j.quality * interactionWeight(j.kind), 0) / totalWeight : 0;
  const completion = session.chart.nodes.length ? judged.filter(j => j.quality > 0).length / session.chart.nodes.length : 0;
  const state = get();
  const reward = computeRhythmReward({ chargeQuality: session.chargeQuality, performanceQuality, completion,
    maxRhythmCombo: session.maxRhythmCombo, feedCombo: state.combo, viralUntil: state.viralUntil,
    tapPower: state.tapPower, multiplier: state.multiplier, followerConversion: state.followerConversion, now });
  const counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  for (const j of judged) counts[j.label]++;
  set({
    wallet: { ...state.wallet, coins: state.wallet.coins + reward.coins, followers: state.wallet.followers + reward.followers,
      totalFollowers: state.wallet.totalFollowers + reward.followers, likes: state.wallet.likes + reward.likes },
    coinsEarned: state.coinsEarned + reward.coins,
    session: { phase: "result", sequence: session.chart.sequence, chargeQuality: session.chargeQuality,
      performanceQuality, completion, maxRhythmCombo: session.maxRhythmCombo, reward, resolvedAt: now },
    tebReadyAt: now + BALANCE.teb.cooldownSec * 1000,
  });
  track("teb_interaction_judged", { sequence: session.chart.sequence, ...counts });
  track("teb_chart_resolved", { sequence: session.chart.sequence, performanceQuality, completion,
    maxRhythmCombo: session.maxRhythmCombo, duration: now - session.startedAt, cancelled, rewardCoins: reward.coins });
}

export const createTebSlice: StateCreator<FullState, [], [], TebSlice> = (set, get) => ({
  session: null,
  tebReadyAt: 0,
  tebChargeTeachSeen: false,
  tebSequenceTeachSeen: {},
  reducedFeedback: false,
  rhythmMuted: false,
  setTebChargeTeachSeen: () => set({ tebChargeTeachSeen: true }),
  markTebSequenceTeachSeen: sequence => set(s => ({ tebSequenceTeachSeen: { ...s.tebSequenceTeachSeen, [sequence]: true } })),
  setReducedFeedback: value => set({ reducedFeedback: value }),
  setRhythmMuted: value => set({ rhythmMuted: value }),

  beginCharge: () => {
    const s = get();
    if (!isFeatureUnlocked("element_stage", s.metricsReached) || s.session || Date.now() < s.tebReadyAt) return;
    set({ session: { phase: "charging", move: "hold_charge", pressedAt: Date.now() } });
  },

  releaseCharge: rect => {
    const session = get().session;
    if (!session || session.phase !== "charging") return;
    const now = Date.now();
    const picked = pickSequence(sequenceBag, previousSequence);
    sequenceBag = picked.bag;
    previousSequence = picked.sequence;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const teachDelay = get().tebSequenceTeachSeen[picked.sequence] ? 0 : 900;
    const startsAt = now + BALANCE.teb.rhythm.countInMs + teachDelay;
    const chart = offsetChart(buildChart(picked.sequence, seed, rect), startsAt);
    const quality = chargeQuality(ringScale(session.pressedAt, now));
    set({ session: { phase: "count_in", chart, chargeQuality: quality, startsAt } });
    track("teb_chart_started", { sequence: picked.sequence, inputKind: "pointer", chargeQuality: quality,
      viewport: rect.width <= 340 ? "narrow" : rect.width <= 430 ? "phone" : "wide" });
  },

  rhythmPointerDown: input => {
    const session = get().session;
    if (!activeSession(session) || session.pointer) return;
    const node = session.chart.nodes[session.nextIndex];
    if (!node || node.state !== "active") return;
    const radius = node.kind === "hold" ? .15 : node.kind === "trace" ? .14 : .13;
    if (dist(input.pos, node.pos) > radius) return;
    const pointer = pointerReducer(null, { type: "down", input, nodeId: node.id });
    if (node.kind === "tap") {
      const quality = timingQuality(input.at - node.hitAt);
      const next = updateNode({ ...session, pointer }, session.nextIndex, quality ? "resolved" : "missed", quality, input.at);
      if (next.nextIndex >= next.chart.nodes.length) resolveSession(set, get, next, input.at);
      else set({ session: next });
      return;
    }
    set({ session: { ...session, pointer } });
  },

  rhythmPointerMove: input => {
    const session = get().session;
    if (!activeSession(session) || !session.pointer || session.pointer.pointerId !== input.pointerId) return;
    const current = session.chart.nodes[session.nextIndex];
    if (!current) return;
    let pointer = pointerReducer(session.pointer, { type: "move", input });
    if (!pointer) return;
    if (current.kind === "swipe") {
      const nextId = pointer.visitedNodeIds.length + 1;
      const target = session.chart.nodes.find(n => n.id === nextId);
      if (target && dist(input.pos, target.pos) <= .13) pointer = pointerReducer(pointer, { type: "visit", input, nodeId: target.id });
    } else if (current.kind === "trace" && current.path) {
      const progress = distanceWeightedPathCoverage(pointer.samples.map(s => s.pos), current.path);
      pointer = pointerReducer(pointer, { type: "coverage", input, coverage: progress });
    }
    set({ session: { ...session, pointer } });
  },

  rhythmPointerUp: input => {
    const session = get().session;
    if (!activeSession(session) || !session.pointer || session.pointer.pointerId !== input.pointerId) return;
    const node = session.chart.nodes[session.nextIndex];
    if (!node) return;
    const start = timingQuality(session.pointer.startedAt - node.hitAt);
    let quality = 0;
    if (node.kind === "hold") {
      const duration = Math.max(1, (node.releaseAt ?? node.hitAt) - node.hitAt);
      const held = Math.max(0, Math.min(1, (input.at - session.pointer.startedAt) / duration));
      quality = holdQuality(start, held, timingQuality(input.at - (node.releaseAt ?? node.hitAt)));
    } else if (node.kind === "swipe") {
      const links = Math.max(0, session.chart.nodes.length - 1);
      const completed = Math.max(0, session.pointer.visitedNodeIds.length - 1);
      const control = gestureControl(session.pointer.samples.map(s => s.pos), session.chart.nodes.map(n => n.pos));
      quality = swipeQuality(start, links ? completed / links : 1, control);
    } else if (node.kind === "trace") {
      quality = traceQuality(start, session.pointer.pathCoverage, timingQuality(input.at - (node.releaseAt ?? node.hitAt)));
    }
    const next = node.kind === "swipe" ? updateSwipe(session, quality, input.at) : updateNode(session, session.nextIndex, quality ? "resolved" : "missed", quality, input.at);
    if (next.nextIndex >= next.chart.nodes.length) resolveSession(set, get, next, input.at);
    else set({ session: next });
  },

  rhythmPointerCancel: pointerId => {
    const session = get().session;
    if (!activeSession(session) || !session.pointer || session.pointer.pointerId !== pointerId) return;
    const next = updateNode(session, session.nextIndex, "missed", 0, Date.now());
    if (next.nextIndex >= next.chart.nodes.length) resolveSession(set, get, next, Date.now(), true);
    else set({ session: next });
  },

  pauseRhythm: () => {
    const session = get().session;
    if (!activeSession(session)) return;
    const now = Date.now();
    const startsAt = now + BALANCE.teb.rhythm.countInMs;
    const firstOffset = session.chart.nodes[0]?.hitAt - session.startedAt || 900;
    const delta = startsAt + firstOffset - (session.chart.nodes[0]?.hitAt ?? startsAt);
    const chart = { ...session.chart, nodes: session.chart.nodes.map((node, i) => ({ ...node,
      hitAt: node.hitAt + delta, releaseAt: node.releaseAt === null ? null : node.releaseAt + delta,
      state: i === 0 ? "active" as const : "upcoming" as const, quality: null, completedAt: null })) };
    set({ session: { phase: "count_in", chart, chargeQuality: session.chargeQuality, startsAt } });
  },

  tickTebSession: () => {
    const session = get().session;
    if (!session) return;
    const now = Date.now();
    if (session.phase === "charging" && now - session.pressedAt >= BALANCE.teb.chargeShrinkSec * 1000) {
      get().releaseCharge({ width: window.innerWidth, height: window.innerHeight });
    } else if (session.phase === "count_in" && now >= session.startsAt) {
      set({ session: { phase: "playing", chart: session.chart, chargeQuality: session.chargeQuality, startedAt: now,
        pointer: null, judgements: [], nextIndex: 0, rhythmCombo: 0, maxRhythmCombo: 0 } });
    } else if (session.phase === "playing") {
      const node = session.chart.nodes[session.nextIndex];
      if (node && !session.pointer && now > (node.releaseAt ?? node.hitAt) + BALANCE.teb.rhythm.goodWindowMs) {
        const next = updateNode(session, session.nextIndex, "missed", 0, now);
        if (next.nextIndex >= next.chart.nodes.length) resolveSession(set, get, next, now);
        else set({ session: next });
      } else if (now > session.startedAt + session.chart.durationMs + 1200) {
        resolveSession(set, get, session, now, true);
      }
    } else if (session.phase === "result" && now - session.resolvedAt >= BALANCE.teb.rhythm.resultGraceMs) {
      set({ session: null });
    }
  },
  dismissResult: () => { if (get().session?.phase === "result") set({ session: null }); },
});
