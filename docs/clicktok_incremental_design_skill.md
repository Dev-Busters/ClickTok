# ClickTok Design Framework: From Framework to Addictive

A custom skill for building ClickTok into an addictive, multiplayer incremental game. Consolidates 4 industry guides + your comprehensive Content-and-Feel guide + proven UX patterns.

**TL;DR:** You have a solid framework. You're missing *feedback loops* (upgrades don't feel rewarding), *pacing clarity* (critical path is invisible), and *content variety* (every run is mechanically identical). This skill systematizes how to fix those.

---

## PART 1: DIAGNOSIS — Why Your Last Two Games Failed

Both Agent Arena and Epoch had:
- ✅ Good core mechanics
- ✅ Detailed design specs
- ❌ Invisible progression (upgrades didn't *feel* impactful)
- ❌ Unclear pacing (players didn't know what to do next)
- ❌ Samey content (no variety to discover)

**ClickTok is different.** You have detailed economy formulas, progressive unlock specs, and a working multiplayer infrastructure. Your problem isn't architecture—it's **resonance**: the moment-to-moment feedback that makes players feel their progress.

### The Core Fix: Three Things

1. **Feedback loops** — After a player buys an upgrade, show them *exactly* how it changed their power.
2. **Pacing clarity** — Each unlock should hit at a predictable moment; no dead zones.
3. **Content variety** — Modifiers, video buffs, gear synergies make each run feel different.

---

## PART 2: FEEDBACK LOOPS (Why Upgrades Don't Feel Good Yet)

### The Problem
Your economy has lots of multipliers:
- Engagement Boost adds post power
- Charisma adds starting viewers
- Monetization adds gift rate
- etc.

But **multipliers are invisible.** A player buys "Engagement Boost +1 post power" and won't feel it until they post again—and then the coin gain increases from, say, 5 to 6, which reads as noise.

### The Solution: Immediate, Readable Feedback

**After every significant purchase, show a "before/after" readout:**

#### For repeatable upgrades (e.g., Engagement Boost)
```
┌─ UPGRADE PURCHASED ─┐
│ Engagement Boost → Level 2
│ 
│ 📊 YOUR STATS:
│    Coins per tap: 7 → 10 (+43% 🔥)
│    Followers per tap: 5 → 5
│ 
│ [TAP TO SEE THE DIFFERENCE]
└─────────────────────┘
```
The button closes and auto-focuses the TEB so the player immediately taps and sees the new number. This is **huge**—the moment they understand "I bought something, and look—I'm 43% stronger now," the upgrade loop becomes emotionally rewarding.

#### For gear (e.g., Ring Light)
```
┌─ GEAR EQUIPPED ─┐
│ Ring Light
│ 
│ 📊 YOUR SETUP:
│    Post Power: +3
│    [visual: lighting icon appears on TEB]
│ 
│ Your next posts will be brighter!
└──────────────┘
```

#### For skills (e.g., Charisma)
```
┌─ SKILL LEVELED UP ─┐
│ Charisma → Level 1
│ 
│ 📊 NEXT RUN BOOST:
│    Starting viewers: +5% (base 10 → 10.5)
│    Posts: +1 power
│ 
│ [TRY A LIVESTREAM NOW]
└────────────────────┘
```

#### For elements (e.g., Beat Sync)
When a player buys an element:
1. A celebratory popup fires: "🎵 BEAT SYNC UNLOCKED!"
2. The Elements section in Creator Studio shows "Beat Sync" with a "TRY NOW" button.
3. Tapping "TRY NOW" scrolls the FYP to show an active Wave with Beat Sync visible.
4. The player immediately gets to try it.

This closes the feedback loop in <1 second instead of waiting 20s for a Wave to naturally spawn.

### Implementation Checklist
- [ ] Post-purchase, show a modal with before/after stats.
- [ ] Use emojis and color to highlight the improvement (+43% 🔥).
- [ ] Include a CTA button that either closes/taps TEB (upgrades) or tries the element (elements).
- [ ] Log each feedback modal as a PostHog event (helps you see if players are reading them).

---

## PART 3: PACING — The Critical Path (First 5 Minutes)

Your specs define a progressive unlock sequence. The problem: **if the unlocks don't hit at the right cadence, players quit.**

### Critical Milestones (From Your Spec)

| Milestone | Trigger | What Unlocks | Target Time |
|-----------|---------|-------------|------------|
| **First tap** | 1 tap | TEB teaching | ~5s |
| **Engagement Boost L1** | ~5 taps | First repeatable, +post power | ~30s total |
| **Ring Light (gear)** | ~28 taps | First one-time upgrade | ~90s total |
| **Beat Sync (element)** | ~37 taps | First rhythm mechanic | ~120s total |
| **Studio opens** | ~80 views | Upgrade hub expands | ~150s total |
| **GO LIVE button** | ~200 followers | Livestream layer unlocks | ~180s total |

### Red Flags to Playtest For

1. **Does tapping feel rewarding immediately?**
   - First tap should grant visible coins + a pop-number.
   - If it's silent, players think nothing happened.

2. **Does Engagement Boost L1 feel impactful?**
   - After buying (cost 10 coins), the next 5 taps should visibly earn more.
   - Without the before/after feedback modal, it feels like spending for nothing.

3. **Does Ring Light feel like a real upgrade?**
   - This is the first *one-time* purchase. It should change something visible (gear icon, TEB glow, etc.).
   - Otherwise it reads as "I spent coins and nothing happened."

4. **Are elements unlocked early enough?**
   - Beat Sync at ~37 taps is good.
   - But if it's gated behind a follower threshold you don't hit until minute 3, you've lost casual players.

5. **Is there a dead zone between unlocks?**
   - >45 seconds with no new unlock = players get bored.
   - If Ring Light is at 28 taps and Beat Sync at 37, that's only 9 taps (~1min). Good.
   - If there's a 2-minute grind between Ring Light and Beat Sync, you've lost them.

### Metrics to Track (PostHog Events)

Log these at each milestone:
```javascript
posthog.capture('milestone_reached', {
  milestone: 'engagement_boost_l1',
  time_since_session_start: 47, // seconds
  wallet: { coins: 0, followers: 5, diamonds: 0 },
  owned_upgrades: ['engagement_boost_l1'],
  owned_elements: [],
  skill_levels: { charisma: 0, stagecraft: 0 }
});
```

After 5–10 playtests from fresh saves, plot these on a timeline:
- **First GO LIVE should hit within 2–3 minutes.** If it's >4min, pacing is broken.
- **No dead zones >45 seconds.** If players spend 2min grinding before Ring Light, something's wrong.
- **Player sentiment at each milestone** should progress: "cool, it worked" → "I see progress" → "this is fun."

---

## PART 4: THE META→RUN BRIDGE (Why Runs Matter)

Right now:
- Idle tapping earns coins slowly.
- Livestreams earn ~5–10x more coins per unit time.
- Skills/gear visibly change run parameters (more viewers, higher gift rate, etc.).

**Problem:** if idle tapping is boring, players won't buy gear to make runs better. If runs aren't obviously better than tapping, players won't bother trying.

### Solution 1: Pre-Run Loadout Screen

Before the player hits GO LIVE, show them **exactly what they're bringing:**

```
═══════════════════════════════
       YOUR STREAM SETUP
═══════════════════════════════

📊 STARTING VIEWER COUNT: 47
   Base: 10
   From followers (5k): +30 (3 per 100k)
   From Charisma L1: +7 (+5%)

💰 GIFT RATE: 0.24 per second
   Base: 0.1
   Monetization L3: +0.14 (140%)
   Mod bonus: +50% (TOUGH CROWD)

🎭 HYPE DECAY: 1.3 per second
   Base: 2.0
   Stagecraft L3: -35% (1.3 now)

🎬 REACTIONS READY:
   · Hype Dance (6s cooldown) — +18 hype
   · Clapback (8s cooldown) — remove troll
   · [LOCKED] Pin Comment (need Green Screen gear)

⚡ ACTIVE MODS:
   • TRENDING SOUND — +100% hype wave frequency
   • TOUGH CROWD — +50% troll frequency, +40% gift values

═══════════════════════════════
           [GO LIVE]
═══════════════════════════════
```

**Why this works:** players who see "I have 47 viewers, and my Stagecraft L3 is slowing hype decay by 35%" understand *exactly* what their meta progression did. They'll be motivated to buy more gear because they can visualize the stat upgrades.

### Solution 2: Post-Run Breakdown (Emotional)

After a run ends, don't just show coins/followers. Show:

```
═══════════════════════════════
        🎬 STREAM STATS
═══════════════════════════════

GRADE: A ⭐ (+25% bonus rewards)
Duration: 185s (full run)
Peak viewers: 312 (you started with 47!)

💰 REWARDS EARNED:
   +892 coins
   +156 followers
   +4 diamonds

🔥 YOUR GEAR & SKILLS CONTRIBUTED:
   · Monetization L3: +67 coins (7.5%)
   · Studio Lights: +120 coins (13.5%)
   · Charisma L1: started 5 viewers ahead (→ +47 coins)
   
   [→ Invest in gear to earn more next time!]

═══════════════════════════════
      [BACK TO STUDIO]
═══════════════════════════════
```

This reinforces: *I upgraded my gear, and look—my next run was clearly better.*

### Implementation Checklist
- [ ] Before GO LIVE, render the loadout screen (pull current skill levels, gear, modifiers).
- [ ] Show all stat calculations so players understand the bridge from meta → run.
- [ ] After run ends, attribute run rewards to specific gear/skills.
- [ ] Include a motivational message ("Invest in gear to earn more next time!").
- [ ] Log `run_started` and `run_ended` events to PostHog (helps you track pacing).

---

## PART 5: CONTENT VARIETY (Why Runs Feel Samey)

### The Problem
Right now, a livestream run is:
- Random modifiers
- Random events (trolls, gifts, etc.)
- Player reacts as best they can

But every run is mechanically identical. No synergies. No playstyle variation.

### Solution: Make Modifiers Narrative & Strategic

Instead of just numbers, give modifiers **flavor + strategy hints**:

```
┌─ ACTIVE MOD ─┐
│ 🎵 TRENDING SOUND
│ +100% hype wave frequency
│ 
│ Strategy: Waves spawn fast!
│ Use Hype Dance more often.
│ Ignore trolls—focus on hype.
└──────────────┘
```

vs.

```
┌─ ACTIVE MOD ─┐
│ 😤 TOUGH CROWD
│ +50% troll frequency
│ +40% gift values
│ 
│ Strategy: Lots of toxicity,
│ but big payoffs.
│ Use Clapback aggressively.
│ Charisma helps here.
└──────────────┘
```

This transforms a random +X% into a *playstyle decision.*

### Solution: Video Buffs & Catalog Persistence

When a player posts a video to the FYP:
1. The video earns passive income (coins every few seconds until it's de-ranked).
2. The video carries a "buff" (e.g., "+10% coins per tap for 60 seconds if you view this video").
3. Other players can view the video, get the buff, and both players benefit.

This makes the FYP section feel like **your growing channel**, not just a game screen.

### Implementation Checklist
- [ ] Add flavor text + strategy hints to each modifier (in your config/content folder).
- [ ] Attach video buffs to each video (formula per your economy doc).
- [ ] Show a "Video Catalog" on the Profile tab (list posted videos + passive income).
- [ ] Let players view their own videos + see how many people have viewed them.
- [ ] Log `video_posted`, `video_viewed`, `video_buff_applied` events to PostHog.

---

## PART 6: EARLY-GAME PACING CHECKLIST

Use this checklist when playtesting from a fresh save:

### 0–30 seconds (First tap & Engagement Boost)
- [ ] After ~5 taps, 10 coins are earned.
- [ ] "Engagement Boost L1" is highlighted (not hidden in a menu).
- [ ] Cost is 10 coins (achievable in ~1min of tapping).
- [ ] After buying, a "before/after" modal shows "+40% coins/tap" or similar.
- [ ] Player taps again and sees the new number; it feels rewarding.
- [ ] **Feeling:** "I bought something and I'm stronger now."

### 30–90 seconds (First gear)
- [ ] After ~28 taps total, Ring Light is highlighted.
- [ ] Cost is reasonable (~50 coins, or ~5min of current tapping pace).
- [ ] After buying, the TEB gains a subtle visual effect (glow, icon, particle).
- [ ] A modal shows "Ring Light added +3 post power."
- [ ] **Feeling:** "I bought something and the game looks cooler."

### 90–120 seconds (First element)
- [ ] After ~37 taps, Beat Sync (or another rhythm element) is purchasable.
- [ ] Cost is ~80 coins (achievable grind from current pace).
- [ ] After buying, a celebration popup fires ("🎵 BEAT SYNC UNLOCKED!").
- [ ] A "TRY NOW" button in the studio scrolls the FYP to show an active Beat Sync wave.
- [ ] Player taps the element immediately; it's visually/sonically satisfying.
- [ ] **Feeling:** "That was fun. I want to try that again."

### 120–180 seconds (Studio & unlock breadcrumbs)
- [ ] By ~80 views, the Studio button appears.
- [ ] Studio opens with 3 tabs: Viewer, Posting, Live.
- [ ] Viewer tab shows repeatable upgrades + gear + skills.
- [ ] Posting tab is locked/greyed until ~90 followers.
- [ ] Live tab is locked/greyed until ~200 followers.
- [ ] A tooltip hints: "Unlock more features by growing your followers."
- [ ] **Feeling:** "There's more to discover."

### 180–300 seconds (GO LIVE unlock)
- [ ] By ~200 followers (~71 taps per your spec), the GO LIVE button lights up.
- [ ] Tapping GO LIVE shows the pre-run loadout screen (as per Part 4).
- [ ] Player can tweak nothing (it's the first run), just "GO LIVE."
- [ ] First run is ~180 seconds, starts easy (low viewer count, slow events), ramps up.
- [ ] **Feeling:** "OK, now I understand the full game."

### Post-First-Run (300–360 seconds)
- [ ] Player completes the run and sees the score screen (per Part 4).
- [ ] Score screen shows how meta progression affected the run.
- [ ] Payout is visibly larger than 180 seconds of idle tapping (~500+ coins vs. ~50 from tapping).
- [ ] Back on Home, the player is motivated to upgrade gear for the next run.
- [ ] **Feeling:** "I want to do another run to get more gear."

### Acceptance Criteria
- Total time to first GO LIVE: **2–3 minutes**.
- Total time to first completed run: **4–5 minutes**.
- Player sentiment progression: "cool, it worked" → "I see progress" → "this is fun to engage with."

---

## PART 7: INSTRUMENTATION & TELEMETRY

Use PostHog to track where players disengage. Log these events:

### Session Events
```javascript
posthog.capture('session_start', {
  timestamp: Date.now(),
  save_version: 1, // increment if you change format
  player_handle: 'user_123'
});

posthog.capture('session_end', {
  elapsed_sec: 423,
  final_followers: 156,
  final_coins: 892,
  final_diamonds: 4,
  reason: 'user_quit' // or 'crash', 'app_closed'
});
```

### Milestone Events
```javascript
posthog.capture('milestone_reached', {
  milestone: 'engagement_boost_l1',
  time_since_session_start: 47,
  wallet: { coins: 0, followers: 5, diamonds: 0 },
  owned_upgrades: ['engagement_boost_l1'],
  owned_elements: [],
  skill_levels: { charisma: 0, stagecraft: 0 }
});
```

### Upgrade Events
```javascript
posthog.capture('upgrade_purchased', {
  id: 'engagement_boost_l2',
  cost: 15,
  time_since_session_start: 127,
  wallet_before: { coins: 23 },
  wallet_after: { coins: 8 },
  new_stat_impact: '+40% coins/tap'
});

posthog.capture('feedback_modal_shown', {
  upgrade_id: 'engagement_boost_l2',
  stat_change: '+40%',
  player_dismissed: true // did they close it immediately or interact?
});
```

### Element Events
```javascript
posthog.capture('element_unlocked', {
  element_id: 'beat_sync',
  via: 'milestone', // or 'craft'
  time_since_session_start: 103,
  try_now_clicked: true
});

posthog.capture('element_used', {
  element_id: 'beat_sync',
  wave_count: 3,
  success_count: 2, // how many taps hit the timing?
  run_id: 'run_001'
});
```

### Run Events
```javascript
posthog.capture('run_started', {
  run_id: 'run_001',
  meta_state: {
    followers: 200,
    skills: { charisma: 1, stagecraft: 0 },
    gear: ['ring_light'],
    gear_effects: { post_power: 3 }
  },
  starting_viewers: 47,
  modifiers: ['trending_sound', 'tough_crowd'],
  time_since_session_start: 198
});

posthog.capture('run_ended', {
  run_id: 'run_001',
  duration: 185,
  peak_viewers: 312,
  final_hype: 45,
  grade: 'A',
  payout: { coins: 892, followers: 156, diamonds: 4 },
  gear_contribution: {
    monetization_l3: { coins: 67, pct: 7.5 },
    studio_lights: { coins: 120, pct: 13.5 }
  }
});
```

### Retention Events
```javascript
posthog.capture('day_1_return', {
  player_id: 'user_123',
  session_1_end: 1623456789,
  session_2_start: 1623543189, // 24 hours later
  returned: true
});
```

### What to Look For

1. **Session duration by day.**
   - New players: are first sessions >5min? If <2min, pacing is broken.
   - Day 7+ players: are sessions >10min? If declining, content variety is weak.

2. **Upgrade→run gap.**
   - Time from last upgrade purchase to first run start.
   - If >60s, players feel stuck (nothing to buy, nothing to do).

3. **Element success rate.**
   - Beat Sync: what % of waves result in a successful hit?
   - If <20%, it's too hard; if >90%, too easy.
   - Target: 40–60% (feels challenging, rewarding when you win).

4. **Run→upgrade gap.**
   - Time from run completion to next upgrade purchase.
   - If >60s, run rewards don't feel motivating enough.

5. **Feedback modal interaction.**
   - Are players reading post-purchase feedback?
   - If 90%+ dismiss immediately, the feedback isn't resonating (make it punchier).

---

## PART 8: QUICK-REFERENCE ROADMAP

### Week 1: Feedback Loops (Most Important)
- [ ] Add before/after modals to all upgrade purchases.
- [ ] Add pre-run loadout screen.
- [ ] Add post-run breakdown (attribute rewards to gear/skills).
- [ ] Playtest from fresh save 3–5 times; track pacing via timeline.
- [ ] **Acceptance:** First GO LIVE hits by minute 2–3, player feels "I'm stronger now" after each purchase.

### Week 2: Pacing & Content
- [ ] Add flavor text + strategy hints to all modifiers.
- [ ] Implement video buff catalog (passive income formula).
- [ ] Add gear icons/visuals to TEB and run screens.
- [ ] Implement skill leveling UI (show skill effects in runs).
- [ ] Playtest again; identify stall points (upgrades that feel weak, runs that are too hard/easy).
- [ ] **Acceptance:** No dead zones >45s; element success rate 40–60%.

### Week 3: Balance & Polish
- [ ] Tune cost curves (Engagement Boost growth rate, Ring Light cost, etc.) based on playtest data.
- [ ] Tune run difficulty (first run at 200 followers should feel achievable, Grade B+).
- [ ] Add missing gear/skill content (per your economy spec).
- [ ] Playtest with 5+ fresh players; collect PostHog telemetry.
- [ ] **Acceptance:** D1 retention ≥40%, D7 retention ≥15%, prestige (if you have it) ≥20% by day 3.

### Week 4+: Iteration & Launch
- [ ] Weekly playtest cycles; identify friction via PostHog.
- [ ] Iterate balance (tune cost curves, run difficulty, modifier frequency).
- [ ] Monitor retention cohorts; adjust pacing if drop-off accelerates.
- [ ] Ship monthly updates (new gear, skill, modifier) to keep engaged players coming back.

---

## PART 9: DECISION TEMPLATES

### When Tuning Cost Curves
Use this template to guide adjustments:

```
UPGRADE: Engagement Boost L1
Current cost: 10 coins
Current unlocked at: ~5 taps (~30 seconds)

PLAYTEST RESULT:
- Player bought it at 32 seconds? Too easy (no grind).
- Player had to wait >90s for coins? Too hard (bored them).
- Player bought it at 45s? Goldilocks.

If too easy: Increase cost to 15 coins (→ ~1 min grind).
If too hard: Decrease cost to 8 coins (→ ~25s grind).

Retest after adjustment.
```

### When Tuning Element Difficulty
Use this template:

```
ELEMENT: Beat Sync
Current spec: 3 taps in sequence, ring closes in 1.5s per tap.

PLAYTEST RESULT:
- Player hit 0/3 taps? Too hard (frustrating).
- Player hit 3/3 taps? Too easy (not rewarding).
- Player hit 1–2/3 taps? Goldilocks.

If too hard: Increase ring close time to 2s (more generous window).
If too easy: Decrease ring close time to 1s (tighter window).

Retest after adjustment.
```

---

## PART 10: EXAMPLE PLAYTESTING SESSION (Fresh Save)

**Goal:** Verify pacing and feedback loops are working.

**Setup:** 
- Fresh player account
- Clean browser (no cache)
- PostHog logging enabled
- Stopwatch

**Timeline:**
```
0:00 - Player opens game
0:05 - First tap → coins appear
0:30 - Engagement Boost L1 highlighted
0:45 - [Buy Engagement Boost L1]
        Feedback modal appears (+40% coins/tap)
        Player taps TEB again, sees new number
        [Feeling: "I'm stronger!"]
1:30 - Ring Light highlighted
2:00 - [Buy Ring Light]
        Feedback modal appears
        TEB gains visual effect
        [Feeling: "The game looks cooler"]
2:30 - Beat Sync highlighted
3:00 - [Buy Beat Sync]
        Celebration popup fires
        "TRY NOW" button scrolls FYP
        Player sees active Beat Sync wave
        [Feeling: "That was fun"]
3:30 - Studio button appears
4:00 - Studio opened
        Player explores tabs (some locked)
4:30 - GO LIVE button highlights
5:00 - [Tap GO LIVE]
        Pre-run loadout screen
        [Feeling: "I understand the full game"]
5:30 - [Start first run]
6:00 - [Run progresses...]
8:00 - [Run completes]
        Post-run breakdown shows:
        - Grade A (+25% bonus)
        - +892 coins (vs. ~50 from tapping)
        - Monetization L3: +67 coins
        - Charisma L1: +47 coins
        [Feeling: "I want to run again to get more gear"]
```

**Success Criteria:**
- First GO LIVE: minute 4–5 ✅
- Feedback modals shown and read: all ✅
- Element felt fun on first try: yes ✅
- Run payout felt rewarding: yes ✅
- Player sentiment progression: correct ✅

**PostHog Analysis:**
- Milestone timing matches expectations? → Pacing OK
- Feedback modal dismissal rate <20%? → Feedback resonating
- Element success rate 40–60%? → Difficulty balanced
- Run→upgrade gap <30s? → Rewards motivating

---

## PART 11: RED FLAGS (Stop & Debug)

🚨 **If playtest shows first session <2 minutes:**
- Pacing is too fast (players lose interest before seeing depth).
- OR game crashes/doesn't load.
- **Action:** Add a UI breadcrumb after Ring Light that says "Next: Try Beat Sync!" to slow down pace.

🚨 **If playtest shows first GO LIVE >4 minutes:**
- Pacing is too slow (players quit before unlocking the "real" game).
- **Action:** Lower follower threshold for GO LIVE unlock (currently 200, try 150).

🚨 **If feedback modals are dismissed 90%+ without reading:**
- Feedback isn't resonating.
- **Action:** Add emoji, color, animations. Make it punchy. Include a GIF of the stat change.

🚨 **If element success rate <20%:**
- Element is too hard.
- **Action:** Increase timing window (ring close time, tap duration, etc.).

🚨 **If element success rate >90%:**
- Element is too easy; not rewarding.
- **Action:** Decrease timing window; add random variance.

🚨 **If run→upgrade gap >60 seconds:**
- Players don't feel motivated to upgrade after runs.
- **Action:** Check run payout (should be 5–10x idle tapping for same duration). If too low, increase run rewards.

---

## PART 12: APPENDIX — Sources & References

1. **Lessons of My First Incremental Game** (Pedro Furtado, Game Developer)
   - Key: Set a hard deadline. Don't add theme before proving fun.
   - Don't add features to hide boredom; fix the boring core first.

2. **How to Make an Idle Game** (Adjust)
   - Key: Don't rely on one mechanic. Multiple progression systems keep players engaged.
   - Retention baseline: 18% stickiness (idle) vs. 10.5% (hyper-casual).
   - Best practice: Rewarded video ads add 10–30% LTV without harming retention.

3. **Creating An Incremental Game** (Kastark)
   - Key: Exponential cost formula: `cost = baseCost × growthRate^(numberOwned)`
   - Typical growthRate: 1.07–1.15 (test to find the sweet spot).
   - Always keep the core loop in a config file for easy balancing.

4. **Clicker Games: Technical Exploration** (Tommcfly, Medium)
   - Key: Big number handling (use decimal.js or custom mantissa-exponent approach).
   - Prestige mechanics: `prestigeCurrency = (totalLifetimeEarnings)^0.65 × multiplier` (creates infinite loop).
   - Offline progression: Cap offline time (e.g., 8 hours max) to prevent exploitation.
   - Synchronization: Timestamp-based conflict resolution for cross-device play.

5. **ClickTok Content & Feel Guide** (Claude, from your design docs)
   - Key: Framework is solid. Missing: feedback loops, pacing clarity, content variety.
   - Critical path (minute 0–5): every unlock should hit at predictable time.
   - Prestige/roguelike loop: each run should feel different (modifiers, video buffs, synergies).

---

## Summary: Your Path Forward

You have:
- ✅ Detailed economy formulas
- ✅ Progressive unlock specs
- ✅ Working multiplayer infrastructure
- ❌ Feedback loops (upgrades don't *feel* impactful)
- ❌ Pacing clarity (no dead zones, clear critical path)
- ❌ Content variety (runs feel samey)

**Start here:**
1. **Week 1:** Add feedback modals (before/after readouts, pre-run loadout, post-run breakdown).
2. **Playtest:** Fresh save from minute 0–5. Track milestones via PostHog.
3. **Iterate:** Adjust pacing based on data. No dead zones >45s. First GO LIVE by minute 2–3.
4. **Week 2:** Add modifier flavor + video catalog + gear visuals.
5. **Playtest again:** Element success rate 40–60%, run→upgrade gap <30s.
6. **Launch confident:** You'll have a game that *feels* fun, not just engineered.

You built the framework. Now let's make it sing.
