export type NodeKind = "tap" | "hold" | "swipe" | "trace";
export type SequenceId = "tap_three" | "hold_pulse" | "swipe_chain" | "trace_arc";
export type NodePos = { x: number; y: number };

export type NodeDef =
  | { id: number; kind: "tap"; hitAtMs: number }
  | { id: number; kind: "hold"; hitAtMs: number; durationMs: number }
  | { id: number; kind: "swipe"; hitAtMs: number; toId: number }
  | { id: number; kind: "trace"; hitAtMs: number; durationMs: number };

export type SequenceDef = {
  id: SequenceId;
  name: string;
  gestureHint: "tap" | "hold" | "swipe" | "trace";
  nodes: NodeDef[];
};

export type TebMoveId = "hold_charge";
export type RhythmNodeState = "upcoming" | "active" | "resolved" | "missed";

export type RuntimeNode = {
  id: number;
  kind: NodeKind;
  pos: NodePos;
  hitAt: number;
  releaseAt: number | null;
  path: NodePos[] | null;
  state: RhythmNodeState;
  quality: number | null;
  completedAt: number | null;
};

export type RhythmJudgementLabel = "perfect" | "great" | "good" | "miss";
export type RhythmJudgement = {
  nodeId: number;
  kind: NodeKind;
  label: RhythmJudgementLabel;
  quality: number;
  at: number;
  pos: NodePos;
};

export type RhythmPointer = {
  pointerId: number;
  inputKind: "pointer" | "keyboard";
  nodeId: number;
  startedAt: number;
  start: NodePos;
  current: NodePos;
  visitedNodeIds: number[];
  pathCoverage: number;
  samples: { pos: NodePos; at: number }[];
} | null;

export type RhythmChart = {
  sequence: SequenceId;
  seed: number;
  durationMs: number;
  nodes: RuntimeNode[];
};

export type TebSession =
  | { phase: "charging"; move: "hold_charge"; pressedAt: number }
  | { phase: "count_in"; chart: RhythmChart; chargeQuality: number; startsAt: number }
  | {
      phase: "playing";
      chart: RhythmChart;
      chargeQuality: number;
      startedAt: number;
      pointer: RhythmPointer;
      judgements: RhythmJudgement[];
      nextIndex: number;
      rhythmCombo: number;
      maxRhythmCombo: number;
    }
  | {
      phase: "result";
      sequence: SequenceId;
      chargeQuality: number;
      performanceQuality: number;
      completion: number;
      maxRhythmCombo: number;
      reward: { coins: number; followers: number; likes: number; k: number };
      resolvedAt: number;
    };

export type PlayfieldRect = { width: number; height: number };
export type PointerInput = { pointerId: number; pos: NodePos; at: number; inputKind?: "pointer" | "keyboard" };
