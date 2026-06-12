import { useEffect, useRef } from "react";
import PartySocket from "partysocket";
import { useGameStore } from "../store";
import type {
  LiveStreamSummary,
  QuickChatId,
  RunSnapshot,
  SpectatorEvent,
  StreamClientMessage,
  StreamPoll,
  StreamServerMessage,
} from "../party/types";
import { BALANCE } from "../features/economy/balance";
import type { RunEvent } from "../features/livestream/types";
import { spectatorSocketRef, streamerSendRef } from "../party/socketRefs";
import { clamp } from "../lib/math";
import { supabase } from "../lib/supabase";

const PARTY_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";

function computeCreatorLevel(totalFollowers: number): number {
  return 1 + Math.floor(Math.log10(Math.max(1, totalFollowers)));
}

const QUICK_CHAT_TEXT: Record<QuickChatId, string> = {
  w: "W",
  fire: "🔥🔥🔥",
  icon: "an icon",
  ratio: "ratio",
  cooked: "cooked",
  real_one: "a real one",
};

// ——— Streamer side ———
// Connects when a streamId is generated (startRun); keeps the socket alive
// through the `results` phase so the shoutout button can fire; closes when
// streamId is cleared (returnToChannel).
export function useStreamerRoom() {
  const streamId = useGameStore(s => s.streamId);
  const handle = useGameStore(s => s.handle);

  const sentEventIdsRef = useRef<Set<string>>(new Set());
  const sentPollIdsRef = useRef<Set<string>>(new Set());
  const endSentRef = useRef(false);
  // Sliding window: { t: ms epoch, taps: count }[] — for realTapsLast5s
  const tapWindowRef = useRef<{ t: number; taps: number }[]>([]);

  useEffect(() => {
    if (!streamId || !handle) return;

    // 4.5c-2: append Supabase access_token so the stream room can verify identity.
    const socket = new PartySocket({
      host: PARTY_HOST,
      room: streamId,
      party: "stream",
      query: async () => {
        if (!supabase) return {};
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { token } : {};
      },
    });
    streamerSendRef.current = (msg: StreamClientMessage) => socket.send(JSON.stringify(msg));
    sentEventIdsRef.current = new Set();
    sentPollIdsRef.current = new Set();
    endSentRef.current = false;
    tapWindowRef.current = [];

    socket.addEventListener("open", () => {
      const s = useGameStore.getState();
      if (!s.params) return;
      const summary: LiveStreamSummary = {
        streamId,
        handle: s.handle ?? "",
        creatorLevel: computeCreatorLevel(s.wallet.totalFollowers),
        topic: s.params.topic,
        viewers: Math.round(s.viewers),
        realViewers: 0,
        hype: Math.round(s.hype),
        startedAt: Date.now(),
      };
      socket.send(JSON.stringify({ type: "open", summary } satisfies StreamClientMessage));
    });

    socket.addEventListener("message", (e: MessageEvent) => {
      const msg: StreamServerMessage = JSON.parse(e.data as string);
      const s = useGameStore.getState();

      switch (msg.type) {
        case "viewerCount":
          s.applyRealViewerCount(msg.realViewers);
          break;

        case "realHype": {
          // Update sliding window for hype-decay relief (04 §12.3).
          const now = Date.now();
          tapWindowRef.current = tapWindowRef.current
            .filter(t => now - t.t < 5000)
            .concat({ t: now, taps: msg.taps });
          const realTapsLast5s = tapWindowRef.current.reduce((acc, t) => acc + t.taps, 0);
          useGameStore.setState({ realTapsLast5s });

          // Inject a real comment event so the tap appears in the feed with a glow.
          const hypeEvent: RunEvent = {
            id: crypto.randomUUID(),
            type: "comment",
            spawnedAt: s.clockSec,
            expiresAt: s.clockSec + 5,
            resolved: false,
            text: `${"❤️".repeat(Math.min(msg.taps, 5))}`,
            real: true,
            fromHandle: msg.fromHandle,
          };
          s.injectRealEvent(hypeEvent);

          // Apply direct hype gain (04 §12.1: +tapHypeAdd per tap, clamped).
          const hypeGain = msg.taps * BALANCE.social.tapHypeAdd;
          useGameStore.setState(state => ({ hype: clamp(state.hype + hypeGain, 0, 100) }));
          break;
        }

        case "realChat": {
          const text = QUICK_CHAT_TEXT[msg.preset as QuickChatId] ?? msg.preset;
          const chatEvent: RunEvent = {
            id: crypto.randomUUID(),
            type: "comment",
            spawnedAt: s.clockSec,
            expiresAt: s.clockSec + 6,
            resolved: false,
            text,
            real: true,
            fromHandle: msg.fromHandle,
          };
          s.injectRealEvent(chatEvent);
          break;
        }

        case "realGift": {
          // Inject a real gift event (glow-rendered) into the feed.
          const giftEvent: RunEvent = {
            id: crypto.randomUUID(),
            type: "gift",
            spawnedAt: s.clockSec,
            expiresAt: s.clockSec + 6,
            resolved: false,
            giftTier: msg.tier,
            real: true,
            fromHandle: msg.fromHandle,
          };
          s.injectRealEvent(giftEvent);

          // Grant coins/diamonds + hype spike to the streamer (04 §12.2).
          const coins = BALANCE.run.giftCoinValue[msg.tier];
          const diamonds = BALANCE.run.giftDiamondValue[msg.tier];
          const hypeSpike = BALANCE.social.giftHypeSpike[msg.tier];
          useGameStore.setState(state => ({
            collected: {
              ...state.collected,
              coins: state.collected.coins + coins,
              diamonds: state.collected.diamonds + diamonds,
            },
            hype: clamp(state.hype + hypeSpike, 0, 100),
            // Log for post-run shoutout (top gifter by coin value).
            realGiftLog: [
              ...state.realGiftLog,
              { handle: msg.fromHandle, coins, atRunSec: msg.atRunSec },
            ],
          }));
          break;
        }

        case "voteTally":
          // Store the tally so resolveChoice can apply the vote boost.
          useGameStore.setState(state => ({
            pendingVoteTally: { ...state.pendingVoteTally, [msg.pollId]: msg.tally },
          }));
          break;
      }
    });

    const snapshotMs = Math.round(1000 / BALANCE.social.snapshotPerSec);
    const intervalId = setInterval(() => {
      const s = useGameStore.getState();

      // When the run ends, send `end` once (stays alive through results for shoutout).
      if (s.phase === "results" && !endSentRef.current) {
        endSentRef.current = true;
        socket.send(JSON.stringify({
          type: "end",
          grade: s.lastResult?.grade ?? "FLOP",
          peakViewers: Math.round(s.peakViewers),
        } satisfies StreamClientMessage));
        return;
      }
      if (s.phase !== "live" || !s.params || !s.streamId) return;

      // Delta: only send events not yet sent in a previous snapshot.
      const allEvents = s.events;
      const newRaw = allEvents.filter(e => !sentEventIdsRef.current.has(e.id));
      for (const e of newRaw) sentEventIdsRef.current.add(e.id);
      // Prune IDs of events that have since expired to keep the set bounded.
      const liveIds = new Set(allEvents.map(e => e.id));
      for (const id of sentEventIdsRef.current) {
        if (!liveIds.has(id)) sentEventIdsRef.current.delete(id);
      }

      const newEvents: SpectatorEvent[] = newRaw.map(e => ({
        id: e.id,
        type: e.type,
        text: e.text,
        giftTier: e.giftTier,
        real: e.real,
        fromHandle: e.fromHandle,
      }));

      const displayViewers = Math.round(
        s.viewers + BALANCE.social.realViewerWeight * s.realViewers
      );

      const snap: RunSnapshot = {
        streamId: s.streamId,
        handle: s.handle ?? "",
        topic: s.params.topic,
        clockSec: s.clockSec,
        durationSec: s.params.durationSec,
        viewers: displayViewers,
        hype: Math.round(s.hype),
        modifiers: s.params.modifiers.map(m => m.id),
        newEvents,
      };
      socket.send(JSON.stringify({ type: "snapshot", snap } satisfies StreamClientMessage));

      // Detect new choice events and send pollOpen for each.
      for (const e of allEvents) {
        if (e.choices && e.choices.length > 0 && !sentPollIdsRef.current.has(e.id)) {
          sentPollIdsRef.current.add(e.id);
          const poll: StreamPoll = {
            pollId: e.id,
            prompt: e.text ?? "What should I do?",
            options: e.choices.map(c => c.label),
            closesAtSec: e.expiresAt,
          };
          socket.send(JSON.stringify({ type: "pollOpen", poll } satisfies StreamClientMessage));
        }
      }

      // Detect resolved choices and send pollClose.
      if (s.lastChoiceResolution) {
        socket.send(JSON.stringify({
          type: "pollClose",
          pollId: s.lastChoiceResolution.pollId,
          winningIndex: s.lastChoiceResolution.winningIndex,
        } satisfies StreamClientMessage));
        useGameStore.setState({ lastChoiceResolution: null });
      }
    }, snapshotMs);

    return () => {
      clearInterval(intervalId);
      streamerSendRef.current = null;
      if (!endSentRef.current) {
        const s = useGameStore.getState();
        socket.send(JSON.stringify({
          type: "end",
          grade: s.lastResult?.grade ?? "FLOP",
          peakViewers: Math.round(s.peakViewers),
        } satisfies StreamClientMessage));
      }
      socket.close();
    };
  }, [streamId, handle]);
}

// ——— Spectator side ———
// Connects to the watched stream room; sends `watch`; applies incoming
// snapshots; handles real-time interactions; calls `leaveStream(grade)` on end.
export function useSpectatorRoom() {
  const spectating = useGameStore(s => s.spectating);
  const handle = useGameStore(s => s.handle);
  const applySnapshot = useGameStore(s => s.applySnapshot);
  const leaveStream = useGameStore(s => s.leaveStream);
  const applyVoteResult = useGameStore(s => s.applyVoteResult);
  const applyShoutout = useGameStore(s => s.applyShoutout);

  useEffect(() => {
    if (!spectating || !handle) return;

    // 4.5c-2: append Supabase access_token so the stream room can verify identity.
    const socket = new PartySocket({
      host: PARTY_HOST,
      room: spectating.streamId,
      party: "stream",
      query: async () => {
        if (!supabase) return {};
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { token } : {};
      },
    });
    spectatorSocketRef.current = socket;

    socket.addEventListener("open", () => {
      const { wallet } = useGameStore.getState();
      socket.send(
        JSON.stringify({
          type: "watch",
          handle,
          creatorLevel: computeCreatorLevel(wallet.totalFollowers),
        } satisfies StreamClientMessage)
      );
    });

    socket.addEventListener("message", (e: MessageEvent) => {
      const msg: StreamServerMessage = JSON.parse(e.data as string);

      switch (msg.type) {
        case "snapshot":
          applySnapshot(msg.snap, msg.realViewers);
          break;

        case "poll":
          useGameStore.setState({ activePoll: msg.poll, currentPollTally: null });
          break;

        case "voteTally":
          // Deviation from spec (voteTally → streamer only): also sent to spectators
          // so they can display live tally bars and receive vote-win rewards.
          applyVoteResult(msg.pollId, msg.tally);
          break;

        case "shoutout": {
          const { handle: myHandle } = useGameStore.getState();
          if (msg.handle === myHandle) {
            applyShoutout(msg.handle, msg.followers);
          }
          break;
        }

        case "ended":
          spectatorSocketRef.current = null;
          socket.close();
          leaveStream(msg.grade);
          break;
      }
    });

    return () => {
      if (spectatorSocketRef.current === socket) {
        spectatorSocketRef.current = null;
      }
      socket.close();
      // Note: leaveStream() is NOT called here. If the user clicked LEAVE, the
      // UI already called leaveStream() (setting spectating→null, triggering
      // this cleanup). If ended arrived, we already called leaveStream above.
    };
  }, [spectating, handle, applySnapshot, leaveStream, applyVoteResult, applyShoutout]);
}
