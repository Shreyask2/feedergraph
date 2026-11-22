"use client";

import { useState } from "react";
import { Search } from "lucide-react";
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
  /** Hero already shows the search bar. */
  hideSearch?: boolean;
  onMode: (m: Mode) => void;
  onCompany: (slug: string) => void;
  onRole: (role: string) => void;
  onVerifiedOnly: (v: boolean) => void;
  onView: (v: View) => void;
}

const pill = (active: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
    active
      ? "border-blue-700 bg-blue-700 text-white"
      : "border-border bg-card text-slate-600 hover:border-slate-300 hover:text-slate-900"
  }`;

const seg = (active: boolean) =>
  `min-w-0 truncate px-3 py-1.5 text-sm transition-colors ${
    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;

/** Typeahead over the loaded entities; Enter picks the first match. */
export function CompanySearch({ entities, onPick, large = false }: { entities: EntityLite[]; onPick: (slug: string) => void; large?: boolean }) {
  const [q, setQ] = useState("");
  const matches = q.trim() ? entities.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const pick = (slug: string) => {
    onPick(slug);
    setQ("");
  };
  return (
    <div className="relative w-full">
      <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${large ? "left-4 size-5" : "left-3 size-4"}`} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && matches[0] && pick(matches[0].slug)}
        placeholder={large ? "Search a company, e.g. Stripe or Jane Street" : "Search a company"}
        aria-label="Search company"
        autoComplete="off"
        className={`w-full rounded-xl border border-input bg-card text-slate-900 shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-ring focus:ring-4 focus:ring-ring/20 ${
          large ? "h-13 pr-4 pl-12 text-base" : "h-9 pr-3 pl-9 text-sm"
        }`}
      />
      {matches.length > 0 && (
        <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
          {matches.map((e) => (
            <li key={e.id}>
              <button type="button" className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50" onClick={() => pick(e.slug)}>
                <span className="font-medium text-slate-900">{e.name}</span>
                <span className="text-xs font-medium" style={{ color: tierColor(e.tier) }}>{tierLabel(e.tier)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PopularPicks({ company, onCompany }: { company: string; onCompany: (slug: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto" aria-label="Popular companies">
      <span className="shrink-0 pr-1 text-sm text-muted-foreground">Popular:</span>
      {QUICK_PICKS.map((c) => (
        <button key={c.slug} type="button" onClick={() => onCompany(c.slug)} className={pill(company === c.slug)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function GraphControls(p: Props) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {!p.hideSearch && (
          <div className="w-full sm:w-72">
            <CompanySearch entities={p.entities} onPick={p.onCompany} />
          </div>
        )}

        <div role="group" aria-label="Direction" className="flex min-w-0 overflow-hidden rounded-lg border border-input">
          {(
            [
              ["inbound", "Feeds into"],
              ["outbound", "Paths from"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={p.mode === m} onClick={() => p.onMode(m)} className={seg(p.mode === m)}>
              {label} <span className="font-semibold">{p.targetName}</span>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Switch checked={p.verifiedOnly} onCheckedChange={p.onVerifiedOnly} />
          <span>Verified only</span>
        </label>

        <div role="group" aria-label="View" className="ml-auto flex overflow-hidden rounded-lg border border-input">
          {(["graph", "list"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={p.view === v} onClick={() => p.onView(v)} className={seg(p.view === v)}>
              {v === "graph" ? "Graph" : "List"}
            </button>
          ))}
        </div>
      </div>

      {!p.hideSearch && <PopularPicks company={p.company} onCompany={p.onCompany} />}

      <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="Role filter">
        <span className="shrink-0 pr-1 text-sm text-muted-foreground">Role:</span>
        {["", ...ROLES].map((r) => (
          <button key={r || "all"} type="button" aria-pressed={p.role === r} onClick={() => p.onRole(r)} className={pill(p.role === r)}>
            {r ? roleLabel(r) : "All"}
          </button>
        ))}
      </div>
    </div>
  );
}
