import type { StateCreator } from "zustand";
import type { FullState } from "../index";

// Stub: tab/sheet state lands in task 0.6 alongside navigation/tabs.ts.
export type UiSlice = Record<never, never>;

export const createUiSlice: StateCreator<FullState, [], [], UiSlice> = () => ({});
