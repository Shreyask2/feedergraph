"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ROLES, type EntityLite, type Mode } from "@/lib/types";
import { QUICK_PICKS, roleLabel, tierColor, tierLabel } from "@/lib/labels";

export type View = "graph" | "list";

interface Props {
  entities: EntityLite[];
  company: string;
  role: string;
  verifiedOnly: boolean;
  view: View;
  mode: Mode;
  targetName: string;
  onMode: (m: Mode) => void;
  onCompany: (slug: string) => void;
  onRole: (role: string) => void;
  onVerifiedOnly: (v: boolean) => void;
  onView: (v: View) => void;
}

const pill = (active: boolean) =>
  `shrink-0 rounded-sm border px-2 py-0.5 tabular-nums transition-colors ${
    active
      ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
      : "border-zinc-800/80 text-muted-foreground hover:border-white/30 hover:text-foreground"
  }`;

export function GraphControls(p: Props) {
  const [q, setQ] = useState("");
  const matches = q.trim()
    ? p.entities.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="flex flex-col gap-1.5 border-b border-zinc-800/80 bg-background/60 px-4 py-2 font-mono text-xs tabular-nums">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search company…"
            aria-label="Search company"
          />
          {matches.length > 0 && (
            <ul className="glass absolute z-20 mt-1 w-full shadow-lg">
              {matches.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="flex w-full justify-between px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => {
                      p.onCompany(e.slug);
                      setQ("");
                    }}
                  >
                    <span>{e.name}</span>
                    <span style={{ color: tierColor(e.tier) }}>{tierLabel(e.tier)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div role="group" aria-label="Direction" className="flex min-w-0 overflow-hidden border border-zinc-800/80">
          {(
            [
              ["inbound", "Feeds Into"],
              ["outbound", "Paths From"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={p.mode === m}
              onClick={() => p.onMode(m)}
              className={`min-w-0 truncate px-3 py-1 transition-colors ${
                p.mode === m ? "bg-sky-400/20 text-sky-100" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} <span className="font-bold">{p.targetName}</span>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <Switch checked={p.verifiedOnly} onCheckedChange={p.onVerifiedOnly} />
          <span className="uppercase">verified only</span>
        </label>

        <div role="group" aria-label="View" className="ml-auto flex overflow-hidden border border-zinc-800/80">
          {(["graph", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={p.view === v}
              onClick={() => p.onView(v)}
              className={`px-3 py-1 uppercase ${p.view === v ? "bg-sky-400/20 text-sky-100" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto" aria-label="Quick select company">
        <span className="shrink-0 self-center pr-1 uppercase text-muted-foreground">try</span>
        {QUICK_PICKS.map((c) => (
          <button key={c.slug} type="button" onClick={() => p.onCompany(c.slug)} className={pill(p.company === c.slug)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Role filter">
        <span className="shrink-0 self-center pr-1 uppercase text-muted-foreground">role</span>
        {["", ...ROLES].map((r) => (
          <button key={r || "all"} type="button" aria-pressed={p.role === r} onClick={() => p.onRole(r)} className={pill(p.role === r)}>
            {r ? roleLabel(r) : "All"}
          </button>
        ))}
      </div>
    </div>
  );
}
