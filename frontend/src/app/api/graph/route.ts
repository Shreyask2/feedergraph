import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnon } from "@/lib/supabase/server";
import { bayesianRoRate, confidenceLevel } from "@/lib/bayesian";
import { ROLES, type EntityLite, type Feeder, type GraphResponse, type Mode, type SecondHop } from "@/lib/types";

interface EdgeRow {
  source_entity_id: string;
  target_entity_id: string;
  role_category: string;
  raw_count: number;
  verified_count: number;
  weighted_score: number;
  ro_yes_count: number;
  ro_known_total: number;
  top_channel: string | null;
}

const COLS = "id,name,slug,entity_type,tier,domain";
const EDGE_COLS =
  "source_entity_id,target_entity_id,role_category,raw_count,verified_count,weighted_score,ro_yes_count,ro_known_total,top_channel";
/** 1st-degree nodes that get a 2nd hop; matches what HiringGraph renders. */
const HOP_LIMIT = 12;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = (p.get("company") ?? "").trim().toLowerCase();
  const role = p.get("role") ?? "";
  const verifiedOnly = p.get("verifiedOnly") === "true";
  const mode: Mode = p.get("mode") === "outbound" ? "outbound" : "inbound";
  // inbound: edges INTO the company, neighbour = source. outbound: edges FROM it, neighbour = target.
  const [anchorCol, otherCol] =
    mode === "inbound" ? (["target_entity_id", "source_entity_id"] as const) : (["source_entity_id", "target_entity_id"] as const);

  if (role && !(ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  if (!slug) return NextResponse.json({ error: "company required" }, { status: 400 });

  try {
    const db = supabaseAnon();
    const { data: entities, error: eErr } = await db
      .from("canonical_entities")
      .select(COLS)
      .order("name");
    if (eErr) throw eErr;
    const all = (entities ?? []) as EntityLite[];
    const target = all.find((e) => e.slug === slug);
    if (!target) return NextResponse.json({ error: "company not found" }, { status: 404 });

    const edgesWhere = (ids: string[]) => {
      let q = db.from("feeder_edges").select(EDGE_COLS).in(anchorCol, ids);
      if (role) q = q.eq("role_category", role);
      if (verifiedOnly) q = q.gt("verified_count", 0);
      return q;
    };
    const { data: rows, error: rErr } = await edgesWhere([target.id]);
    if (rErr) throw rErr;

    // Collapse per-role rows into one feeder per source entity.
    const byId = new Map(all.map((e) => [e.id, e]));
    const agg = new Map<string, Feeder & { _best: number }>();
    for (const r of (rows ?? []) as EdgeRow[]) {
      const entity = byId.get(r[otherCol]);
      if (!entity) continue;
      const f =
        agg.get(entity.id) ??
        ({
          entity, raw_count: 0, verified_count: 0, weighted_score: 0, ro_yes_count: 0,
          ro_known_total: 0, bayesian_ro_rate: 0, confidence_level: "low", top_channel: null, _best: -1,
        } as Feeder & { _best: number });
      f.raw_count += r.raw_count;
      f.verified_count += r.verified_count;
      f.weighted_score += Number(r.weighted_score);
      f.ro_yes_count += r.ro_yes_count;
      f.ro_known_total += r.ro_known_total;
      if (r.raw_count > f._best) { f._best = r.raw_count; f.top_channel = r.top_channel; }
      agg.set(entity.id, f);
    }

    const feeders: Feeder[] = [...agg.values()]
      .map(({ _best, ...f }) => ({
        ...f,
        bayesian_ro_rate: bayesianRoRate(f.ro_yes_count, f.ro_known_total),
        confidence_level: confidenceLevel(f.ro_known_total),
      }))
      .sort((a, b) => b.weighted_score - a.weighted_score);

    // 2nd hop: for each shown 1st-degree node, its single strongest neighbour one step further out.
    const hop1 = feeders.slice(0, HOP_LIMIT).map((f) => f.entity.id);
    const second_hop: SecondHop[] = [];
    const hop1Set = new Set(hop1);
    if (hop1.length) {
      const { data: hopRows, error: hErr } = await edgesWhere(hop1);
      if (hErr) throw hErr;
      const pair = new Map<string, { via: string; other: string; raw: number; score: number }>();
      for (const r of (hopRows ?? []) as EdgeRow[]) {
        const via = r[anchorCol];
        const other = r[otherCol];
        // skip loops back to the focus company or into the 1st-degree column (already drawn)
        if (other === target.id || hop1Set.has(other)) continue;
        const k = `${via}|${other}`;
        const e = pair.get(k) ?? { via, other, raw: 0, score: 0 };
        e.raw += r.raw_count;
        e.score += Number(r.weighted_score);
        pair.set(k, e);
      }
      const best = new Map<string, { via: string; other: string; raw: number; score: number }>();
      for (const e of pair.values()) {
        const cur = best.get(e.via);
        if (!cur || e.score > cur.score) best.set(e.via, e);
      }
      for (const via of hop1) {
        const e = best.get(via);
        const entity = e && byId.get(e.other);
        if (e && entity) second_hop.push({ via, entity, raw_count: e.raw, weighted_score: e.score });
      }
    }

    const { data: allEdges, error: tErr } = await db.from("feeder_edges").select("raw_count");
    if (tErr) throw tErr;
    const totalPaths = (allEdges ?? []).reduce((n, r) => n + (r.raw_count as number), 0);

    const yes = feeders.reduce((s, f) => s + f.ro_yes_count, 0);
    const known = feeders.reduce((s, f) => s + f.ro_known_total, 0);
    const total = feeders.reduce((s, f) => s + f.raw_count, 0);
    const channel_distribution: Record<string, number> = {};
    for (const f of feeders) {
      if (!f.top_channel) continue;
      channel_distribution[f.top_channel] =
        (channel_distribution[f.top_channel] ?? 0) + (total ? (f.raw_count / total) * 100 : 0);
    }

    const body: GraphResponse = {
      mode,
      target,
      overall_ro_rate: bayesianRoRate(yes, known),
      ro_known_total: known,
      confidence_level: confidenceLevel(known),
      channel_distribution,
      feeders,
      second_hop,
      entities: all,
      totals: { entities: all.length, paths: totalPaths },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("graph route", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
