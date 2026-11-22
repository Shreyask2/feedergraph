"use client";

import { Badge } from "@/components/ui/badge";
import type { GraphResponse } from "@/lib/types";
import { channelLabel, confidenceWord, tierColor } from "@/lib/labels";
import { CompanyLogo } from "./CompanyLogo";
import { EmptyPaths } from "./EmptyPaths";

interface Props {
  data: GraphResponse;
  onFocus: (slug: string) => void;
}

export function MobileFeederList({ data, onFocus }: Props) {
  const { feeders } = data;
  const inbound = data.mode === "inbound";
  if (!feeders.length) return <EmptyPaths target={data.target} />;
  const hop2 = new Map(data.second_hop.map((h) => [h.via, h.entity]));
  const max = Math.max(...feeders.map((f) => f.weighted_score), 1);

  return (
    <ol className="divide-y divide-border bg-card">
      {feeders.map((f, i) => (
        <li key={f.entity.id}>
          <button
            type="button"
            onClick={() => onFocus(f.entity.slug)}
            className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2.5 font-medium text-slate-900">
                <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                <CompanyLogo slug={f.entity.slug} domain={f.entity.domain} name={f.entity.name} tier={f.entity.tier} className="size-6" />
                <span className="truncate">{f.entity.name}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{f.weighted_score.toFixed(1)}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(f.weighted_score / max) * 100}%`, background: tierColor(f.entity.tier) }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
              <span>{f.raw_count} intern{f.raw_count === 1 ? "" : "s"}</span>
              <span>· {f.verified_count} verified</span>
              <span>· {f.ro_known_total === 0 ? "No return-offer data" : `${(f.bayesian_ro_rate * 100).toFixed(0)}% return offer`}</span>
              {f.ro_known_total > 0 && <Badge variant="outline" className="h-5 text-slate-600">{confidenceWord(f.confidence_level)}</Badge>}
              {f.top_channel && <span>· {channelLabel(f.top_channel)}</span>}
            </div>
            {hop2.has(f.entity.id) && (
              <p className="mt-1.5 truncate text-xs text-slate-500">
                {inbound
                  ? `2nd hop: ${hop2.get(f.entity.id)!.name} → ${f.entity.name} → ${data.target.name}`
                  : `2nd hop: ${data.target.name} → ${f.entity.name} → ${hop2.get(f.entity.id)!.name}`}
              </p>
            )}
          </button>
        </li>
      ))}
    </ol>
  );
}
