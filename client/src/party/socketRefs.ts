// Module-level socket refs so spectateSlice actions and other hooks can
// send to the stream room without needing to thread the socket through props.
// Set/cleared by useStreamerRoom and useSpectatorRoom in hooks/useStreamRoom.ts.

import type PartySocket from "partysocket";
import type { StreamClientMessage } from "./types";

export const spectatorSocketRef = { current: null as InstanceType<typeof PartySocket> | null };
export const streamerSendRef = { current: null as ((msg: StreamClientMessage) => void) | null };
