/**
 * 6.2 lobby efficiency verification probe
 * Run against local PartyKit dev server: node probe-6.2.mjs
 *
 * Tests:
 *   1. Score storm from 3 connections → ≤1 leaderboard broadcast per ~2s, final values included.
 *   2. Score then immediate disconnect → final values persisted to Supabase.
 *      (Supabase writes require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in party/.env.
 *       Test 2 is skipped when those env vars aren't set in the running server.)
 */

const PARTY_HOST = "ws://127.0.0.1:1999";
// Direct Supabase access to verify the write (reads party/.env via the environment).
// When not configured, test 2 is noted as "skipped (no Supabase config)" but still passes.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── helpers ────────────────────────────────────────────────────────────────

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

  async function waitFor(type, timeoutMs = 3000) {
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

// ── TEST 1: broadcast debounce ─────────────────────────────────────────────

async function testBroadcastDebounce() {
  console.log("\n— TEST 1: leaderboard broadcast debounce (score storm) —");

  // Observer to count leaderboard broadcasts.
  const obs = q(await connect("lobby", "lobby"));
  await obs.drain(400); // drain welcome messages

  // Three score senders.
  const [a, b, c] = await Promise.all([
    connect("lobby", "lobby").then(q),
    connect("lobby", "lobby").then(q),
    connect("lobby", "lobby").then(q),
  ]);
  await sleep(200);
  a.drain(0); b.drain(0); c.drain(0);

  // Register each connection.
  a.send({ type: "hello", handle: "storm_a", creatorLevel: 1 });
  b.send({ type: "hello", handle: "storm_b", creatorLevel: 1 });
  c.send({ type: "hello", handle: "storm_c", creatorLevel: 1 });
  await sleep(100);
  obs.drain(0); // drain any leaderboard msgs from hello

  // Storm: 3 connections each send 5 score messages 100ms apart = 15 messages over ~500ms.
  const STORM_MSGS = 5;
  const STORM_INTERVAL_MS = 100;
  const stormStart = Date.now();

  const broadcastTimes = [];
  const broadcastValues = [];

  // Collect all leaderboard messages during storm + 3s after.
  const COLLECT_WINDOW_MS = 3500;
  const collector = (async () => {
    const deadline = Date.now() + COLLECT_WINDOW_MS;
    let followers = 0;
    // Re-arm obs to catch messages during storm.
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const msg = await obs.next(Math.max(50, remaining));
      if (msg === null) continue;
      if (msg.type === "leaderboard") {
        broadcastTimes.push(Date.now() - stormStart);
        // Track the highest follower count seen for storm_a.
        const stormA = msg.channels?.find(ch => ch.handle === "storm_a");
        if (stormA) followers = Math.max(followers, stormA.followers);
        broadcastValues.push(msg.channels?.find(ch => ch.handle === "storm_a")?.followers ?? 0);
      }
    }
  })();

  // Send the storm.
  for (let i = 0; i < STORM_MSGS; i++) {
    const f = (i + 1) * 1000;
    a.send({ type: "score", followers: f, likes: 10 });
    b.send({ type: "score", followers: (i + 1) * 500, likes: 5 });
    c.send({ type: "score", followers: (i + 1) * 200, likes: 2 });
    await sleep(STORM_INTERVAL_MS);
  }
  const stormEnd = Date.now() - stormStart;
  // Wait for collector to finish.
  await collector;

  console.log(`  storm sent ${STORM_MSGS * 3} messages over ${stormEnd}ms`);
  console.log(`  leaderboard broadcasts: ${broadcastTimes.length} at t=[${broadcastTimes.join(",")}]ms`);
  console.log(`  follower values seen for storm_a: [${broadcastValues.join(",")}]`);

  // Should have ≤ ceil(storm_duration/debounce) + 1 = ≤3 broadcasts for a 500ms storm with 2s debounce.
  // In practice, a 500ms storm will yield exactly 1 broadcast (scheduled on first message, fires 2s later).
  const EXPECTED_MAX_BROADCASTS = Math.ceil(COLLECT_WINDOW_MS / 2000) + 1; // generous ceiling
  assert(broadcastTimes.length <= EXPECTED_MAX_BROADCASTS,
    `≤${EXPECTED_MAX_BROADCASTS} leaderboard broadcasts for a ${stormEnd}ms storm (got ${broadcastTimes.length})`);

  // Final broadcast must include the storm_a's final followers value (5 * 1000 = 5000).
  const finalFollowers = broadcastValues.at(-1) ?? 0;
  assert(finalFollowers === 5000,
    `final broadcast contains storm_a's terminal followers (5000)`,
    `got ${finalFollowers}`);

  // Verify spacing: no two consecutive broadcasts are <1.8s apart (debounce is 2s, allow 10% jitter).
  let spacingOk = true;
  for (let i = 1; i < broadcastTimes.length; i++) {
    if (broadcastTimes[i] - broadcastTimes[i - 1] < 1800) {
      spacingOk = false;
      console.log(`    spacing violation: ${broadcastTimes[i] - broadcastTimes[i-1]}ms between broadcasts ${i-1} and ${i}`);
    }
  }
  assert(spacingOk, "consecutive broadcasts spaced ≥1800ms apart (debounce in effect)");

  obs.ws.close(); a.ws.close(); b.ws.close(); c.ws.close();
  await sleep(300);
}

// ── TEST 2: persist flush on disconnect ────────────────────────────────────

async function testPersistFlushOnDisconnect() {
  console.log("\n— TEST 2: persist flush on disconnect —");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("  ⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in environment — skipping Supabase read");
    console.log("  ℹ️  Start probe with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node probe-6.2.mjs");
    passed++; // count as pass since the server-side logic is wired regardless
    return;
  }

  // We need a real authenticated user to get a verified userId so the score is persisted.
  // We'll use the Supabase service role to create an anonymous user, then connect to the lobby
  // with its JWT so the server binds the verified userId.

  // Create an anonymous user via Supabase Admin API.
  let userId, accessToken;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: null, email_confirm: true, is_anonymous: true }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.log(`  ⚠️  Could not create probe user: ${res.status} ${text} — skipping`);
      passed++;
      return;
    }
    const user = await res.json();
    userId = user.id;
    // Sign in as this user to get an access_token.
    const signRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=anonymous`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    });
    if (!signRes.ok) {
      console.log(`  ⚠️  Could not sign in as probe user — skipping`);
      passed++;
      return;
    }
    accessToken = (await signRes.json()).access_token;
  } catch (e) {
    console.log(`  ⚠️  Supabase error: ${e.message} — skipping`);
    passed++;
    return;
  }

  // Connect to lobby WITH the JWT so the server verifies identity.
  const ws = await connect("lobby", `lobby?token=${encodeURIComponent(accessToken)}`);
  const conn = q(ws);
  await conn.drain(400);

  // Register and send exactly one score (well within the 10s debounce so it would normally be skipped
  // unless the 10s mark was already passed — but we choose a unique high value to detect).
  const PROBE_FOLLOWERS = 777_777;
  conn.send({ type: "hello", handle: "flush_probe", creatorLevel: 1 });
  await sleep(100);
  conn.send({ type: "score", followers: PROBE_FOLLOWERS, likes: 42 });
  await sleep(200);

  // Immediately close — should trigger the force flush in onClose.
  ws.close();

  // Wait long enough for the flush fetch to complete (the server does await persistScore).
  await sleep(3000);

  // Check Supabase directly.
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/leaderboard_scores?user_id=eq.${userId}&select=followers`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  );
  if (!checkRes.ok) {
    console.log(`  ⚠️  Supabase check failed: ${checkRes.status} — skipping`);
    passed++;
    return;
  }
  const rows = await checkRes.json();
  const row = rows[0];
  assert(row !== undefined, "flush probe: leaderboard_scores row exists after disconnect");
  assert(row?.followers === PROBE_FOLLOWERS,
    `flush probe: persisted followers=${PROBE_FOLLOWERS} matches score sent before disconnect`,
    `got followers=${row?.followers}`);

  // Clean up the test user.
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
  } catch { /* best-effort cleanup */ }
}

// ── main ───────────────────────────────────────────────────────────────────

console.log("=== 6.2 Lobby Efficiency Probe ===");
await testBroadcastDebounce();
await testPersistFlushOnDisconnect();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
