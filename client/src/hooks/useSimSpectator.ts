// (6.1) Hook that drives a featured sim stream entirely client-side.
// Mounted unconditionally in Shell (like useSpectatorRoom); only activates
// when spectating a featured card.  useSpectatorRoom skips featured streams,
// so exactly one driver is active at a time.

import { useEffect } from "react";
import { useGameStore } from "../store";
import { startFeaturedSim } from "../features/livestream/simSpectate";

export function useSimSpectator() {
  const spectating = useGameStore(s => s.spectating);
  const trendsAvailable = useGameStore(s => s.trendsAvailable);
  const applySnapshot = useGameStore(s => s.applySnapshot);
  const leaveStream = useGameStore(s => s.leaveStream);

  useEffect(() => {
    if (!spectating?.featured) return;

    const heat = trendsAvailable.find(t => t.topic === spectating.topic)?.heat ?? 0.5;

    const cleanup = startFeaturedSim(
      spectating,
      heat,
      (snap, realViewers) => applySnapshot(snap, realViewers),
      (grade) => leaveStream(grade),
    );

    return cleanup;
    // streamId is the stable identity for a sim session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spectating?.streamId]);
}
