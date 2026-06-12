/**
 * 6.6 input-validation verification probe
 * Run against local PartyKit dev server: node probe-6.6.mjs
 *
 * Tests each forged payload from the DoD:
 *   1. vote.choiceIndex = 1e9 → dropped, no crash, no broadcast
 *   2. vote on an unknown pollId → dropped, no broadcast
 *   3. sendGift with a fake tier → dropped, not relayed to streamer
 *   4. quickChat with a raw-text preset → dropped, not relayed to streamer
 *   5. lobby `score` with non-numeric followers/likes → dropped, leaderboard unaffected
 *   6. lobby `feedAlgorithm` with non-numeric amount → dropped, no crash
 *   7. regression: valid vote / gift / quickChat / score still work
 */

const PARTY_HOST = "ws://127.0.0.1:1999";
const STREAM_ID = `probe66-${Date.now()}`;

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

  // Streamer opens a real poll with 3 options.
  const POLL_ID = "poll-1";
  spec.drain(0);
  viewer.drain(0);
  streamer.send({ type: "pollOpen", poll: {
    pollId: POLL_ID, prompt: "what next?", options: ["a", "b", "c"], closesAtSec: 60,
  }});
  await sleep(80);
  spec.drain(0);
  viewer.drain(0);

  // ── TEST 1: vote.choiceIndex = 1e9 → dropped, no crash, no broadcast ──────
  const tally1e9 = spec.waitFor("voteTally", 500);
  viewer.send({ type: "vote", pollId: POLL_ID, choiceIndex: 1e9 });
  const tally1e9Msg = await tally1e9;
  assert(tally1e9Msg === null, "TEST 1 — vote.choiceIndex=1e9 dropped (no voteTally broadcast)",
    `got ${JSON.stringify(tally1e9Msg)}`);

  // Server should still be alive — send a normal message and confirm it's processed.
  const aliveCheck = streamer.waitFor("viewerCount", 1000);
  viewer.send({ type: "watch", handle: "viewer_b", creatorLevel: 2 });
  const aliveMsg = await aliveCheck;
  assert(aliveMsg !== null, "TEST 1 — server still alive after forged choiceIndex");

  // ── TEST 2: vote on an unknown pollId → dropped, no broadcast ─────────────
  const tallyUnknown = spec.waitFor("voteTally", 500);
  viewer.send({ type: "vote", pollId: "no-such-poll", choiceIndex: 0 });
  const tallyUnknownMsg = await tallyUnknown;
  assert(tallyUnknownMsg === null, "TEST 2 — vote on unknown pollId dropped",
    `got ${JSON.stringify(tallyUnknownMsg)}`);

  // ── TEST 3: sendGift with a fake tier → dropped, not relayed ──────────────
  const fakeGift = streamer.waitFor("realGift", 500);
  viewer.send({ type: "sendGift", tier: "diamond_supreme" });
  const fakeGiftMsg = await fakeGift;
  assert(fakeGiftMsg === null, "TEST 3 — sendGift with fake tier dropped (not relayed)",
    `got ${JSON.stringify(fakeGiftMsg)}`);

  // ── TEST 4: quickChat with a raw-text preset → dropped, not relayed ───────
  const fakeChat = streamer.waitFor("realChat", 500);
  viewer.send({ type: "quickChat", preset: "<script>steal()</script>" });
  const fakeChatMsg = await fakeChat;
  assert(fakeChatMsg === null, "TEST 4 — quickChat with raw-text preset dropped (not relayed)",
    `got ${JSON.stringify(fakeChatMsg)}`);

  // ── TEST 7a (regression): valid vote, gift, quickChat still work ─────────
  await sleep(2100); // clear quickChat rate-limit window from any prior message

  const tallyValid = spec.waitFor("voteTally", 1000);
  viewer.send({ type: "vote", pollId: POLL_ID, choiceIndex: 1 });
  const tallyValidMsg = await tallyValid;
  assert(tallyValidMsg !== null && Array.isArray(tallyValidMsg.tally) && tallyValidMsg.tally[1] === 1,
    "TEST 7a — valid vote (choiceIndex=1) still tallies",
    `got ${JSON.stringify(tallyValidMsg)}`);

  const realGiftPromise = streamer.waitFor("realGift", 1000);
  viewer.send({ type: "sendGift", tier: "heart" });
  const realGiftMsg = await realGiftPromise;
  assert(realGiftMsg !== null && realGiftMsg.tier === "heart",
    "TEST 7a — valid sendGift (heart) still relayed",
    `got ${JSON.stringify(realGiftMsg)}`);

  const realChatPromise = streamer.waitFor("realChat", 1000);
  viewer.send({ type: "quickChat", preset: "fire" });
  const realChatMsg = await realChatPromise;
  assert(realChatMsg !== null && realChatMsg.preset === "fire",
    "TEST 7a — valid quickChat (fire) still relayed",
    `got ${JSON.stringify(realChatMsg)}`);

  streamer.ws.close(); viewer.ws.close(); spec.ws.close();
  await sleep(200);
}

// ── lobby room tests ───────────────────────────────────────────────────────

async function testLobbyRoom() {
  console.log("\n— lobby room —");
  const myStreamId = `probe66-lobby-${Date.now()}`;
  const summary = {
    streamId: myStreamId, handle: "streamer_x", creatorLevel: 2,
    topic: "cooking", viewers: 20, realViewers: 0, hype: 50, startedAt: Date.now(),
  };

  const x = q(await connect("lobby", "lobby"));
  const z = q(await connect("lobby", "lobby"));
  await sleep(300); // drain welcome messages
  x.drain(0); z.drain(0);

  x.send({ type: "hello", handle: "streamer_x", creatorLevel: 2 });
  x.send({ type: "goLive", summary });
  await sleep(200);
  z.drain(0);

  // ── TEST 5: non-numeric score followers/likes → dropped ──────────────────
  const leaderboardPromise = z.waitFor("leaderboard", 800);
  x.send({ type: "score", followers: "lots", likes: { evil: true } });
  const leaderboardMsg = await leaderboardPromise;
  const xEntry = leaderboardMsg?.channels?.find(c => c.handle === "streamer_x");
  assert(leaderboardMsg === null || xEntry === undefined || Number.isFinite(xEntry.followers),
    "TEST 5 — non-numeric score message dropped (no NaN leaderboard entry)",
    `got ${JSON.stringify(leaderboardMsg)}`);

  // ── TEST 6: feedAlgorithm with non-numeric amount → dropped, no crash ─────
  await sleep(1100); // clear feedAlgorithm rate-limit window
  z.drain(0);
  const algoPromise = z.waitFor("algorithm", 500);
  x.send({ type: "feedAlgorithm", kind: "watchSec", amount: "lots" });
  const algoMsg = await algoPromise;
  assert(algoMsg === null || Number.isFinite(algoMsg.state?.meter),
    "TEST 6 — non-numeric feedAlgorithm.amount dropped (no NaN meter)",
    `got ${JSON.stringify(algoMsg)}`);

  // Server should still be alive — a valid feedAlgorithm still works.
  await sleep(1100);
  z.drain(0);
  const algoValidPromise = z.waitFor("algorithm", 1000);
  x.send({ type: "feedAlgorithm", kind: "watchSec", amount: 10 });
  const algoValidMsg = await algoValidPromise;
  assert(algoValidMsg !== null && Number.isFinite(algoValidMsg.state?.meter),
    "TEST 7b — server alive: valid feedAlgorithm still updates meter",
    `got ${JSON.stringify(algoValidMsg)}`);

  // ── TEST 5b (regression): valid score still updates leaderboard ──────────
  await sleep(2100); // clear leaderboard debounce
  z.drain(0);
  const leaderboardValidPromise = z.waitFor("leaderboard", 3000);
  x.send({ type: "score", followers: 42, likes: 7 });
  const leaderboardValidMsg = await leaderboardValidPromise;
  const xValidEntry = leaderboardValidMsg?.channels?.find(c => c.handle === "streamer_x");
  assert(xValidEntry?.followers === 42,
    "TEST 5b — valid score (followers=42) still updates leaderboard",
    `got ${JSON.stringify(leaderboardValidMsg)}`);

  x.ws.close(); z.ws.close();
  await sleep(200);
}

// ── main ───────────────────────────────────────────────────────────────────

console.log("=== 6.6 Input Validation Probe ===");
await testStreamRoom();
await testLobbyRoom();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
