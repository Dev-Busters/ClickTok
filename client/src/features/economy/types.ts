export type Currency = "followers" | "coins" | "diamonds" | "likes" | "virality";

export type Wallet = {
  followers: number;     // headline stat; scales runs; rarely spent
  totalFollowers: number;// all-time, never decreases (for milestones/prestige)
  coins: number;         // premium currency (mirrors real TikTok Coins) — never a
                         // reward for a core-loop mechanic
  diamonds: number;      // premium/rare (mostly from LIVE gifts)
  likes: number;         // player↔player only: spending a Like transfers it to
                         // another creator. Never minted by a solo mechanic.
  virality: number;      // earned ONLY by the V·I·R·A·L letter mechanic, spent ONLY
                         // in the Viral Lab (see docs/18)
};
