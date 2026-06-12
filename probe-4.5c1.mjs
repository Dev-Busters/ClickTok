/**
 * 4.5c-1 hardening verification probe
 * Run against local PartyKit dev server: node probe-4.5c1.mjs
 *
 * Tests each forgery from the DoD:
 *   1. Viewer `open` hijack
 *   2. Viewer-sent `end` (spectators must not receive `ended`)
 *   3. Forged shoutout value (server recomputes)
 *   4. 9999-tap message → capped to 8
 *   5. `endLive` on someone else's stream → directory unchanged
 *   6. feedAlgorithm flood → meter rises ≤ clamped, rate-limited amount
 */

const PARTY_HOST = "ws://127.0.0.1:1999";
const STREAM_ID = `probe-${Date.now()}`;

// ── helpers ────────────────────────────────────────────────────────────────

function connect(room, roomId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${PARTY_HOST}/parties/${room}/${roomId}`);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });
}

/** Wrap a raw WebSocket in a message queue so tests can read messages in order. */
function q(ws) {
  const queue = [];
  const waiters = [];
  ws.addEventListener("message", (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (waiters.length > 0) waiters.shift()(msg);
    else queue.push(msg);
  });

  function next(timeoutMs = 600) {
    if (queue.length > 0) return Promise.resolve(queue.shift());
    return new Promise((res) => {
      let done = false;
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        const idx = waiters.findIndex(fn => fn === resolver);
        if (idx >= 0) waiters.splice(idx, 1);
        res(null);
      }, timeoutMs);
      const resolver = (msg) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        res(msg);
      };
      waiters.push(resolver);
    });
  }

  async function waitFor(type, timeoutMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const msg = await next(Math.max(50, remaining));
      if (msg === null) return null;
      if (msg.type === type) return msg;
    }
    return null;
  }

  function drain(ms = 150) {
    return new Promise(res => setTimeout(async () => {
      while (queue.length > 0) queue.shift();
      res();
    }, ms));
  }

  return { ws, next, waitFor, drain, send: (obj) => ws.send(JSON.stringify(obj)) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0, failed = 0;
function assert(cond, label, detail = "") {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? "  →  " + detail : ""}`); failed++; }
}

// ── stream room tests ──────────────────────────────────────────────────────

async function testStreamRoom() {
  console.log("\n— stream room —");
  const streamer = q(await connect("stream", STREAM_ID));
  const viewer   = q(await connect("stream", STREAM_ID));
  const spec     = q(await connect("stream", STREAM_ID));

  await sleep(100);
  streamer.drain(0);
  viewer.drain(0);
  spec.drain(0);

  // Streamer pins the room
  streamer.send({ type: "open", summary: {
    streamId: STREAM_ID, handle: "streamer_a", creatorLevel: 3,
    topic: "gaming", viewers: 100, realViewers: 0, hype: 50, startedAt: Date.now(),
  }});
  await sleep(80);

  // ── TEST 1: viewer `open` hijack ──────────────────────────────────────────
  viewer.send({ type: "open", summary: {
    streamId: STREAM_ID, handle: "hijacker_b", creatorLevel: 1,
    topic: "gaming", viewers: 0, realViewers: 0, hype: 0, startedAt: Date.now(),
  }});
  await sleep(80);

  // B (viewer) sends `snapshot` → must be dropped; spec must not receive it
  const snapPromise = spec.waitFor("snapshot", 500);
  viewer.send({ type: "snapshot", snap: {
    streamId: STREAM_ID, handle: "hijacker_b", topic: "gaming",
    clockSec: 1, durationSec: 180, viewers: 1, hype: 50, modifiers: [], newEvents: [],
  }});
  const snapFromViewer = await snapPromise;
  assert(snapFromViewer === null, "TEST 1 — viewer `open` hijack: snapshot from viewer dropped");

  // ── TEST 2: viewer-sent `end` ─────────────────────────────────────────────
  const endedPromise = spec.waitFor("ended", 500);
  viewer.send({ type: "end", grade: "S", peakViewers: 9999 });
  const endedFromViewer = await endedPromise;
  assert(endedFromViewer === null, "TEST 2 — viewer-sent `end` dropped");

  // ── TEST 3: forged shoutout value ─────────────────────────────────────────
  // streamer creatorLevel=3 → expected followers = 50 × 3 = 150
  viewer.send({ type: "watch", handle: "viewer_b", creatorLevel: 2 });
  await sleep(80);

  const shoutoutPromise = spec.waitFor("shoutout", 1000);
  streamer.send({ type: "shoutout", handle: "top_gifter", followers: 999999 });
  const shoutoutMsg = await shoutoutPromise;
  assert(shoutoutMsg !== null, "TEST 3 — shoutout delivered to spectators");
  assert(shoutoutMsg?.followers === 150,
    `TEST 3 — forged shoutout recomputed server-side (expected 150)`,
    `got followers=${shoutoutMsg?.followers}`);

  // ── TEST 4: 9999-tap clamped to 8 ────────────────────────────────────────
  // Drain any pending viewerCount messages at streamer before the tap test
  await streamer.drain(100);

  const tapPromise = streamer.waitFor("realHype", 1000);
  viewer.send({ type: "hypeTap", taps: 9999 });
  const realHype = await tapPromise;
  assert(realHype !== null, "TEST 4 — hypeTap relayed to streamer");
  assert(realHype?.taps === 8,
    `TEST 4 — 9999 taps clamped to 8`,
    `got taps=${realHype?.taps}`);

  // ── TEST 5 (regression): normal snapshot broadcast + real viewer count ────
  spec.drain(0);
  const snapBroadcast = spec.waitFor("snapshot", 1000);
  streamer.send({ type: "snapshot", snap: {
    streamId: STREAM_ID, handle: "streamer_a", topic: "gaming",
    clockSec: 10, durationSec: 180, viewers: 110, hype: 60, modifiers: [], newEvents: [],
  }});
  const normalSnap = await snapBroadcast;
  assert(normalSnap !== null, "TEST 5 (regression) — streamer snapshot broadcast to spectators");
  assert(normalSnap?.realViewers >= 1,
    "TEST 5 (regression) — realViewers ≥ 1 reflected in snapshot",
    `realViewers=${normalSnap?.realViewers}`);

  streamer.ws.close(); viewer.ws.close(); spec.ws.close();
  await sleep(200);
}

// ── lobby room tests ───────────────────────────────────────────────────────

async function testLobbyRoom() {
  console.log("\n— lobby room —");
  const myStreamId = `probe-lobby-${Date.now()}`;
  const summary = {
    streamId: myStreamId, handle: "streamer_x", creatorLevel: 2,
    topic: "cooking", viewers: 20, realViewers: 0, hype: 50, startedAt: Date.now(),
  };

  const x = q(await connect("lobby", "lobby"));
  const y = q(await connect("lobby", "lobby"));
  const z = q(await connect("lobby", "lobby"));
  await sleep(300); // drain welcome messages
  x.drain(0); y.drain(0); z.drain(0);

  // X goes live
  x.send({ type: "hello", handle: "streamer_x", creatorLevel: 2 });
  x.send({ type: "goLive", summary });
  await sleep(200);
  z.drain(0); // drain directory broadcasts from goLive

  // ── TEST 6: endLive on someone else's stream ──────────────────────────────
  y.send({ type: "endLive", streamId: myStreamId }); // Y does not own this stream
  await sleep(200);

  // Trigger a fresh directory broadcast by X sending a liveUpdate
  z.drain(0);
  const dirAfterHijack = z.waitFor("directory", 1000);
  x.send({ type: "liveUpdate", summary: { ...summary, viewers: 21 } });
  const dirMsg = await dirAfterHijack;
  const stillLive = dirMsg?.streams?.some((s) => s.streamId === myStreamId);
  assert(stillLive === true,
    "TEST 6 — endLive hijack: stream survives non-owner endLive attempt",
    `streams=${JSON.stringify(dirMsg?.streams?.map(s => s.streamId))}`);

  // ── TEST 7: feedAlgorithm flood (rate limit) ──────────────────────────────
  // Reset algo meter context by draining any existing algorithm messages
  z.drain(0);

  // First message: should go through
  const algoFirst = z.waitFor("algorithm", 1000);
  x.send({ type: "feedAlgorithm", kind: "watchSec", amount: 60 });
  const algoMsg1 = await algoFirst;
  const meterAfterFirst = algoMsg1?.state?.meter ?? 0;
  assert(algoMsg1 !== null, "TEST 7 — first feedAlgorithm accepted");

  // Rapid-fire 4 more within the 1000ms window → all should be dropped
  z.drain(0);
  for (let i = 0; i < 4; i++) {
    x.send({ type: "feedAlgorithm", kind: "watchSec", amount: 60 });
  }
  // Collect any algorithm broadcasts for 400ms
  const floodMsgs = [];
  const deadline = Date.now() + 400;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const msg = await z.next(Math.max(20, remaining));
    if (msg === null) break;
    if (msg.type === "algorithm") floodMsgs.push(msg);
  }
  const meterRaisedByFlood = floodMsgs.some(m => m.state.meter > meterAfterFirst + 0.01);
  assert(!meterRaisedByFlood,
    `TEST 7 — feedAlgorithm flood rate-limited (meter after first: ${meterAfterFirst.toFixed(2)}, no flood increase)`,
    `flood algo msgs: ${floodMsgs.length}, meters: ${floodMsgs.map(m => m.state.meter.toFixed(2))}`);

  // ── TEST 8: feedAlgorithm amount clamp (watchSec capped to 60) ───────────
  await sleep(1100); // wait for rate-limit window to clear
  z.drain(0);

  const algoBeforeClamp = z.waitFor("algorithm", 1000);
  x.send({ type: "feedAlgorithm", kind: "watchSec", amount: 999 }); // >maxFeedWatchSec
  const algoAfterClamp = await algoBeforeClamp;
  const meterAfterClamp = algoAfterClamp?.state?.meter ?? 0;
  // Expected rise: min(999,60) × 0.05 = 3.0; forged rise would be 999 × 0.05 = 49.95
  const meterRise = meterAfterClamp - meterAfterFirst;
  assert(algoAfterClamp !== null, "TEST 8 — clamped feedAlgorithm accepted");
  assert(meterRise <= 3.5,
    `TEST 8 — feedAlgorithm amount clamped (rose by ${meterRise.toFixed(3)}, expected ≤ 3.0)`,
    `before=${meterAfterFirst.toFixed(3)}, after=${meterAfterClamp.toFixed(3)}`);

  x.ws.close(); y.ws.close(); z.ws.close();
  await sleep(200);
}

// ── main ───────────────────────────────────────────────────────────────────

console.log("=== 4.5c-1 Hardening Probe ===");
await testStreamRoom();
await testLobbyRoom();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
