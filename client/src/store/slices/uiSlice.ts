import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { Tab } from "../../navigation/tabs";

export type UiSlice = {
  activeTab: Tab;
  openSheet: "create" | "welcomeBack" | "runResults" | null;
  setTab: (t: Tab) => void;
  setSheet: (s: UiSlice["openSheet"]) => void;
};

export const createUiSlice: StateCreator<FullState, [], [], UiSlice> = (set) => ({
  activeTab: "home",
  openSheet: null,

  setTab: (t) => set({ activeTab: t }),
  setSheet: (s) => set({ openSheet: s }),
});
