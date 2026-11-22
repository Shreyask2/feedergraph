"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { CompanySearch, GraphControls, PopularPicks, type View } from "@/components/graph/GraphControls";
import { HiringGraph } from "@/components/graph/HiringGraph";
import { MobileFeederList } from "@/components/graph/MobileFeederList";
import { CompanyInspector } from "@/components/graph/CompanyInspector";
import { TelemetryStrip } from "@/components/graph/TelemetryStrip";
import { TopLaunchpads } from "@/components/graph/TopLaunchpads";
import { ShareCard } from "@/components/graph/ShareCard";
import { MethodologyModal } from "@/components/graph/MethodologyModal";
import { FeedbackModal } from "@/components/graph/FeedbackModal";
import { BrandLogo } from "@/components/BrandLogo";
import { ROLES, type GraphResponse, type Mode } from "@/lib/types";

const DEFAULT_COMPANY = "google";

export default function Explorer() {
  const [trail, setTrail] = useState<string[]>([DEFAULT_COMPANY]);
  const [role, setRole] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [view, setView] = useState<View>("list");
  const [mode, setMode] = useState<Mode>("inbound");
  const [ready, setReady] = useState(false);
  // Hero shows only on a bare URL; captured at load because replaceState adds ?company= right after.
  const [showHero, setShowHero] = useState(false);
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
    setShowHero(!q.has("company"));
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

  const resetAll = () => {
    setTrail([DEFAULT_COMPANY]);
    setMode("inbound");
    setRole("");
    setError(null);
  };

  const subject = data?.target.name ?? nameOf(company);
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-2.5">
        <h1>
          <Link href="/" aria-label="FeederGraph home" onClick={(e) => { e.preventDefault(); resetAll(); }}>
            <BrandLogo />
          </Link>
        </h1>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground max-sm:hidden">
          {mode === "inbound" ? "Who feeds into" : "Where alumni go from"} <span className="font-medium text-slate-900">{subject}</span>?
        </span>
        <div className="flex w-full items-center justify-between gap-2 whitespace-nowrap sm:ml-auto sm:w-auto sm:justify-start sm:gap-4 max-sm:gap-x-3">
          <TopLaunchpads onPick={(s) => { setMode("outbound"); setTrail([s]); }} />
          {data && <ShareCard data={data} role={role} shareUrl={`${window.location.origin}/?${shareQs}`} />}
          <MethodologyModal />
          <FeedbackModal />
          <Link href="/submit" className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800">
            Submit<span className="max-sm:hidden"> a path</span>
          </Link>
        </div>
      </header>

      {showHero && data && (
        <section className="relative border-b border-border bg-card px-4 py-8 sm:py-10">
          <button type="button" onClick={() => setShowHero(false)} aria-label="Dismiss intro" className="absolute top-3 right-3 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <X className="size-4" />
          </button>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-blue-700">Built for the Direct Consideration community</p>
            <h2 className="mt-2 font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Where tech interns <em className="text-blue-700">actually</em> come from
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
              Crowdsourced internship paths, traced company by company, with the return-offer odds that go with them.
            </p>
            <div className="mx-auto mt-6 max-w-xl text-left">
              <CompanySearch entities={data.entities} onPick={(s) => { setTrail([s]); setShowHero(false); }} large />
            </div>
            <div className="mt-3 flex justify-center">
              <PopularPicks company={company} onCompany={(s) => { setTrail([s]); setShowHero(false); }} />
            </div>
            <p className="mt-5 text-sm text-slate-500 tabular-nums">
              <b className="font-semibold text-slate-900">{data.totals.entities.toLocaleString()}</b> companies ·{" "}
              <b className="font-semibold text-slate-900">{data.totals.paths.toLocaleString()}</b> reported paths ·{" "}
              <Link href="/submit" className="font-medium text-blue-700 underline-offset-4 hover:underline">Add yours</Link>
            </p>
          </div>
        </section>
      )}

      <GraphControls
        entities={data?.entities ?? []}
        company={company}
        role={role}
        verifiedOnly={verifiedOnly}
        view={view}
        mode={mode}
        targetName={subject}
        hideSearch={showHero && !!data}
        onMode={setMode}
        onCompany={(s) => setTrail([s])}
        onRole={setRole}
        onVerifiedOnly={setVerifiedOnly}
        onView={setView}
      />

      {trail.length > 1 && (
        <nav className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-4 py-1.5 text-sm">
          {trail.map((s, i) => (
            <button
              key={`${s}-${i}`}
              type="button"
              onClick={() => setTrail((t) => t.slice(0, i + 1))}
              className={i === trail.length - 1 ? "font-semibold text-slate-900" : "text-muted-foreground hover:text-slate-900 hover:underline"}
            >
              {i > 0 && "← "}
              {nameOf(s)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTrail([trail[0]])}
            className="ml-auto rounded-md border border-border px-2 py-0.5 text-muted-foreground hover:bg-slate-50 hover:text-slate-900"
          >
            Reset
          </button>
        </nav>
      )}

      {error && (
        <div className="p-4 text-sm">
          <p className="text-destructive">Error: {error}</p>
          <button type="button" onClick={resetAll} className="mt-2 rounded-md border border-border bg-card px-3 py-1 font-medium shadow-sm hover:bg-slate-50">
            Back to the default graph
          </button>
        </div>
      )}

      {data && <TelemetryStrip data={data} />}

      {data && (
        <div className="flex flex-1 flex-col md:min-h-[600px] md:flex-row">
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
