/**
 * 7.6 engagement royalties — verification probe
 * Run: node probe-7.6.mjs
 *
 * DoD checks:
 *   1. engage with taps: 9999 → clamped to engageMaxTapsPerMsg (120)
 *   2. engage with taps: "x" (non-numeric) → dropped, no royalty
 *   3. engage with taps: -5 → dropped (clamped to 0, then skipped)
 *   4. valid engage (20 taps) → royalty relayed to poster conn, taps = min(20, 120) = 20
 *   5. engage on an NPC card → no royalty relayed (NPC cards not in videoPosters)
 *   6. regression: getFeed still works after engage activity
 */

const PARTY_HOST = "ws://127.0.0.1:1999";
const ENGAGE_MAX = 120;

function connect(room, roomId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${PARTY_HOST}/parties/${room}/${roomId}`);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });
}

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

  async function waitFor(type, timeoutMs = 1500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const msg = await next(Math.max(50, remaining));
      if (msg === null) return null;
      if (msg.type === type) return msg;
    }
    return null;
  }

  function drain(ms = 200) {
    return new Promise(res => setTimeout(() => { while (queue.length > 0) queue.shift(); res(); }, ms));
  }

  return { ws, next, waitFor, drain, send: (obj) => ws.send(JSON.stringify(obj)) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0, failed = 0;
function assert(cond, label, detail = "") {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? "  →  " + detail : ""}`); failed++; }
}

async function main() {
  console.log("— 7.6 engagement royalties probe —\n");

  // Poster connection — posts a card and listens for royalty
  const posterWs = await connect("lobby", "lobby");
  const poster = q(posterWs);
  await poster.drain(400);

  // Send hello so server knows the handle for royalty fromHandle
  poster.send({ type: "hello", handle: "poster_a", creatorLevel: 2 });
  await sleep(100);

  // Post a video
  const videoId = `probe76-${Date.now()}`;
  poster.send({
    type: "postVideo",
    card: {
      videoId,
      handle: "poster_a",
      creatorLevel: 2,
      topic: "gaming",
      captionId: "no_sleep",
      mod: "ring_slow",
      postedAt: 0,
      tapCount: 0,
    },
  });
  // Wait for our own videoPosted broadcast (confirms card is in pool + videoPosters map).
  const vp = await poster.waitFor("videoPosted", 2000);
  assert(vp !== null, "card posted successfully (videoPosted received)");
  const serverVideoId = vp?.card.videoId ?? videoId;

  // Viewer connection — engages the card
  const viewerWs = await connect("lobby", "lobby");
  const viewer = q(viewerWs);
  await viewer.drain(400);
  viewer.send({ type: "hello", handle: "viewer_b", creatorLevel: 1 });
  await sleep(100);

  poster.drain(0); // clear any pending messages on poster before tests

  // ── Test 1: valid engage → royalty relayed to poster ─────────────────────
  console.log("Test 1: valid engage (20 taps) → royalty reaches poster");

  viewer.send({ type: "engage", videoId: serverVideoId, taps: 20 });
  const royalty = await poster.waitFor("royalty", 2000);
  assert(royalty !== null, "royalty message received by poster");
  if (royalty) {
    assert(royalty.taps === 20, `royalty.taps = 20`, `got ${royalty.taps}`);
    assert(royalty.videoId === serverVideoId, "royalty.videoId matches", `got ${royalty.videoId}`);
    assert(typeof royalty.fromHandle === "string" && royalty.fromHandle.length > 0,
      "royalty.fromHandle is a non-empty string", `got "${royalty.fromHandle}"`);
  }

  poster.drain(0);

  // ── Test 2: taps: 9999 → clamped to ENGAGE_MAX ───────────────────────────
  console.log("\nTest 2: engage taps: 9999 → clamped to engageMaxTapsPerMsg (120)");

  viewer.send({ type: "engage", videoId: serverVideoId, taps: 9999 });
  const royaltyClamped = await poster.waitFor("royalty", 2000);
  assert(royaltyClamped !== null, "royalty received for clamped taps");
  if (royaltyClamped) {
    assert(royaltyClamped.taps === ENGAGE_MAX, `royalty.taps clamped to ${ENGAGE_MAX}`,
      `got ${royaltyClamped.taps}`);
  }

  poster.drain(0);

  // ── Test 3: taps: "x" (string) → dropped, no royalty ───────────────────
  console.log('\nTest 3: engage taps: "x" → dropped, no royalty');

  viewer.send(JSON.stringify({ type: "engage", videoId: serverVideoId, taps: "x" }));
  const royaltyBad = await poster.waitFor("royalty", 600);
  assert(royaltyBad === null, 'non-numeric taps "x" dropped — no royalty relayed');

  // ── Test 4: taps: -5 → dropped (clamped to 0, skipped) ──────────────────
  console.log("\nTest 4: engage taps: -5 → dropped");

  viewer.send({ type: "engage", videoId: serverVideoId, taps: -5 });
  const royaltyNeg = await poster.waitFor("royalty", 600);
  assert(royaltyNeg === null, "negative taps dropped — no royalty relayed");

  // ── Test 5: NPC card engage → no royalty (not in videoPosters) ───────────
  console.log("\nTest 5: engage on NPC card → no royalty");

  // Get a feed to find an NPC card
  viewer.send({ type: "getFeed" });
  const feedMsg = await viewer.waitFor("feed", 2000);
  const npcCard = feedMsg?.cards.find(c => c.npc);
  if (npcCard) {
    viewer.send({ type: "engage", videoId: npcCard.videoId, taps: 10 });
    const royaltyNpc = await poster.waitFor("royalty", 600);
    assert(royaltyNpc === null, `NPC card engage produces no royalty (videoId: ${npcCard.videoId?.slice(0,8)})`);
  } else {
    console.log("  ⚠️  No NPC card in feed (all slots taken by real posts) — skipping");
  }

  // ── Test 6: regression — getFeed still works ──────────────────────────────
  console.log("\nTest 6: regression — getFeed still returns ≥10 cards after engage activity");

  viewer.send({ type: "getFeed" });
  const feedReg = await viewer.waitFor("feed", 2000);
  assert(feedReg !== null, "feed reply received");
  if (feedReg) {
    assert(feedReg.cards.length >= 10, `feed.cards.length >= 10`, `got ${feedReg.cards.length}`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  posterWs.close();
  viewerWs.close();
  await sleep(100);

  console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
