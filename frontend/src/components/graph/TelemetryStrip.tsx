import type { GraphResponse } from "@/lib/types";
import { confidenceWord, reports } from "@/lib/labels";

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
  const top = data.feeders[0];
  const stats = [
    { k: "Total paths", v: t.paths.toLocaleString(), sub: `${data.feeders.length} ${inbound ? (data.feeders.length === 1 ? "feeder company" : "feeder companies") : data.feeders.length === 1 ? "destination" : "destinations"}` },
    { k: inbound ? "Top feeder" : "Top destination", v: t.top, sub: top ? `${top.raw_count} intern${top.raw_count === 1 ? "" : "s"} · score ${top.weighted_score.toFixed(1)}` : "No data yet" },
    { k: "Verified share", v: `${t.verifiedPct.toFixed(0)}%`, sub: "Backed by GitHub" },
    {
      k: "Est. return offer",
      v: data.ro_known_total === 0 ? "—" : `${t.ro.toFixed(1)}%`,
      sub: data.ro_known_total === 0 ? "No reports yet" : `${reports(data.ro_known_total)} · ${confidenceWord(data.confidence_level)}`,
    },
  ];
  return (
    <dl className="grid grid-cols-2 border-b border-border bg-card md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.k}
          className={`min-w-0 px-4 py-3 ${i % 2 ? "border-l border-border" : ""} ${i > 1 ? "border-t border-border md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
        >
          <dt className="text-xs font-medium text-muted-foreground">{s.k}</dt>
          <dd className="truncate text-xl font-semibold leading-tight tracking-tight text-slate-900 tabular-nums">{s.v}</dd>
          <dd className="truncate text-xs text-slate-500">{s.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
