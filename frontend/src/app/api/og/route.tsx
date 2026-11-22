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
  const sans = "system-ui, -apple-system, Helvetica, Arial, sans-serif";
  const serif = "Georgia, 'Times New Roman', serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "56px 72px", color: "#0f172a", fontFamily: sans, background: "#f8fafc", borderTop: "12px solid #1d4ed8",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, color: "#64748b" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 14, color: "#0f172a", fontWeight: 700 }}>
            <svg width="44" height="44" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="15" fill="#1d4ed8" />
              <path d="M19 20 C32 20 30 32 43 32 M19 44 C32 44 30 32 43 32" stroke="#fff" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" fill="none" />
              <circle cx="17" cy="20" r="5.5" fill="#fff" />
              <circle cx="17" cy="44" r="5.5" fill="#fff" />
              <circle cx="46" cy="32" r="9.5" fill="#34d399" />
            </svg>
            FeederGraph
          </span>
          <span style={{ display: "flex" }}>{d ? tierLabel(d.tier) : "Tech internship hiring graph"}</span>
        </div>

        {d ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 28, color: "#64748b" }}>Who feeds into</div>
            <div style={{ display: "flex", fontFamily: serif, fontSize: d.name.length > 18 ? 84 : 108, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{d.name}</div>
            <div style={{ display: "flex", marginTop: 36, gap: 20 }}>
              {d.feeders.length ? (
                d.feeders.map((f, i) => (
                  <div
                    key={f.name}
                    style={{
                      display: "flex", flexDirection: "column", flex: 1, padding: "18px 24px",
                      border: "2px solid #e2e8f0", borderLeft: `6px solid ${accent}`, borderRadius: 14, background: "#ffffff",
                    }}
                  >
                    <span style={{ display: "flex", fontSize: 22, color: "#64748b" }}>Feeder #{i + 1}</span>
                    <span style={{ display: "flex", fontSize: 36, fontWeight: 700, marginTop: 6 }}>{f.name}</span>
                  </div>
                ))
              ) : (
                <span style={{ display: "flex", fontSize: 30, color: "#64748b" }}>No paths submitted yet</span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontFamily: serif, fontSize: 88, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            Where do tech interns actually come from?
          </div>
        )}

        <div style={{ display: "flex", alignItems: "baseline", gap: 18, fontSize: 30, color: "#64748b" }}>
          {d && (
            <>
              <span style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#047857" }}>{d.roKnown === 0 ? "—" : `${(d.ro * 100).toFixed(1)}%`}</span>
              <span style={{ display: "flex" }}>est. return offer · {d.paths} reported paths</span>
            </>
          )}
        </div>
      </div>
    ),
    SIZE,
  );
}
