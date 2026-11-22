"use client";

import { Badge } from "@/components/ui/badge";
import type { GraphResponse } from "@/lib/types";
import { channelLabel, confidenceWord, reports, tierColor, tierLabel, typeLabel } from "@/lib/labels";
import { CompanyLogo } from "./CompanyLogo";

const CONF_STYLE = {
  low: "border-amber-200 bg-amber-50 text-amber-800",
  medium: "border-blue-200 bg-blue-50 text-blue-800",
  high: "border-emerald-200 bg-emerald-50 text-emerald-800",
} as const;

export function CompanyInspector({ data }: { data: GraphResponse }) {
  const channels = Object.entries(data.channel_distribution).sort((a, b) => b[1] - a[1]);
  const color = tierColor(data.target.tier);

  return (
    <aside className="w-full border-t border-border bg-card p-5 text-sm md:w-80 md:overflow-auto md:border-l md:border-t-0">
      <div className="flex items-center gap-3">
        <CompanyLogo slug={data.target.slug} domain={data.target.domain} name={data.target.name} tier={data.target.tier} className="size-11" />
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl font-semibold leading-tight tracking-tight">{data.target.name}</h2>
          <p className="text-muted-foreground">
            {typeLabel(data.target.entity_type)} · <span className="font-medium" style={{ color }}>{tierLabel(data.target.tier)}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 border-y border-border py-4">
        <p className="text-xs font-medium text-muted-foreground">
          Est. return offer rate{data.mode === "outbound" && " at destinations"}
        </p>
        {data.ro_known_total === 0 ? (
          <p className="mt-1 text-lg font-semibold text-muted-foreground">No data yet</p>
        ) : (
          <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{(data.overall_ro_rate * 100).toFixed(1)}%</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          {data.ro_known_total > 0 && <Badge variant="outline" className={`h-6 px-2.5 ${CONF_STYLE[data.confidence_level]}`}>
            {confidenceWord(data.confidence_level)}
          </Badge>}
          <span className="text-muted-foreground tabular-nums">{reports(data.ro_known_total)}</span>
        </div>
      </div>

      <h3 className="mt-5 mb-2 text-xs font-medium text-muted-foreground">How interns got in</h3>
      {channels.length === 0 && <p className="text-muted-foreground">No data.</p>}
      <ul className="space-y-3">
        {channels.map(([c, pct]) => (
          <li key={c}>
            <div className="flex justify-between text-slate-700">
              <span>{channelLabel(c)}</span>
              <span className="tabular-nums">{pct.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Based on each {data.mode === "inbound" ? "feeder" : "destination"}&apos;s top channel, weighted by intern count.
      </p>
    </aside>
  );
}
