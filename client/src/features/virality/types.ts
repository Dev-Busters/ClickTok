export type ViralityUpgradeId =
  | "letter_rate"
  | "viral_duration"
  | "letter_dwell"
  | "viral_mult"
  | "virality_yield";

export type ViralityUpgradeDef = {
  id: ViralityUpgradeId;
  name: string;
  blurb: string;
  /** Label for the before → after readout on the card. */
  unit: string;
  /**
   * Total levels owned across the whole shop before this card appears. Keeps the Lab
   * from dumping five mechanics on the player the moment it opens — the same
   * one-at-a-time drip the onboarding ladder uses.
   */
  revealAtTotalLevels: number;
  /** Accent colour for the card. */
  color: string;
};
