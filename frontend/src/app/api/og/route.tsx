import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { supabaseAnon } from "@/lib/supabase/server";
import { bayesianRoRate } from "@/lib/bayesian";
import { tierColor, tierLabel } from "@/lib/labels";

const SIZE = { width: 1200, height: 630 };

async function load(slug: string) {
  const db = supabaseAnon();
  const { data: target } = await db.from("canonical_entities").select("id,name,tier").eq("slug", slug).maybeSingle();
  if (!target) return null;
  const { data: edges } = await db
    .from("feeder_edges")
    .select("source_entity_id,weighted_score,raw_count,ro_yes_count,ro_known_total")
    .eq("target_entity_id", target.id);
  const rows = edges ?? [];
  const score = new Map<string, number>();
  for (const e of rows) score.set(e.source_entity_id, (score.get(e.source_entity_id) ?? 0) + Number(e.weighted_score));
  const top = [...score].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const { data: names } = top.length
    ? await db.from("canonical_entities").select("id,name").in("id", top.map(([id]) => id))
    : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.name as string]));
  const roKnown = rows.reduce((n, e) => n + e.ro_known_total, 0);
  return {
    name: target.name as string,
    tier: target.tier as string,
    feeders: top.map(([id, s]) => ({ name: nameOf.get(id) ?? "?", score: s })),
    paths: rows.reduce((n, e) => n + e.raw_count, 0),
    roKnown,
    ro: bayesianRoRate(
      rows.reduce((n, e) => n + e.ro_yes_count, 0),
      roKnown,
    ),
  };
}

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("company") ?? "").trim().toLowerCase();
  let d: Awaited<ReturnType<typeof load>> = null;
  if (/^[a-z0-9-]{1,80}$/.test(slug)) {
    try {
      d = await load(slug);
    } catch (e) {
      console.error("og route", e);
    }
  }
  const accent = tierColor(d?.tier ?? "standard");
  const mono = "ui-monospace, Menlo, monospace";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 64, color: "#f4f4f5", fontFamily: mono,
          background: `radial-gradient(circle at 100% 0%, ${accent}40, transparent 55%), #0b0d12`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#a1a1aa" }}>
          <span style={{ color: "#f4f4f5", fontWeight: 700 }}>FEEDERGRAPH</span>
          <span style={{ display: "flex" }}>{d ? tierLabel(d.tier).toUpperCase() : "TECH INTERNSHIP HIRING GRAPH"}</span>
        </div>

        {d ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa" }}>WHO FEEDS INTO</div>
            <div style={{ display: "flex", fontSize: d.name.length > 18 ? 76 : 96, fontWeight: 800, lineHeight: 1.05 }}>{d.name}</div>
            <div style={{ display: "flex", marginTop: 36, gap: 20 }}>
              {d.feeders.length ? (
                d.feeders.map((f, i) => (
                  <div
                    key={f.name}
                    style={{
                      display: "flex", flexDirection: "column", flex: 1, padding: "18px 24px",
                      border: `2px solid ${accent}88`, borderRadius: 16, background: "#ffffff0d",
                    }}
                  >
                    <span style={{ display: "flex", fontSize: 20, color: "#a1a1aa" }}>#{i + 1} FEEDER</span>
                    <span style={{ display: "flex", fontSize: 34, fontWeight: 700, marginTop: 6 }}>{f.name}</span>
                  </div>
                ))
              ) : (
                <span style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>No paths submitted yet</span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>
            Where do tech interns actually come from?
          </div>
        )}

        <div style={{ display: "flex", alignItems: "baseline", gap: 18, fontSize: 28, color: "#a1a1aa" }}>
          {d && (
            <>
              <span style={{ display: "flex", fontSize: 72, fontWeight: 800, color: accent }}>{d.roKnown === 0 ? "—" : `${(d.ro * 100).toFixed(1)}%`}</span>
              <span style={{ display: "flex" }}>smoothed return-offer rate · {d.paths} paths</span>
            </>
          )}
        </div>
      </div>
    ),
    SIZE,
  );
}
