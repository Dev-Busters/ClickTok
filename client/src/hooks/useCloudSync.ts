import { useEffect } from "react";
import { useGameStore, createFreshPersistedState } from "../store";
import { supabase } from "../lib/supabase";
import { toPersistedState } from "../store/slices/meta";
import { pullCloudSave, pushCloudSave } from "../features/cloud/sync";
import type { User } from "@supabase/supabase-js";
import { flushPendingReset, RESET_PENDING_KEY } from "../features/cloud/reset";

const PUSH_INTERVAL_MS = 30_000;
// Tracks "the last cloud version this device has synced" — separate from the
// localStorage save itself (`clicktok-save`) so last-write-wins comparisons
// survive even though `toPersistedState`'s `lastSeenAt` is a session-start
// timestamp, not a save timestamp.
const SYNCED_AT_KEY = "clicktok-cloud-synced-at";

function getSyncedAt(): number {
  return Number(localStorage.getItem(SYNCED_AT_KEY) ?? 0);
}
function setSyncedAt(ms: number) {
  localStorage.setItem(SYNCED_AT_KEY, String(ms));
}

// Durable across reloads and mobile tab suspension. It is cleared only after
// the fresh save has replaced the cloud row, so an old cloud save can never
// win the reset race on a later mount.
function applyAuthUser(user: User | null | undefined) {
  useGameStore.getState().setCloudAuth({
    userId: user?.id ?? null,
    isAnonymous: user?.is_anonymous ?? true,
    email: user?.email ?? null,
  });
}

// Playtesting: wipe local + cloud save so the next load behaves like a brand
// new player, while staying signed in as the same account. Deleting the cloud
// row directly isn't reliable (RLS only grants this user select/upsert), so
// instead we mark a reset as pending, clear local state, and let the next
// init() overwrite the cloud row with the fresh default state via upsert.
//
// We also overwrite the *live* store with fresh defaults before reloading
// (rather than only clearing storage). The rAF-driven game loop keeps calling
// tick() -> set() right up until the page actually unloads, and persist
// writes to localStorage synchronously on every set() — if we only cleared
// storage, one of those trailing ticks could re-write the old (full-resource)
// state back into `clicktok-save` before the reload takes effect. Loading
// fresh defaults into the live store first means any such trailing tick just
// re-persists near-zero values instead.
export function resetProgress(): void {
  localStorage.setItem(RESET_PENDING_KEY, "1");
  useGameStore.getState().loadPersistedState(createFreshPersistedState());
  localStorage.removeItem(SYNCED_AT_KEY);
  window.location.reload();
}

// 4.5: anonymous-upgradeable Supabase auth + cloud save sync at the
// `meta.ts` partialize boundary. No-op when Supabase env vars aren't
// configured (`supabase` is null) — the game stays fully local-only.
export function useCloudSync() {
  useEffect(() => {
    if (!supabase) {
      useGameStore.getState().setCloudSyncStatus("offline");
      return;
    }
    const client = supabase;
    let cancelled = false;

    const push = async (): Promise<boolean> => {
      const { cloudUserId, handle } = useGameStore.getState();
      if (!cloudUserId) return false;
      try {
        const updatedAtMs = await pushCloudSave(cloudUserId, handle, toPersistedState(useGameStore.getState()));
        setSyncedAt(updatedAtMs);
        if (!cancelled) useGameStore.getState().setCloudSyncStatus("synced");
        return true;
      } catch {
        if (!cancelled) useGameStore.getState().setCloudSyncStatus("error");
        return false;
      }
    };

    const init = async () => {
      useGameStore.getState().setCloudSyncStatus("signing-in");

      const { data: { session } } = await client.auth.getSession();
      let user = session?.user ?? null;
      if (!user) {
        const { data, error } = await client.auth.signInAnonymously();
        if (error || cancelled) {
          if (!cancelled) useGameStore.getState().setCloudSyncStatus("error");
          return;
        }
        user = data.user;
      }
      if (cancelled || !user) return;
      applyAuthUser(user);

      useGameStore.getState().setCloudSyncStatus("syncing");

      if (await flushPendingReset(localStorage, push)) return;

      const cloud = await pullCloudSave(user.id);
      if (cancelled) return;

      if (cloud && cloud.updatedAtMs > getSyncedAt()) {
        useGameStore.getState().loadPersistedState(cloud.data);
        setSyncedAt(cloud.updatedAtMs);
        if (!cancelled) useGameStore.getState().setCloudSyncStatus("synced");
      } else {
        push();
      }
    };

    init();

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      applyAuthUser(session?.user);
    });

    const interval = setInterval(push, PUSH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") push();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
