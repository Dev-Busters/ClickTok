export type VideoPost = {
  id: string;
  topic: string;             // trend/topic it was posted under
  createdAt: number;
  coinsPerSec: number;       // passive yield (decays over time, see 04 § Catalog)
  followersPerSec: number;
  peakAtSec: number;         // when this video's yield peaks then decays
};
