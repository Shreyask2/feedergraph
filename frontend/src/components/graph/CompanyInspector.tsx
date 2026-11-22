"use client";

import { Badge } from "@/components/ui/badge";
import type { GraphResponse } from "@/lib/types";

const CONF_STYLE = {
  low: "border-red-500 text-red-400",
  medium: "border-amber-500 text-amber-400",
  high: "border-emerald-500 text-emerald-400",
} as const;

export function CompanyInspector({ data }: { data: GraphResponse }) {
  const channels = Object.entries(data.channel_distribution).sort((a, b) => b[1] - a[1]);

  return (
    <aside className="w-full border-border bg-card p-4 font-mono text-xs md:w-72 md:border-l">
      <h2 className="font-sans text-lg font-bold">{data.target.name}</h2>
      <p className="text-muted-foreground uppercase">
        {data.target.entity_type} · {data.target.tier}
      </p>

      <div className="mt-4 border border-border p-3">
        <p className="text-muted-foreground uppercase">smoothed return-offer rate</p>
        <p className="text-3xl font-bold">{(data.overall_ro_rate * 100).toFixed(1)}%</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className={CONF_STYLE[data.confidence_level]}>
            {data.confidence_level} confidence
          </Badge>
          <span className="text-muted-foreground">n={data.ro_known_total}</span>
        </div>
      </div>

      <h3 className="mt-4 mb-2 text-muted-foreground uppercase">channel breakdown</h3>
      {channels.length === 0 && <p className="text-muted-foreground">No data.</p>}
      <ul className="space-y-2">
        {channels.map(([c, pct]) => (
          <li key={c}>
            <div className="flex justify-between">
              <span>{c}</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">By each feeder&apos;s top channel, weighted by intern count.</p>
    </aside>
  );
}
