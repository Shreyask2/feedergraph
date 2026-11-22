import { createClient } from "@supabase/supabase-js";

// Anon key only: RLS allows public SELECT on canonical_entities and feeder_edges.
export function supabaseAnon() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
