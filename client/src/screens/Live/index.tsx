import { useGameStore } from "../../store";
import { StreamerLive } from "./StreamerLive";
import { SpectatorLive } from "./SpectatorLive";

// ——— Top-level Live: routes to streamer or spectator mode ————————————————————

export function Live() {
  const spectating = useGameStore(s => s.spectating);
  const pendingDrop = useGameStore(s => s.pendingDrop);

  if (spectating !== null || pendingDrop !== null) {
    return <SpectatorLive />;
  }

  return <StreamerLive />;
}
