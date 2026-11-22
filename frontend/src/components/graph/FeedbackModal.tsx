"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { v: "bug", l: "Bug" },
  { v: "missing_company", l: "Missing company" },
  { v: "feature", l: "Feature idea" },
  { v: "other", l: "Other" },
] as const;

/** Navbar link + modal for sending feedback. */
export function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function show() {
    setStatus("idle");
    setErr("");
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErr("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, contact, page_context: window.location.pathname + window.location.search }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr((j.error as string) ?? "failed");
        return setStatus("idle");
      }
      setMessage("");
      setStatus("done");
    } catch {
      setErr("network error");
      setStatus("idle");
    }
  }

  return (
    <>
      <button type="button" onClick={show} className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
        Feedback
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="max-h-full w-full max-w-[480px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card shadow-xl whitespace-normal break-words">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Send feedback</h2>
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
            {status === "done" ? (
              <div className="flex flex-col gap-3 px-4 py-4 text-sm">
                <p role="status" className="text-blue-700">Thanks — feedback received.</p>
                <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="self-start">Close</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-4 text-sm">
                <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      role="radio"
                      aria-checked={category === c.v}
                      onClick={() => setCategory(c.v)}
                      className={`rounded-full border px-3 py-1 ${category === c.v ? "border-blue-600 bg-blue-50 text-blue-700" : "border-border hover:bg-slate-100"}`}
                    >
                      {c.l}
                    </button>
                  ))}
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  minLength={5}
                  maxLength={1000}
                  required
                  rows={5}
                  aria-label="Message"
                  placeholder="What's on your mind?"
                  className="w-full resize-none rounded-lg border border-input bg-card p-2.5 outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                />
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  aria-label="Contact for follow-up (optional)"
                  placeholder="Optional: @handle or email for follow-up"
                  className="w-full rounded-lg border border-input bg-card px-2.5 py-2 outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{message.length}/1000</span>
                  <Button type="submit" size="sm" disabled={status === "sending" || message.trim().length < 5}>
                    {status === "sending" ? "Sending…" : "Send"}
                  </Button>
                </div>
                {err && <p role="alert" className="text-destructive">{err}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
