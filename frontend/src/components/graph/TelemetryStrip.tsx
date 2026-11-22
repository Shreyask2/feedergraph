import type { GraphResponse } from "@/lib/types";

/** Compact 4-stat KPI header above the canvas. Numbers are over the currently filtered edges. */
export function telemetry(data: GraphResponse) {
  const paths = data.feeders.reduce((n, f) => n + f.raw_count, 0);
  const verified = data.feeders.reduce((n, f) => n + f.verified_count, 0);
  return {
    paths,
    top: data.feeders[0]?.entity.name ?? "—",
    verifiedPct: paths ? (verified / paths) * 100 : 0,
    ro: data.overall_ro_rate * 100,
  };
}

export function TelemetryStrip({ data }: { data: GraphResponse }) {
  const t = telemetry(data);
  const inbound = data.mode === "inbound";
  const stats = [
    { k: "Total Paths", v: t.paths.toLocaleString(), sub: `${data.feeders.length} ${inbound ? "feeders" : "destinations"}` },
    { k: inbound ? "Top Feeder" : "Top Destination", v: t.top, sub: data.feeders[0] ? `score ${data.feeders[0].weighted_score.toFixed(1)} · ${data.feeders[0].raw_count} interns` : "no data" },
    { k: "Verified Share", v: `${t.verifiedPct.toFixed(0)}%`, sub: "GitHub-verified" },
    { k: "Smoothed RO Rate", v: `${t.ro.toFixed(1)}%`, sub: `${data.confidence_level} conf · n=${data.ro_known_total}` },
  ];
  return (
    <dl className="grid grid-cols-2 border-b border-border font-mono md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.k}
          className={`min-w-0 px-4 py-2 ${i % 2 ? "border-l border-border" : ""} ${i > 1 ? "border-t border-border md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
        >
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.k}</dt>
          <dd className="truncate text-lg font-bold leading-tight tabular-nums">{s.v}</dd>
          <dd className="truncate text-[10px] text-muted-foreground">{s.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
