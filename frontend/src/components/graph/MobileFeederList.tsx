"use client";

import { Badge } from "@/components/ui/badge";
import type { GraphResponse } from "@/lib/types";
import { channelLabel, tierColor } from "@/lib/labels";
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
    <ol className="divide-y divide-white/10">
      {feeders.map((f, i) => (
        <li key={f.entity.id}>
          <button
            type="button"
            onClick={() => onFocus(f.entity.slug)}
            className="block w-full px-4 py-3 text-left hover:bg-white/5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <span className="w-5 shrink-0 font-mono text-muted-foreground">{i + 1}</span>
                <CompanyLogo slug={f.entity.slug} domain={f.entity.domain} name={f.entity.name} tier={f.entity.tier} className="size-6" />
                <span className="truncate">{f.entity.name}</span>
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">{f.weighted_score.toFixed(1)}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${(f.weighted_score / max) * 100}%`, background: tierColor(f.entity.tier) }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>{f.raw_count} interns</span>
              <span>· {f.verified_count} verified</span>
              <span>· RO {(f.bayesian_ro_rate * 100).toFixed(0)}%</span>
              <Badge variant="outline">{f.confidence_level}</Badge>
              {f.top_channel && <span>· {channelLabel(f.top_channel)}</span>}
            </div>
            {hop2.has(f.entity.id) && (
              <p className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground opacity-80">
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
