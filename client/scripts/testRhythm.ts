#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { BALANCE } from "../src/features/economy/balance";
import { buildChart, isValidGeometry } from "../src/features/teb/chartBuilder";
import { ALL_SEQUENCES, refillShuffleBag } from "../src/features/teb/chartCatalog";
import { distanceWeightedPathCoverage, gestureControl, holdQuality, judgementLabel, swipeQuality, timingQuality, traceQuality } from "../src/features/teb/judgement";
import { pointerReducer } from "../src/features/teb/pointerReducer";
import { computeRhythmReward } from "../src/features/teb/reward";
import type { NodePos } from "../src/features/teb/types";
import { migrate } from "../src/store/slices/meta";

const r = BALANCE.teb.rhythm;
assert.equal(timingQuality(r.perfectWindowMs), 1);
assert.ok(timingQuality(r.perfectWindowMs + 1) < 1);
assert.equal(judgementLabel(r.greatQuality), "great");
assert.equal(timingQuality(r.goodWindowMs + 1), 0);
assert.equal(judgementLabel(0), "miss");
assert.equal(holdQuality(1, 1, 1), 1);
assert.equal(swipeQuality(1, 1, 1), 1);
assert.equal(traceQuality(1, 1, 1), 1);

for (const rect of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
  for (const sequence of ALL_SEQUENCES) {
    const a = buildChart(sequence, 123456, rect);
    const b = buildChart(sequence, 123456, rect);
    assert.deepEqual(a, b, `${sequence} layout must be deterministic`);
    if (sequence !== "trace_arc") assert.ok(isValidGeometry(a.nodes.map(n => n.pos), rect), `${sequence} must fit ${rect.width}x${rect.height}`);
  }
}

const input = { pointerId: 1, pos: { x: .2, y: .2 }, at: 1000 };
const pointer = pointerReducer(null, { type: "down", input, nodeId: 1 });
assert.ok(pointer);
assert.equal(pointerReducer(pointer, { type: "down", input: { ...input, pointerId: 2 }, nodeId: 2 }), pointer, "second pointer ignored");
assert.equal(pointerReducer(pointer, { type: "cancel", pointerId: 1 }), null);

const path: NodePos[] = Array.from({ length: 48 }, (_, i) => ({ x: i / 47, y: .5 }));
const sparse = [{ x: 0, y: .5 }, { x: 1, y: .5 }];
const dense = Array.from({ length: 30 }, (_, i) => ({ x: i / 29, y: .5 }));
assert.equal(distanceWeightedPathCoverage(sparse, path, .02), 1);
assert.equal(distanceWeightedPathCoverage(dense, path, .02), 1);
assert.equal(gestureControl(sparse, path), gestureControl(dense, path));

const reward = computeRhythmReward({ chargeQuality: 1, performanceQuality: 1, completion: 1, maxRhythmCombo: 4,
  feedCombo: 0, viralUntil: 0, tapPower: 2, multiplier: 3, followerConversion: 1.5, now: 1 });
assert.equal(reward.k, r.rhythmBasePayout * 2 * 1.8 * 1.1);
assert.equal(reward.coins, 2 * BALANCE.postCoinConversion * 3 * reward.k);

let previous = ALL_SEQUENCES[0];
for (let i = 0; i < 20; i++) {
  const bag = refillShuffleBag(previous, () => (i * .137) % 1);
  assert.notEqual(bag[0], previous, "shuffle bag must avoid immediate repeats");
  previous = bag[0];
}

const migrated = migrate({ tebChargeTeachSeen: true }, 13);
assert.equal(migrated.version, 18);
assert.deepEqual(migrated.tebSequenceTeachSeen, { tap_three: true });

console.log("rhythm: layout, timing, pointer, gesture, shuffle and reward checks passed");
