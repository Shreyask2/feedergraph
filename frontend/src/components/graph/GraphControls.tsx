"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ROLES, type EntityLite } from "@/lib/types";

export type View = "graph" | "list";

interface Props {
  entities: EntityLite[];
  company: string;
  role: string;
  verifiedOnly: boolean;
  view: View;
  onCompany: (slug: string) => void;
  onRole: (role: string) => void;
  onVerifiedOnly: (v: boolean) => void;
  onView: (v: View) => void;
}

export function GraphControls(p: Props) {
  const [q, setQ] = useState("");
  const matches = q.trim()
    ? p.entities.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 font-mono text-xs">
      <div className="relative w-full sm:w-64">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search company…"
          aria-label="Search company"
        />
        {matches.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full border border-border bg-popover shadow-lg">
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="flex w-full justify-between px-3 py-2 text-left hover:bg-accent"
                  onClick={() => {
                    p.onCompany(e.slug);
                    setQ("");
                  }}
                >
                  <span>{e.name}</span>
                  <span className="text-muted-foreground">{e.tier}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-2">
        <span className="text-muted-foreground uppercase">role</span>
        <select
          value={p.role}
          onChange={(e) => p.onRole(e.target.value)}
          className="h-8 border border-input bg-background px-2"
        >
          <option value="">All</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <Switch checked={p.verifiedOnly} onCheckedChange={p.onVerifiedOnly} />
        <span className="uppercase">verified only</span>
      </label>

      <div className="ml-auto flex gap-1">
        {(["graph", "list"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={p.view === v ? "default" : "outline"}
            onClick={() => p.onView(v)}
            className="uppercase"
          >
            {v}
          </Button>
        ))}
      </div>
    </div>
  );
}
