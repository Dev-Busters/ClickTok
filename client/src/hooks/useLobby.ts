import { useEffect, useRef } from "react";
import PartySocket from "partysocket";
import { useGameStore } from "../store";
import type { LobbyClientMessage, LobbyServerMessage, LiveStreamSummary } from "../party/types";

const PARTY_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";
const LIVE_UPDATE_MS = 3000;

function computeCreatorLevel(totalFollowers: number): number {
  return 1 + Math.floor(Math.log10(Math.max(1, totalFollowers)));
}

export function useLobby() {
  const socketRef = useRef<PartySocket | null>(null);
  const streamIdRef = useRef<string | null>(null);

  const handle = useGameStore(s => s.handle);
  const setLiveDirectory = useGameStore(s => s.setLiveDirectory);
  const phase = useGameStore(s => s.phase);
  const params = useGameStore(s => s.params);
  const streamId = useGameStore(s => s.streamId);

  // Connect to the global lobby room once the player has a handle.
  useEffect(() => {
    if (!handle) return;

    const socket = new PartySocket({ host: PARTY_HOST, room: "lobby", party: "lobby" });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      const { wallet } = useGameStore.getState();
      const msg: LobbyClientMessage = {
        type: "hello",
        handle,
        creatorLevel: computeCreatorLevel(wallet.totalFollowers),
      };
      socket.send(JSON.stringify(msg));
    });

    socket.addEventListener("message", (e: MessageEvent) => {
      const msg: LobbyServerMessage = JSON.parse(e.data as string);
      if (msg.type === "directory") {
        setLiveDirectory(msg.streams);
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [handle, setLiveDirectory]);

  // Announce goLive when a run starts; send liveUpdate periodically; send endLive when done.
  useEffect(() => {
    const socket = socketRef.current;
    if (phase !== "live" || !params || !socket || !streamId) return;

    streamIdRef.current = streamId;
    const startedAt = Date.now();

    const buildSummary = (): LiveStreamSummary => {
      const s = useGameStore.getState();
      return {
        streamId,
        handle: s.handle ?? "",
        creatorLevel: computeCreatorLevel(s.wallet.totalFollowers),
        topic: params.topic,
        viewers: s.viewers,
        realViewers: 0,
        hype: s.hype,
        startedAt,
      };
    };

    socket.send(JSON.stringify({ type: "goLive", summary: buildSummary() } satisfies LobbyClientMessage));

    const intervalId = setInterval(() => {
      socketRef.current?.send(
        JSON.stringify({ type: "liveUpdate", summary: buildSummary() } satisfies LobbyClientMessage)
      );
    }, LIVE_UPDATE_MS);

    return () => {
      clearInterval(intervalId);
      const s = socketRef.current;
      if (s && streamIdRef.current) {
        s.send(JSON.stringify({ type: "endLive", streamId: streamIdRef.current } satisfies LobbyClientMessage));
        streamIdRef.current = null;
      }
    };
  }, [phase, params, streamId]);
  // params is stable for the life of a run; phase transitions drive setup/teardown
}
