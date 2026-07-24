import { parseVideo } from "./authoring";
import type { AuthoredVideo as Video } from "./types";

const KEY = "clicktok-authored-videos";

/**
 * Authored charts live in their own localStorage key rather than the save blob: they are
 * content, not progress, and will move to Supabase when the FYP goes multiplayer. Keeping
 * them out of `PersistedState` means no SAVE_VERSION churn while the format is in flux.
 */
export function loadVideos(): Video[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown[];
    if (!Array.isArray(list)) return [];
    return list.flatMap(entry => {
      const video = parseVideo(JSON.stringify(entry));
      return video ? [video] : [];
    });
  } catch {
    return [];
  }
}

export function saveVideo(video: Video): Video[] {
  const list = loadVideos();
  const index = list.findIndex(item => item.id === video.id);
  const next = index >= 0
    ? list.map(item => item.id === video.id ? video : item)
    : [...list, video];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or private-mode failure: the editor still holds the draft in memory and
    // EXPORT remains available, so the author never silently loses work.
  }
  return next;
}

export function deleteVideo(id: string): Video[] {
  const next = loadVideos().filter(item => item.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* see saveVideo */ }
  return next;
}
