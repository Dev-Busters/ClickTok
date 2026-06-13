/**
 * 8.6 engagement rail, server half (royalties for reactions) — verification probe
 * Run: node probe-8.6.mjs
 *
 * DoD checks:
 *   1. engage with reactions {like:true, follow:true} → royalty relayed with those reactions,
 *      card.reactions.likes bumped by 1 (follow has no counter)
 *   2. duplicate engage-with-reactions for the same videoId → counters bump ONCE (dedupe)
 *   3. non-boolean reaction values dropped (e.g. {like: "yes", comment: 1, share: null})
 *   4. engage with taps:0 + reactions still relays a royalty (reactions-only flush)
 *   5. engage on NPC card with reactions → no royalty relayed (NPC not in videoPosters)
 *   6. regression: plain engage (taps only, no reactions) still relays royalty as before
 */

const PARTY_HOST = "ws://127.0.0.1:1999";

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
  console.log("— 8.6 engagement rail server-half probe —\n");

  // Poster connection — posts a card and listens for royalty
  const posterWs = await connect("lobby", "lobby");
  const poster = q(posterWs);
  await poster.drain(400);

  poster.send({ type: "hello", handle: "poster_a86", creatorLevel: 2 });
  await sleep(100);

  const videoId = `probe86-${Date.now()}`;
  poster.send({
    type: "postVideo",
    card: {
      videoId,
      handle: "poster_a86",
      creatorLevel: 2,
      topic: "gaming",
      captionId: "no_sleep",
      mod: "ring_slow",
      postedAt: 0,
      tapCount: 0,
      reactions: { likes: 0, comments: 0, shares: 0 },
    },
  });
  const vp = await poster.waitFor("videoPosted", 2000);
  assert(vp !== null, "card posted successfully (videoPosted received)");
  const serverVideoId = vp?.card.videoId ?? videoId;

  // Viewer connection — engages the card with reactions
  const viewerWs = await connect("lobby", "lobby");
  const viewer = q(viewerWs);
  await viewer.drain(400);
  viewer.send({ type: "hello", handle: "viewer_b86", creatorLevel: 1 });
  await sleep(100);

  poster.drain(0);

  // ── Test 1: engage with reactions {like, follow} → royalty + counter bump ───
  console.log("Test 1: engage with reactions {like:true, follow:true}");

  viewer.send({ type: "engage", videoId: serverVideoId, taps: 5, reactions: { like: true, follow: true } });
  const royalty1 = await poster.waitFor("royalty", 2000);
  assert(royalty1 !== null, "royalty message received by poster");
  if (royalty1) {
    assert(royalty1.taps === 5, "royalty.taps = 5", `got ${royalty1.taps}`);
    assert(royalty1.reactions?.like === true, "royalty.reactions.like = true", JSON.stringify(royalty1.reactions));
    assert(royalty1.reactions?.follow === true, "royalty.reactions.follow = true", JSON.stringify(royalty1.reactions));
    assert(royalty1.reactions?.comment === undefined, "royalty.reactions.comment not set");
  }

  // Confirm the card's like counter bumped by 1 via getFeed.
  viewer.send({ type: "getFeed" });
  const feed1 = await viewer.waitFor("feed", 2000);
  const card1 = feed1?.cards.find(c => c.videoId === serverVideoId);
  assert(card1 !== undefined, "posted card found in feed");
  if (card1) {
    assert(card1.reactions.likes === 1, "card.reactions.likes = 1", `got ${card1.reactions.likes}`);
    assert(card1.reactions.comments === 0, "card.reactions.comments = 0 (unaffected)", `got ${card1.reactions.comments}`);
  }

  poster.drain(0);

  // ── Test 2: duplicate engage-with-reactions → dedupe, counter NOT bumped again ──
  console.log("\nTest 2: duplicate engage with reactions for same videoId → deduped");

  viewer.send({ type: "engage", videoId: serverVideoId, taps: 3, reactions: { like: true, comment: true } });
  const royalty2 = await poster.waitFor("royalty", 2000);
  // Plain taps still relay a royalty (taps=3 > 0), but reactions should be absent (deduped).
  assert(royalty2 !== null, "royalty still relayed for the taps portion");
  if (royalty2) {
    assert(royalty2.taps === 3, "royalty.taps = 3", `got ${royalty2.taps}`);
    assert(royalty2.reactions === undefined, "royalty.reactions absent (deduped)", JSON.stringify(royalty2.reactions));
  }

  viewer.send({ type: "getFeed" });
  const feed2 = await viewer.waitFor("feed", 2000);
  const card2 = feed2?.cards.find(c => c.videoId === serverVideoId);
  if (card2) {
    assert(card2.reactions.likes === 1, "card.reactions.likes still 1 (deduped, not double-counted)", `got ${card2.reactions.likes}`);
    assert(card2.reactions.comments === 0, "card.reactions.comments still 0 (deduped)", `got ${card2.reactions.comments}`);
  }

  poster.drain(0);

  // ── Test 3: non-boolean reaction values dropped ──────────────────────────
  console.log("\nTest 3: non-boolean reaction values dropped");

  // Fresh poster connection — postVideo has a 60s per-connection cooldown,
  // so reuse of `poster` would silently drop a 2nd/3rd postVideo.
  const poster3Ws = await connect("lobby", "lobby");
  const poster3 = q(poster3Ws);
  await poster3.drain(400);
  poster3.send({ type: "hello", handle: "poster_c86", creatorLevel: 2 });
  await sleep(100);

  const videoId3 = `probe86b-${Date.now()}`;
  poster3.send({
    type: "postVideo",
    card: {
      videoId: videoId3, handle: "poster_c86", creatorLevel: 2, topic: "gaming",
      captionId: "no_sleep", mod: "ring_slow", postedAt: 0, tapCount: 0,
      reactions: { likes: 0, comments: 0, shares: 0 },
    },
  });
  const vp3 = await poster3.waitFor("videoPosted", 2000);
  const serverVideoId3 = vp3?.card.videoId ?? videoId3;
  poster3.drain(0);

  viewer.send({
    type: "engage", videoId: serverVideoId3, taps: 1,
    reactions: { like: "yes", comment: 1, share: null, follow: true },
  });
  const royalty3 = await poster3.waitFor("royalty", 2000);
  assert(royalty3 !== null, "royalty relayed (taps=1 valid)");
  if (royalty3) {
    assert(royalty3.reactions?.follow === true, "royalty.reactions.follow = true (only valid boolean kept)", JSON.stringify(royalty3.reactions));
    assert(royalty3.reactions?.like === undefined, "royalty.reactions.like dropped (non-boolean)", JSON.stringify(royalty3.reactions));
    assert(royalty3.reactions?.comment === undefined, "royalty.reactions.comment dropped (non-boolean)", JSON.stringify(royalty3.reactions));
    assert(royalty3.reactions?.share === undefined, "royalty.reactions.share dropped (non-boolean)", JSON.stringify(royalty3.reactions));
  }

  viewer.send({ type: "getFeed" });
  const feed3 = await viewer.waitFor("feed", 2000);
  const card3 = feed3?.cards.find(c => c.videoId === serverVideoId3);
  assert(card3 !== undefined, "test-3 card found in feed");
  if (card3) {
    assert(card3.reactions.likes === 0, "card.reactions.likes = 0 (non-boolean like dropped)", `got ${card3.reactions.likes}`);
    assert(card3.reactions.comments === 0, "card.reactions.comments = 0 (non-boolean comment dropped)", `got ${card3.reactions.comments}`);
    assert(card3.reactions.shares === 0, "card.reactions.shares = 0 (null share dropped)", `got ${card3.reactions.shares}`);
  }

  poster3Ws.close();

  // ── Test 4: taps:0 + reactions still relays a royalty ─────────────────────
  console.log("\nTest 4: engage taps:0 with reactions (reactions-only flush)");

  const poster4Ws = await connect("lobby", "lobby");
  const poster4 = q(poster4Ws);
  await poster4.drain(400);
  poster4.send({ type: "hello", handle: "poster_d86", creatorLevel: 2 });
  await sleep(100);

  const videoId4 = `probe86c-${Date.now()}`;
  poster4.send({
    type: "postVideo",
    card: {
      videoId: videoId4, handle: "poster_d86", creatorLevel: 2, topic: "gaming",
      captionId: "no_sleep", mod: "ring_slow", postedAt: 0, tapCount: 0,
      reactions: { likes: 0, comments: 0, shares: 0 },
    },
  });
  const vp4 = await poster4.waitFor("videoPosted", 2000);
  const serverVideoId4 = vp4?.card.videoId ?? videoId4;
  poster4.drain(0);

  viewer.send({ type: "engage", videoId: serverVideoId4, taps: 0, reactions: { share: true } });
  const royalty4 = await poster4.waitFor("royalty", 2000);
  assert(royalty4 !== null, "royalty relayed for reactions-only engage (taps=0)");
  if (royalty4) {
    assert(royalty4.taps === 0, "royalty.taps = 0", `got ${royalty4.taps}`);
    assert(royalty4.reactions?.share === true, "royalty.reactions.share = true", JSON.stringify(royalty4.reactions));
  }

  poster4Ws.close();
  poster.drain(0);

  // ── Test 5: NPC card engage with reactions → no royalty ──────────────────
  console.log("\nTest 5: engage on NPC card with reactions → no royalty");

  viewer.send({ type: "getFeed" });
  const feedMsg = await viewer.waitFor("feed", 2000);
  const npcCard = feedMsg?.cards.find(c => c.npc);
  if (npcCard) {
    viewer.send({ type: "engage", videoId: npcCard.videoId, taps: 2, reactions: { like: true } });
    const royaltyNpc = await poster.waitFor("royalty", 600);
    assert(royaltyNpc === null, `NPC card engage produces no royalty (videoId: ${npcCard.videoId?.slice(0, 8)})`);
  } else {
    console.log("  ⚠️  No NPC card in feed (all slots taken by real posts) — skipping");
  }

  poster.drain(0);

  // ── Test 6: regression — plain engage (no reactions) still relays royalty ──
  console.log("\nTest 6: regression — plain engage (taps only) still relays royalty");

  viewer.send({ type: "engage", videoId: serverVideoId, taps: 7 });
  const royalty6 = await poster.waitFor("royalty", 2000);
  assert(royalty6 !== null, "royalty received for plain engage");
  if (royalty6) {
    assert(royalty6.taps === 7, "royalty.taps = 7", `got ${royalty6.taps}`);
    assert(royalty6.reactions === undefined, "royalty.reactions absent for plain engage");
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  posterWs.close();
  viewerWs.close();
  await sleep(100);

  console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
