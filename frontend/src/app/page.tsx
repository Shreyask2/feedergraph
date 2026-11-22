"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraphControls, type View } from "@/components/graph/GraphControls";
import { HiringGraph } from "@/components/graph/HiringGraph";
import { MobileFeederList } from "@/components/graph/MobileFeederList";
import { CompanyInspector } from "@/components/graph/CompanyInspector";
import type { GraphResponse } from "@/lib/types";

const DEFAULT_COMPANY = "google";

export default function Explorer() {
  const [trail, setTrail] = useState<string[]>([DEFAULT_COMPANY]);
  const [role, setRole] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [view, setView] = useState<View>("list");
  const [data, setData] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const company = trail[trail.length - 1];

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setView("graph");
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ company, verifiedOnly: String(verifiedOnly) });
    if (role) qs.set("role", role);
    fetch(`/api/graph?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "request failed");
        setData(j as GraphResponse);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ctrl.abort();
  }, [company, role, verifiedOnly]);

  const focus = (slug: string) => setTrail((t) => (t[t.length - 1] === slug ? t : [...t, slug]));

  return (
    <main className="flex h-dvh flex-col bg-background">
      <header className="flex items-baseline gap-3 border-b border-border px-4 py-2">
        <h1 className="font-mono text-lg font-bold tracking-tight">FEEDERGRAPH</h1>
        <span className="font-mono text-xs text-muted-foreground">who feeds into {data?.target.name ?? company}?</span>
        <Link href="/submit" className="ml-auto font-mono text-xs font-bold underline-offset-4 hover:underline">Submit Path</Link>
      </header>

      <GraphControls
        entities={data?.entities ?? []}
        company={company}
        role={role}
        verifiedOnly={verifiedOnly}
        view={view}
        onCompany={(s) => setTrail([s])}
        onRole={setRole}
        onVerifiedOnly={setVerifiedOnly}
        onView={setView}
      />

      {trail.length > 1 && (
        <nav className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-1 font-mono text-xs">
          {trail.map((s, i) => (
            <button
              key={`${s}-${i}`}
              type="button"
              onClick={() => setTrail((t) => t.slice(0, i + 1))}
              className={i === trail.length - 1 ? "font-bold" : "text-muted-foreground hover:underline"}
            >
              {i > 0 && "← "}
              {s}
            </button>
          ))}
        </nav>
      )}

      {error && <p className="p-4 font-mono text-sm text-destructive">Error: {error}</p>}

      {data && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 flex-1 overflow-auto">
            {view === "graph" ? (
              <HiringGraph data={data} onFocus={focus} />
            ) : (
              <MobileFeederList feeders={data.feeders} onFocus={focus} />
            )}
          </div>
          <CompanyInspector data={data} />
        </div>
      )}
    </main>
  );
}
