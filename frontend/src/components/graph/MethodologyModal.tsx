"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const SECTIONS = [
  {
    h: "01 · 3-stage entity resolution",
    p: "Every submitted company name is normalized, then matched in three passes: exact alias lookup, fuzzy string similarity against canonical names, and finally a manual admin queue for anything ambiguous. Hence “Meta”, “Facebook” and “FB” land on one node.",
  },
  {
    h: "02 · GitHub OAuth trust weighting",
    p: "Paths from users who sign in with GitHub count as verified and carry a higher weight than anonymous ones, scaled by the account's open-source footprint. Weighted score ranks edges; raw counts stay visible beside it.",
  },
  {
    h: "03 · Bayesian RO smoothing",
    p: "Return-offer rates use a Beta prior, so a 1-of-1 sample doesn't read as 100%. Small n pulls toward the global mean; confidence (low / medium / high) is derived from n and shown with every rate.",
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
      <button type="button" onClick={() => setOpen(true)} className="font-mono text-xs font-bold underline-offset-4 hover:underline">
        How It Works
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="How FeederGraph works"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="glass max-h-full w-full max-w-[560px] overflow-y-auto overflow-x-hidden font-mono whitespace-normal break-words">
            <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider">How It Works</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-7 items-center justify-center border border-zinc-800/80 hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="divide-y divide-zinc-800/80">
              {SECTIONS.map((s) => (
                <section key={s.h} className="px-4 py-3">
                  <h3 className="text-xs font-bold text-sky-300">{s.h}</h3>
                  <p className="mt-1 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">{s.p}</p>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
