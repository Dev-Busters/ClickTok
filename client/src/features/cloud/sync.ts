import { supabase } from "../../lib/supabase";
import type { PersistedState } from "../../store/slices/meta";

// 4.5: thin wrapper around the `saves` table (one row per auth user, RLS
// scoped to `auth.uid() = user_id`). `supabase` is null when env vars aren't
// configured — callers treat that the same as "no cloud save found".

export type CloudSave = { data: PersistedState; updatedAtMs: number };

export async function pullCloudSave(userId: string): Promise<CloudSave | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("saves")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return { data: data.data as PersistedState, updatedAtMs: Date.parse(data.updated_at) };
}

export async function pushCloudSave(userId: string, handle: string, persisted: PersistedState): Promise<number> {
  const updatedAt = new Date();
  if (!supabase) return updatedAt.getTime();
  await supabase.from("saves").upsert({
    user_id: userId,
    handle,
    data: persisted,
    save_version: persisted.version,
    updated_at: updatedAt.toISOString(),
  });
  return updatedAt.getTime();
}
