"use client";

import { Badge } from "@/components/ui/badge";
import type { Feeder } from "@/lib/types";

interface Props {
  feeders: Feeder[];
  onFocus: (slug: string) => void;
}

export function MobileFeederList({ feeders, onFocus }: Props) {
  if (!feeders.length)
    return <p className="p-6 font-mono text-sm text-muted-foreground">No feeders match filters.</p>;
  const max = Math.max(...feeders.map((f) => f.weighted_score), 1);

  return (
    <ol className="divide-y divide-border">
      {feeders.map((f, i) => (
        <li key={f.entity.id}>
          <button
            type="button"
            onClick={() => onFocus(f.entity.slug)}
            className="block w-full px-4 py-3 text-left hover:bg-accent"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">
                <span className="mr-2 font-mono text-muted-foreground">{i + 1}</span>
                {f.entity.name}
              </span>
              <span className="font-mono text-sm">{f.weighted_score.toFixed(1)}</span>
            </div>
            <div className="mt-2 h-2 w-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${(f.weighted_score / max) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>{f.raw_count} interns</span>
              <span>· {f.verified_count} verified</span>
              <span>· RO {(f.bayesian_ro_rate * 100).toFixed(0)}%</span>
              <Badge variant="outline">{f.confidence_level}</Badge>
              {f.top_channel && <span>· {f.top_channel}</span>}
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}
