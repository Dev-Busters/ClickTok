import type { RunChoice, RunEventType } from "./types";

// Effect keys consumed by `resolveChoice` in runSlice. Magnitudes are
// implementation choices (not specified in 04) anchored to existing run
// formulas: hype deltas in the same range as reactions (04 §9), follower
// grants as a fraction of current viewers (like `pin_comment`), and the
// sponsor payout using the `collectGift` formula at the "galaxy" gift tier.
export type ChoiceEffectId =
  | "sponsor_accept"
  | "sponsor_decline"
  | "drama_clapback"
  | "drama_classy"
  | "shoutout_fan"
  | "shoutout_skip";

export type ChoiceEventTemplate = {
  type: Extract<RunEventType, "comment" | "sponsor">;
  text: string;
  choices: RunChoice[];
};

// 01 §5.2: "Sponsor ping" (coins now, small viewer dip) and comment "choice
// prompts" with a couple of authored scenarios.
export const CHOICE_EVENT_POOL: ChoiceEventTemplate[] = [
  {
    type: "sponsor",
    text: '💰 sponsor DM: "shill our energy drink for $$$?"',
    choices: [
      { label: "Take the bag", apply: "sponsor_accept" satisfies ChoiceEffectId },
      { label: "Decline", apply: "sponsor_decline" satisfies ChoiceEffectId },
    ],
  },
  {
    type: "comment",
    text: 'chat: "ratio this if [rival] does it better 💀"',
    choices: [
      { label: "Clap back", apply: "drama_clapback" satisfies ChoiceEffectId },
      { label: "Stay classy", apply: "drama_classy" satisfies ChoiceEffectId },
    ],
  },
  {
    type: "comment",
    text: 'chat: "shout out my small channel pls 🙏"',
    choices: [
      { label: "Shout them out", apply: "shoutout_fan" satisfies ChoiceEffectId },
      { label: "Keep going", apply: "shoutout_skip" satisfies ChoiceEffectId },
    ],
  },
];
