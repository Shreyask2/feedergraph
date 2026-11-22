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
        aria-label="Top launchpads"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <Rocket className="size-3.5" /> <span className="max-sm:hidden">Top launchpads</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Top launchpad companies"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="max-h-full w-full max-w-[560px] overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-5">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold tracking-tight">Top launchpad companies</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Starter internships ranked by total interns who went on to other companies.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-slate-100"
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
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <CompanyLogo slug={r.entity.slug} domain={r.entity.domain} name={r.entity.name} tier={r.entity.tier} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">{r.entity.name}</span>
                        <span className="text-xs font-medium" style={{ color: tierColor(r.entity.tier) }}>
                          {tierLabel(r.entity.tier)}
                        </span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(r.placements / max) * 100}%`, background: tierColor(r.entity.tier) }}
                        />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-bold leading-none tabular-nums">{r.placements}</span>
                      <span className="text-xs text-muted-foreground">→ {r.destinations} companies</span>
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
