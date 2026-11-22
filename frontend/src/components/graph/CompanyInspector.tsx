"use client";

import { Badge } from "@/components/ui/badge";
import type { GraphResponse } from "@/lib/types";
import { channelLabel, tierColor, tierLabel, typeLabel } from "@/lib/labels";
import { CompanyLogo } from "./CompanyLogo";

const CONF_STYLE = {
  low: "border-red-500 text-red-400",
  medium: "border-amber-500 text-amber-400",
  high: "border-emerald-500 text-emerald-400",
} as const;

export function CompanyInspector({ data }: { data: GraphResponse }) {
  const channels = Object.entries(data.channel_distribution).sort((a, b) => b[1] - a[1]);
  const color = tierColor(data.target.tier);

  return (
    <aside className="glass w-full border-x-0 border-b-0 p-4 font-mono text-xs md:w-72 md:overflow-auto md:border-y-0 md:border-r-0">
      <div className="flex items-center gap-3">
        <CompanyLogo slug={data.target.slug} domain={data.target.domain} name={data.target.name} tier={data.target.tier} className="size-10" />
        <div className="min-w-0">
          <h2 className="truncate font-sans text-lg font-bold leading-tight">{data.target.name}</h2>
          <p className="text-muted-foreground">
            {typeLabel(data.target.entity_type)} · <span style={{ color }}>{tierLabel(data.target.tier)}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-muted-foreground uppercase">
          smoothed return-offer rate{data.mode === "outbound" && " at destinations"}
        </p>
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
              <span>{channelLabel(c)}</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">
        By each {data.mode === "inbound" ? "feeder" : "destination"}&apos;s top channel, weighted by intern count.
      </p>
    </aside>
  );
}
