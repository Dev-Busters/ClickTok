import { useEffect, useRef } from "react";
import PartySocket from "partysocket";
import { useGameStore } from "../store/gameStore";
import type { ClientMessage, ServerMessage } from "../party/types";

const PARTY_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";

export function useTrendRoom(topic: string | null) {
  const socketRef = useRef<PartySocket | null>(null);
  const handle = useGameStore(s => s.handle);
  const followers = useGameStore(s => s.wallet.followers);
  const likes = useGameStore(s => s.wallet.likes);
  const setLeaderboard = useGameStore(s => s.setLeaderboard);

  // Connect / reconnect when topic changes
  useEffect(() => {
    if (!topic || !handle) return;

    const socket = new PartySocket({ host: PARTY_HOST, room: topic });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      const msg: ClientMessage = { type: "join", handle };
      socket.send(JSON.stringify(msg));
    });

    socket.addEventListener("message", (e: MessageEvent) => {
      const msg: ServerMessage = JSON.parse(e.data as string);
      if (msg.type === "leaderboard") {
        setLeaderboard(msg.channels.map((c) => ({
          id: c.id,
          handle: c.handle,
          followers: c.followers,
          rank: c.rank,
        })));
      }
    });

    return () => socket.close();
  }, [topic, handle, setLeaderboard]);

  // Broadcast score on a throttled interval
  useEffect(() => {
    if (!socketRef.current || !topic) return;
    const id = setInterval(() => {
      const msg: ClientMessage = { type: "score", followers: Math.floor(followers), likes: Math.floor(likes) };
      socketRef.current?.send(JSON.stringify(msg));
    }, 2000);
    return () => clearInterval(id);
  }, [topic, followers, likes]);
}
