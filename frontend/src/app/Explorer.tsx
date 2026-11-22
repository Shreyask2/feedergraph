"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraphControls, type View } from "@/components/graph/GraphControls";
import { HiringGraph } from "@/components/graph/HiringGraph";
import { MobileFeederList } from "@/components/graph/MobileFeederList";
import { CompanyInspector } from "@/components/graph/CompanyInspector";
import { TelemetryStrip } from "@/components/graph/TelemetryStrip";
import { TopLaunchpads } from "@/components/graph/TopLaunchpads";
import { ShareCard } from "@/components/graph/ShareCard";
import { ROLES, type GraphResponse, type Mode } from "@/lib/types";

const DEFAULT_COMPANY = "google";

export default function Explorer() {
  const [trail, setTrail] = useState<string[]>([DEFAULT_COMPANY]);
  const [role, setRole] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [view, setView] = useState<View>("list");
  const [mode, setMode] = useState<Mode>("inbound");
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const company = trail[trail.length - 1];
  const nameOf = (slug: string) => data?.entities.find((e) => e.slug === slug)?.name ?? slug;

  // Initial state from a shared link (?company=&mode=&role=), then fetch.
  useEffect(() => {
    // window/URL only exist after hydration, so this must run in an effect, not a lazy initializer
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(min-width: 768px)").matches) setView("graph");
    const q = new URLSearchParams(window.location.search);
    const c = q.get("company")?.trim().toLowerCase();
    if (c && /^[a-z0-9-]{1,80}$/.test(c)) setTrail([c]);
    if (q.get("mode") === "outbound") setMode("outbound");
    const r = q.get("role");
    if (r && (ROLES as readonly string[]).includes(r)) setRole(r);
    setReady(true);
  }, []);

  const shareQs = new URLSearchParams({ company, ...(mode === "outbound" && { mode }), ...(role && { role }) }).toString();

  // Keep the address bar shareable without adding history entries.
  useEffect(() => {
    if (ready) window.history.replaceState(null, "", `?${shareQs}`);
  }, [ready, shareQs]);

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ company, mode, verifiedOnly: String(verifiedOnly) });
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
  }, [ready, company, mode, role, verifiedOnly]);

  // Revisiting a slug already in the trail truncates back to it instead of looping.
  const focus = (slug: string) =>
    setTrail((t) => {
      const i = t.indexOf(slug);
      return i === -1 ? [...t, slug] : t.slice(0, i + 1);
    });

  return (
    <main className="terminal-bg flex h-dvh flex-col">
      <header className="flex flex-wrap items-baseline gap-x-3 border-b border-border px-4 py-2">
        <h1 className="font-mono text-lg font-bold tracking-tight">FEEDERGRAPH</h1>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {mode === "inbound" ? "who feeds into" : "where do alumni go from"} {data?.target.name ?? nameOf(company)}?
        </span>
        <div className="flex items-center gap-3 self-center">
          <TopLaunchpads onPick={(s) => { setMode("outbound"); setTrail([s]); }} />
          {data && <ShareCard data={data} role={role} shareUrl={`${window.location.origin}/?${shareQs}`} />}
          <Link href="/submit" className="font-mono text-xs font-bold underline-offset-4 hover:underline">Submit Path</Link>
        </div>
      </header>

      <GraphControls
        entities={data?.entities ?? []}
        company={company}
        role={role}
        verifiedOnly={verifiedOnly}
        view={view}
        mode={mode}
        targetName={data?.target.name ?? nameOf(company)}
        onMode={setMode}
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
              {nameOf(s)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTrail([trail[0]])}
            className="ml-auto rounded border border-border px-2 py-0.5 uppercase text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </nav>
      )}

      {error && <p className="p-4 font-mono text-sm text-destructive">Error: {error}</p>}

      {data && <TelemetryStrip data={data} />}

      {data && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative min-h-[420px] flex-1 overflow-auto md:min-h-0">
            {view === "graph" ? (
              <HiringGraph data={data} onFocus={focus} />
            ) : (
              <MobileFeederList data={data} onFocus={focus} />
            )}
          </div>
          <CompanyInspector data={data} />
        </div>
      )}
    </main>
  );
}
