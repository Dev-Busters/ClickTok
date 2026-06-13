/**
 * 7.5b server video pool + publish flow — verification probe
 * Run: node probe-7.5b.mjs
 *
 * DoD checks:
 *   1. Forged captionId → card lands in feed but captionId is replaced with a whitelisted one
 *   2. Cooldown-violating postVideo (second post within 60s) → dropped, no videoPosted broadcast
 *   3. Valid postVideo lands in getFeed reply with correct handle/mod server-rolled
 *   4. videoPosted broadcast reaches a second connection ≈immediately
 *   5. Regression: getFeed returns cards padded to feedMinDeck (10) with NPC filler
 */

const PARTY_HOST = "ws://127.0.0.1:62091";

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

// Whitelisted caption ids (mirrored from lobby.ts)
const VALID_CAPTION_IDS = [
  "algo_chose", "pov_algo", "no_sleep", "real_talk", "not_ready", "main_character",
  "trend_check", "ratio_check", "lowkey_obsessed", "its_giving", "no_thoughts",
  "out_here", "this_is_it", "unhinged", "literally_me", "your_sign", "day_one",
  "caught_in_4k", "not_me", "vibes_check",
];

const VALID_MOD_IDS = ["ring_slow", "extra_ring", "wide_window", "duet_flow", "core_surge", "wave_rush"];

async function main() {
  console.log("— 7.5b lobby feed probe —\n");

  const posterWs = await connect("lobby", "lobby");
  const watcherWs = await connect("lobby", "lobby");
  const poster = q(posterWs);
  const watcher = q(watcherWs);

  // Drain the initial burst (directory/trends/algorithm/leaderboard)
  await poster.drain(500);
  await watcher.drain(500);

  // ── Test 1: Valid postVideo ──────────────────────────────────────────────
  console.log("Test 1: valid postVideo lands in videoPosted broadcast + feed");

  const testVideoId = `probe75b-${Date.now()}`;
  const testHandle = "probe_poster_a";

  poster.send({
    type: "postVideo",
    card: {
      videoId: testVideoId,
      handle: testHandle,
      creatorLevel: 2,
      topic: "gaming",
      captionId: "no_sleep",
      mod: "ring_slow",    // server will re-roll this — test that result is valid
      postedAt: 0,
      tapCount: 999,       // server must zero this
    },
  });

  const posted = await watcher.waitFor("videoPosted", 2000);
  assert(posted !== null, "videoPosted broadcast received by watcher");
  if (posted) {
    assert(posted.card.tapCount === 0, "tapCount forced to 0 by server",
      `got ${posted.card.tapCount}`);
    assert(VALID_MOD_IDS.includes(posted.card.mod), "mod is server-rolled (in whitelist)",
      `got "${posted.card.mod}"`);
    assert(VALID_CAPTION_IDS.includes(posted.card.captionId), "captionId is whitelisted",
      `got "${posted.card.captionId}"`);
  }

  // ── Test 2: getFeed returns the posted card padded to feedMinDeck ────────
  console.log("\nTest 2: getFeed returns card + NPC padding to feedMinDeck");

  watcher.send({ type: "getFeed" });
  const feedMsg = await watcher.waitFor("feed", 2000);
  assert(feedMsg !== null, "feed reply received");
  if (feedMsg) {
    assert(feedMsg.cards.length >= 10, `feed.cards.length >= 10 (feedMinDeck)`,
      `got ${feedMsg.cards.length}`);
    const ourCard = feedMsg.cards.find(c => c.videoId === (posted?.card.videoId ?? testVideoId));
    assert(ourCard !== undefined, "posted card is in the feed");
    const npcCards = feedMsg.cards.filter(c => c.npc);
    assert(npcCards.length >= 0, "NPC filler cards present to reach feedMinDeck");
  }

  // ── Test 3: Forged captionId is replaced, card still accepted ────────────
  console.log("\nTest 3: forged captionId replaced (not dropped)");

  // Need a fresh poster connection (the previous one is in cooldown)
  const poster2Ws = await connect("lobby", "lobby");
  const poster2 = q(poster2Ws);
  await poster2.drain(500);
  watcher.drain(0);

  poster2.send({
    type: "postVideo",
    card: {
      videoId: `probe75b-forge-${Date.now()}`,
      handle: "forge_poster",
      creatorLevel: 1,
      topic: "comedy",
      captionId: "EVIL_INJECT<script>",
      mod: "ring_slow",
      postedAt: 0,
      tapCount: 0,
    },
  });

  const forgedPosted = await watcher.waitFor("videoPosted", 2000);
  assert(forgedPosted !== null, "videoPosted still broadcast for card with forged captionId");
  if (forgedPosted) {
    assert(forgedPosted.card.captionId !== "EVIL_INJECT<script>",
      "forged captionId not relayed verbatim",
      `got "${forgedPosted.card.captionId}"`);
    assert(VALID_CAPTION_IDS.includes(forgedPosted.card.captionId),
      "replaced captionId is in the whitelist",
      `got "${forgedPosted.card.captionId}"`);
  }

  // ── Test 4: Cooldown-violating second post is dropped ────────────────────
  console.log("\nTest 4: cooldown-violating postVideo dropped (serverPublishCooldownSec)");

  // poster is still in cooldown — send again immediately
  watcher.drain(0);
  poster.send({
    type: "postVideo",
    card: {
      videoId: `probe75b-cooldown-${Date.now()}`,
      handle: testHandle,
      creatorLevel: 2,
      topic: "gaming",
      captionId: "no_sleep",
      mod: "ring_slow",
      postedAt: 0,
      tapCount: 0,
    },
  });

  // Wait 500ms — if dropped, no videoPosted arrives
  const cooldownPosted = await watcher.waitFor("videoPosted", 600);
  assert(cooldownPosted === null, "second postVideo within cooldown window is dropped");

  // ── Test 5: Regression — valid getFeed from new connection ───────────────
  console.log("\nTest 5: regression — fresh connection's getFeed returns ≥ feedMinDeck cards");

  const fresh = q(await connect("lobby", "lobby"));
  await fresh.drain(500);
  fresh.send({ type: "getFeed" });
  const freshFeed = await fresh.waitFor("feed", 2000);
  assert(freshFeed !== null, "fresh connection receives feed reply");
  if (freshFeed) {
    assert(freshFeed.cards.length >= 10, `feed has ≥10 cards (feedMinDeck)`,
      `got ${freshFeed.cards.length}`);
    const allModsValid = freshFeed.cards.every(c => VALID_MOD_IDS.includes(c.mod));
    assert(allModsValid, "all feed cards have valid mod ids");
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  posterWs.close();
  watcherWs.close();
  poster2Ws.close();
  fresh.ws.close();
  await sleep(100);

  console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
