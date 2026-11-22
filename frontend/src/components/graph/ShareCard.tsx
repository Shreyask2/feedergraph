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
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-xs font-bold hover:border-white/30"
      >
        <Share2 className="size-3.5" /> Share Path Card
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share path card"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-[560px]">
            {/* The card itself: fixed composition so screenshots look the same everywhere. */}
            <article
              className="relative overflow-hidden rounded-2xl border border-white/15 bg-[oklch(0.15_0.012_255)] p-6"
              style={{ backgroundImage: `radial-gradient(ellipse 70% 60% at 100% 0%, ${accent}2e, transparent 70%)` }}
            >
              <header className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="font-bold text-foreground">FeederGraph</span>
                <span>
                  {data.mode === "inbound" ? "feeds into" : "paths from"} · {role ? roleLabel(role) : "all roles"}
                </span>
              </header>

              <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Top trajectory">
                {path.map((e, i) => (
                  <li key={e.id} className="flex min-w-0 items-center gap-2">
                    {i > 0 && <span className="font-mono text-muted-foreground" aria-hidden>→</span>}
                    <span
                      className="flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5"
                      style={{ borderColor: `${tierColor(e.tier)}66`, opacity: i === (data.mode === "inbound" ? 0 : 2) && path.length === 3 ? 0.65 : 1 }}
                    >
                      <CompanyLogo slug={e.slug} domain={e.domain} name={e.name} tier={e.tier} className="size-6" />
                      <span className={`truncate text-sm font-semibold ${e.id === data.target.id ? "text-base font-bold" : ""}`}>{e.name}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <dl className="mt-6 grid grid-cols-3 gap-3 font-mono">
                {[
                  ["Paths", t.paths.toLocaleString()],
                  ["Verified", `${t.verifiedPct.toFixed(0)}%`],
                  ["Smoothed RO", `${t.ro.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                    <dd className="text-xl font-bold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 font-mono text-[11px] text-muted-foreground">
                {data.mode === "inbound" ? "Top feeder" : "Top destination"}: <span className="text-foreground">{t.top}</span> · crowdsourced, Bayesian-smoothed
              </p>
            </article>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-white font-sans text-sm font-semibold text-black hover:bg-white/90"
              >
                {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
                {copied ? "Copied" : "Copy Link"}
              </button>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-white/15 hover:bg-white/10"
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
