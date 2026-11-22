"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Share2, X } from "lucide-react";
import type { EntityLite, GraphResponse } from "@/lib/types";
import { roleLabel, tierColor } from "@/lib/labels";
import { CompanyLogo } from "./CompanyLogo";
import { telemetry } from "./TelemetryStrip";

/** Strongest multi-hop path, e.g. Capital One -> Microsoft -> Google (inbound): highest-ranked
 *  1st-degree node that has a 2nd hop, else the top node alone. */
function trajectory(data: GraphResponse): EntityLite[] {
  const top = data.feeders.find((f) => data.second_hop.some((h) => h.via === f.entity.id)) ?? data.feeders[0];
  if (!top) return [data.target];
  const hop2 = data.second_hop.find((h) => h.via === top.entity.id)?.entity;
  const chain = data.mode === "inbound" ? [hop2, top.entity, data.target] : [data.target, top.entity, hop2];
  return chain.filter((e): e is EntityLite => !!e);
}

export function ShareCard({ data, role, shareUrl }: { data: GraphResponse; role: string; shareUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = telemetry(data);
  const path = trajectory(data);
  const accent = tierColor(data.target.tier);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link", shareUrl); // clipboard blocked (non-secure context)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share path card"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <Share2 className="size-3.5" /> <span className="max-sm:hidden">Share path card</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share path card"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-[560px]">
            {/* The card itself: fixed composition so screenshots look the same everywhere. */}
            <article
              className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-xl"
              style={{ borderTop: `4px solid ${accent}` }}
            >
              <header className="flex items-baseline justify-between text-sm text-muted-foreground">
                <span className="font-semibold text-slate-900">FeederGraph</span>
                <span>
                  {data.mode === "inbound" ? "Feeds into" : "Paths from"} · {role ? roleLabel(role) : "all roles"}
                </span>
              </header>

              <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Top trajectory">
                {path.map((e, i) => (
                  <li key={e.id} className="flex min-w-0 items-center gap-2">
                    {i > 0 && <span className="text-slate-400" aria-hidden>→</span>}
                    <span
                      className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 shadow-sm"
                      style={{ borderColor: `${tierColor(e.tier)}55`, opacity: i === (data.mode === "inbound" ? 0 : 2) && path.length === 3 ? 0.65 : 1 }}
                    >
                      <CompanyLogo slug={e.slug} domain={e.domain} name={e.name} tier={e.tier} className="size-6" />
                      <span className={`truncate text-sm font-medium text-slate-900 ${e.id === data.target.id ? "text-base font-semibold" : ""}`}>{e.name}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <dl className="mt-6 grid grid-cols-3 gap-3">
                {[
                  ["Total paths", t.paths.toLocaleString()],
                  ["Verified", `${t.verifiedPct.toFixed(0)}%`],
                  ["Est. return offer", data.ro_known_total === 0 ? "—" : `${t.ro.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-xl font-semibold tabular-nums text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                {data.mode === "inbound" ? "Top feeder" : "Top destination"}: <span className="font-medium text-slate-900">{t.top}</span> · crowdsourced and smoothed for small samples
              </p>
            </article>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-slate-50"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
