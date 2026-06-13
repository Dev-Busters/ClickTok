import { useEffect, useRef } from "react";
import PartySocket from "partysocket";
import { useGameStore } from "../store";
import { STARVED_ALGORITHM } from "../store/slices/socialSlice";
import { generateTrends } from "../features/social/trends";
import { lobbySendRef } from "../party/socketRefs";
import type { LobbyClientMessage, LobbyServerMessage, LiveStreamSummary } from "../party/types";
import { supabase } from "../lib/supabase";

const PARTY_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";
const LIVE_UPDATE_MS = 3000;
const SCORE_UPDATE_MS = 2000;
const WATCH_FEED_MS = 5000;
// Local fallback cadence when the lobby socket is down (was the 3.1 client timer).
const TREND_ROTATION_FALLBACK_SEC = 90;

function computeCreatorLevel(totalFollowers: number): number {
  return 1 + Math.floor(Math.log10(Math.max(1, totalFollowers)));
}

export function useLobby() {
  const socketRef = useRef<PartySocket | null>(null);
  const streamIdRef = useRef<string | null>(null);

  const handle = useGameStore(s => s.handle);
  const setLiveDirectory = useGameStore(s => s.setLiveDirectory);
  const setTrends = useGameStore(s => s.setTrends);
  const setLeaderboard = useGameStore(s => s.setLeaderboard);
  const setTrendLeaderboard = useGameStore(s => s.setTrendLeaderboard);
  const setAlgorithm = useGameStore(s => s.setAlgorithm);
  const phase = useGameStore(s => s.phase);
  const params = useGameStore(s => s.params);
  const streamId = useGameStore(s => s.streamId);
  const spectating = useGameStore(s => s.spectating);
  const activeTrend = useGameStore(s => s.activeTrend);

  // Connect to the global lobby room once the player has a handle.
  useEffect(() => {
    if (!handle) return;

    // 4.5c-2: append Supabase access_token to the connection URL so the server
    // can verify identity and bind a durable leaderboard key.
    const socket = new PartySocket({
      host: PARTY_HOST,
      room: "lobby",
      party: "lobby",
      query: async () => {
        if (!supabase) return {};
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { token } : {};
      },
    });
    socketRef.current = socket;
    lobbySendRef.current = (msg) => socketRef.current?.send(JSON.stringify(msg));

    // 4.4: while the lobby socket is down, fall back to a local trend
    // rotation + STARVED tier so solo play is unaffected (DoD).
    setAlgorithm(STARVED_ALGORITHM);
    let fallbackId: ReturnType<typeof setInterval> | null = setInterval(
      () => setTrends(generateTrends()),
      TREND_ROTATION_FALLBACK_SEC * 1000,
    );
    const stopFallback = () => {
      if (fallbackId !== null) {
        clearInterval(fallbackId);
        fallbackId = null;
      }
    };
    const startFallback = () => {
      setAlgorithm(STARVED_ALGORITHM);
      if (fallbackId === null) {
        fallbackId = setInterval(() => setTrends(generateTrends()), TREND_ROTATION_FALLBACK_SEC * 1000);
      }
    };

    socket.addEventListener("open", () => {
      stopFallback();
      const { wallet, cloudUserId, activeTrend: trend } = useGameStore.getState();
      const msg: LobbyClientMessage = {
        type: "hello",
        handle,
        creatorLevel: computeCreatorLevel(wallet.totalFollowers),
        userId: cloudUserId ?? undefined,
      };
      socket.send(JSON.stringify(msg));
      if (trend) {
        socket.send(JSON.stringify({ type: "getTrendLeaderboard", trend } satisfies LobbyClientMessage));
      }
      // 7.5b: replace the local NPC fallback deck with the server's feed pool.
      socket.send(JSON.stringify({ type: "getFeed" } satisfies LobbyClientMessage));
    });

    socket.addEventListener("close", startFallback);

    socket.addEventListener("message", (e: MessageEvent) => {
      const msg: LobbyServerMessage = JSON.parse(e.data as string);
      switch (msg.type) {
        case "directory":
          setLiveDirectory(msg.streams);
          break;
        case "trends":
          setTrends(msg.trends);
          break;
        case "leaderboard":
          setLeaderboard(msg.channels.map(c => ({ id: c.id, handle: c.handle, followers: c.followers, rank: c.rank })));
          break;
        case "trendLeaderboard":
          // Ignore stale responses for a trend the player has since switched away from.
          if (msg.trend === useGameStore.getState().activeTrend) {
            setTrendLeaderboard(msg.channels.map(c => ({ id: c.id, handle: c.handle, followers: c.followers, rank: c.rank })));
          }
          break;
        case "algorithm":
          setAlgorithm(msg.state);
          break;
        case "feed": {
          // 7.5b: server feed replaces the 7.5a local NPC fallback deck.
          if (msg.cards.length === 0) break;
          const { setDeck, deckIndex } = useGameStore.getState();
          setDeck(msg.cards);
          if (deckIndex >= msg.cards.length) {
            useGameStore.setState({ deckIndex: 0 });
          }
          break;
        }
        case "videoPosted": {
          // 7.5b: prepend newly posted videos so the deck stays freshest-first;
          // bump deckIndex to keep the currently-viewed card in place.
          const { deck, deckIndex } = useGameStore.getState();
          if (deck.some(c => c.videoId === msg.card.videoId)) break;
          useGameStore.setState({
            deck: [msg.card, ...deck],
            deckIndex: deckIndex + 1,
          });
          break;
        }
        case "royalty": {
          // 7.6: poster receives likes from a viewer's engage batch.
          useGameStore.getState().applyRoyalty(msg.taps, msg.fromHandle, msg.videoId);
          break;
        }
      }
    });

    // 4.4: leaderboard scoring moves into the lobby (was useTrendRoom's score broadcast).
    // 4.5b: include userId (durable identity) + activeTrend (per-trend leaderboard).
    const scoreInterval = setInterval(() => {
      const { wallet, cloudUserId, activeTrend: trend } = useGameStore.getState();
      socketRef.current?.send(JSON.stringify({
        type: "score",
        followers: Math.floor(wallet.followers),
        likes: Math.floor(wallet.likes),
        userId: cloudUserId ?? undefined,
        trend: trend ?? undefined,
      } satisfies LobbyClientMessage));
    }, SCORE_UPDATE_MS);

    return () => {
      stopFallback();
      clearInterval(scoreInterval);
      socket.close();
      socketRef.current = null;
      lobbySendRef.current = null;
    };
  }, [handle, setLiveDirectory, setTrends, setLeaderboard, setTrendLeaderboard, setAlgorithm]);

  // 4.5b: re-request the per-trend leaderboard whenever the player switches trends.
  useEffect(() => {
    if (!activeTrend) return;
    socketRef.current?.send(JSON.stringify({ type: "getTrendLeaderboard", trend: activeTrend } satisfies LobbyClientMessage));
  }, [activeTrend]);

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
    // 04 §12.5: going live feeds The Algorithm meter.
    socket.send(JSON.stringify({ type: "feedAlgorithm", kind: "streamStarted", amount: 1 } satisfies LobbyClientMessage));

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

  // 04 §12.5: while spectating, feed real watch-seconds into The Algorithm.
  useEffect(() => {
    if (!spectating) return;
    const intervalId = setInterval(() => {
      socketRef.current?.send(JSON.stringify({
        type: "feedAlgorithm",
        kind: "watchSec",
        amount: WATCH_FEED_MS / 1000,
      } satisfies LobbyClientMessage));
    }, WATCH_FEED_MS);
    return () => clearInterval(intervalId);
  }, [spectating]);
}
