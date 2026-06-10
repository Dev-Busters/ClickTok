export type Currency = "followers" | "coins" | "diamonds" | "likes";

export type Wallet = {
  followers: number;     // headline stat; scales runs; rarely spent
  totalFollowers: number;// all-time, never decreases (for milestones/prestige)
  coins: number;         // main spendable
  diamonds: number;      // premium/rare (mostly from LIVE gifts)
  likes: number;         // engagement
};
