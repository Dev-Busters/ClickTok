export const RESET_PENDING_KEY = "clicktok-reset-pending";

export type ResetMarkerStorage = Pick<Storage, "getItem" | "removeItem">;

export async function flushPendingReset(
  storage: ResetMarkerStorage,
  pushFreshSave: () => Promise<boolean>,
): Promise<boolean> {
  if (!storage.getItem(RESET_PENDING_KEY)) return false;
  const saved = await pushFreshSave();
  if (saved) storage.removeItem(RESET_PENDING_KEY);
  return true;
}

