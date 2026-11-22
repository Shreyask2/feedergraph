import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/supabase/server";
import type { EntityLite } from "@/lib/types";

export interface Launchpad {
  entity: EntityLite;
  /** SUM(raw_count) over edges where source_entity_id = this company */
  placements: number;
  destinations: number;
}

/** Top 10 stepping-stone companies by total outbound intern placements. */
export async function GET() {
  try {
    const db = supabaseAnon();
    const [{ data: edges, error: eErr }, { data: ents, error: nErr }] = await Promise.all([
      db.from("feeder_edges").select("source_entity_id,target_entity_id,raw_count"),
      db.from("canonical_entities").select("id,name,slug,entity_type,tier,domain"),
    ]);
    if (eErr) throw eErr;
    if (nErr) throw nErr;
    const byId = new Map((ents as EntityLite[]).map((e) => [e.id, e]));
    const agg = new Map<string, { placements: number; dests: Set<string> }>();
    for (const r of edges ?? []) {
      const a = agg.get(r.source_entity_id) ?? { placements: 0, dests: new Set<string>() };
      a.placements += r.raw_count;
      a.dests.add(r.target_entity_id);
      agg.set(r.source_entity_id, a);
    }
    const launchpads: Launchpad[] = [...agg]
      .flatMap(([id, a]) => (byId.has(id) ? [{ entity: byId.get(id)!, placements: a.placements, destinations: a.dests.size }] : []))
      .sort((a, b) => b.placements - a.placements)
      .slice(0, 10);
    return NextResponse.json({ launchpads });
  } catch (e) {
    console.error("launchpads route", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
