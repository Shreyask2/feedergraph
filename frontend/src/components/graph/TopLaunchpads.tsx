"use client";

import { useEffect, useRef, useState } from "react";
import { Rocket, X } from "lucide-react";
import type { Launchpad } from "@/app/api/launchpads/route";
import { tierColor, tierLabel } from "@/lib/labels";
import { CompanyLogo } from "./CompanyLogo";

/** Header button + modal: which starter internships send the most interns onward. */
export function TopLaunchpads({ onPick }: { onPick: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Launchpad[] | null>(null);
  const [error, setError] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || rows) return;
    fetch("/api/launchpads")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setRows(j.launchpads))
      .catch(() => setError(true));
  }, [open, rows]);

  const max = rows?.[0]?.placements ?? 1;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 border border-zinc-800/80 px-2 py-0.5 font-mono text-xs font-bold hover:border-white/30"
      >
        <Rocket className="size-3.5" /> <span className="max-sm:hidden">Top </span>Launchpads
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Top launchpad companies"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="glass max-h-full w-full max-w-[560px] overflow-y-auto border border-zinc-800/80 p-5 font-mono">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Top Launchpad Companies</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Starter internships ranked by total interns who went on to other companies.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15 hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </header>

            {error && <p className="mt-4 text-sm text-destructive">Could not load launchpads.</p>}
            {!rows && !error && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
            <ol className="mt-4 space-y-1.5">
              {rows?.map((r, i) => (
                <li key={r.entity.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r.entity.slug);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 border border-zinc-800/80 px-3 py-2 text-left hover:border-white/30 hover:bg-white/5"
                  >
                    <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <CompanyLogo slug={r.entity.slug} domain={r.entity.domain} name={r.entity.name} tier={r.entity.tier} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-bold">{r.entity.name}</span>
                        <span className="text-[10px] uppercase" style={{ color: tierColor(r.entity.tier) }}>
                          {tierLabel(r.entity.tier)}
                        </span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(r.placements / max) * 100}%`, background: tierColor(r.entity.tier) }}
                        />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-bold leading-none tabular-nums">{r.placements}</span>
                      <span className="text-[10px] text-muted-foreground">→ {r.destinations} cos</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
