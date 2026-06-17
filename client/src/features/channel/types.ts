export type VideoPost = {
  id: string;
  topic: string;             // trend/topic it was posted under
  captionId?: string;        // caption template id (for My Videos display)
  createdAt: number;
  coinsPerSec: number;       // passive yield (decays over time, see 04 § Catalog)
  followersPerSec: number;
  peakAtSec: number;         // when this video's yield peaks then decays
  // 15.3: optional view-buff — the temporary boost viewers get when this card becomes active
  buff?: { mult: number; durationSec: number };
};
