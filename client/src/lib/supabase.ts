import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cloud sync (4.5) is optional — undefined when env vars aren't configured,
// so the game stays fully playable offline/local-only.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
