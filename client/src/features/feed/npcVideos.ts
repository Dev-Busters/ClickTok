import type { VideoCard, FeedModId } from "../../party/types";
import { MOD_IDS } from "./mods";
import { BALANCE } from "../economy/balance";

// Caption template pool: stable ids → template strings.
// {topic} is substituted at render time. Server whitelists these ids exactly.
export const CAPTION_TEMPLATES: Record<string, string> = {
  algo_chose:      "{topic} hits different 💀",
  pov_algo:        "POV: the algorithm chose you",
  no_sleep:        "no sleep just {topic} 📱",
  real_talk:       "real talk: {topic} is everything",
  not_ready:       "you're not ready for this {topic}",
  main_character:  "main character moment ✨",
  trend_check:     "trend check: {topic} edition",
  ratio_check:     "ratio this if you love {topic}",
  lowkey_obsessed: "lowkey obsessed with {topic} rn",
  its_giving:      "it's giving {topic} vibes 💅",
  no_thoughts:     "no thoughts just {topic}",
  out_here:        "out here doing {topic} things",
  this_is_it:      "this is it. this is {topic}.",
  unhinged:        "unhinged {topic} content as promised",
  literally_me:    "literally me doing {topic}",
  your_sign:       "your sign to get into {topic}",
  day_one:         "day one {topic} fan behavior",
  caught_in_4k:    "caught in 4K loving {topic}",
  not_me:          "not me obsessing over {topic} again",
  vibes_check:     "{topic} vibes check ✅",
};

export const CAPTION_IDS = Object.keys(CAPTION_TEMPLATES);

const NPC_HANDLES = [
  "nightowl99", "pixelbabe", "coastalvibes", "groovylama",
  "cryptoKween", "sunrisesteph", "retrowave88", "noodlebrain",
  "glitchguru", "wanderlust_kai", "beatmaker7", "cozycottage",
  "speedrunQueen", "aestheticAce", "chillhopfan", "doomscrolling",
  "pastelPunk", "legallycringe", "hotpocket_irl", "vibecheck404",
];

const NPC_TOPICS = [
  "dancing", "cooking", "gaming", "comedy", "fitness",
  "fashion", "music", "lifehacks", "pets", "trending",
];

// Minimal seeded PRNG (mulberry32) so NPC decks are stable across renders.
function mkRng(seed: number) {
  let s = (seed >>> 0) + 1;
  return (): number => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.floor(r * arr.length)];
}

export function generateNpcCard(index: number): VideoCard {
  const rand = mkRng(index);
  const topic  = pick(NPC_TOPICS, rand());
  const handle = pick(NPC_HANDLES, rand());
  const mod    = pick(MOD_IDS, rand()) as FeedModId;
  const captionId = pick(CAPTION_IDS, rand());
  const creatorLevel = 1 + Math.floor(rand() * 4);
  const postedAt = Date.now() - Math.floor(rand() * 3_600_000);
  const tapCount = Math.floor(rand() * 250);

  // 04 §13.7 NPC seeding: likes log-uniform in [npcSeedLikesMin, npcSeedLikesMax];
  // comments/shares derived as a fraction of likes.
  const { npcSeedLikesMin, npcSeedLikesMax } = BALANCE.feed;
  const logMin = Math.log10(npcSeedLikesMin);
  const logMax = Math.log10(npcSeedLikesMax);
  const likes = Math.round(10 ** (logMin + rand() * (logMax - logMin)));
  const comments = Math.round(likes * (0.02 + rand() * 0.06));
  const shares = Math.round(likes * (0.01 + rand() * 0.02));

  return {
    videoId:      `npc-${index}`,
    handle,
    creatorLevel,
    topic,
    captionId,
    mod,
    postedAt,
    tapCount,
    reactions: { likes, comments, shares },
    npc:       true,
    buff:      { mult: BALANCE.catalog.viewBuffMult, durationSec: BALANCE.catalog.viewBuffDurationSec },
  };
}

export function generateNpcDeck(count: number): VideoCard[] {
  return Array.from({ length: count }, (_, i) => generateNpcCard(i));
}

export function formatCaption(captionId: string, topic: string): string {
  const template = CAPTION_TEMPLATES[captionId] ?? captionId;
  return template.replace(/\{topic\}/g, topic);
}
