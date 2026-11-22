"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const SECTIONS = [
  {
    h: "1. Three-stage name matching",
    p: "Every submitted company name is normalized, then matched in three passes: exact alias lookup, fuzzy string similarity against canonical names, and finally a manual admin queue for anything ambiguous. Hence “Meta”, “Facebook” and “FB” land on one node.",
  },
  {
    h: "2. GitHub trust weighting",
    p: "Paths from users who sign in with GitHub count as verified and carry a higher weight than anonymous ones, scaled by the account's open-source footprint. Weighted score ranks edges; raw counts stay visible beside it.",
  },
  {
    h: "3. Smoothed return-offer rates",
    p: "Return-offer rates are smoothed with a Bayesian prior, so a 1-of-1 sample doesn't read as 100%. Small n pulls toward the global mean; confidence (low / medium / high) is derived from n and shown with every rate.",
  },
];

/** Navbar link + modal explaining how the graph is built. */
export function MethodologyModal() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
        How it works
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="How FeederGraph works"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="max-h-full w-full max-w-[560px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card shadow-xl whitespace-normal break-words">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">How it works</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-7 items-center justify-center rounded-md border border-border hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="divide-y divide-border">
              {SECTIONS.map((s) => (
                <section key={s.h} className="px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">{s.h}</h3>
                  <p className="mt-1 whitespace-normal break-words text-sm leading-relaxed text-slate-600">{s.p}</p>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
