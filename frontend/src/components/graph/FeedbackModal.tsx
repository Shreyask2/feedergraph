"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { v: "bug", l: "Bug" },
  { v: "missing_company", l: "Missing Company" },
  { v: "feature", l: "Feature Idea" },
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
      <button type="button" onClick={show} className="font-mono text-xs font-bold underline-offset-4 hover:underline">
        Feedback
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="glass max-h-full w-full max-w-[480px] overflow-y-auto overflow-x-hidden font-mono whitespace-normal break-words">
            <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider">Feedback</h2>
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
            {status === "done" ? (
              <div className="flex flex-col gap-3 px-4 py-4 text-xs">
                <p role="status" className="text-sky-300">Thanks — feedback received.</p>
                <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="self-start">Close</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-4 text-xs">
                <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      role="radio"
                      aria-checked={category === c.v}
                      onClick={() => setCategory(c.v)}
                      className={`border px-2 py-1 ${category === c.v ? "border-sky-300 bg-sky-400/10 text-sky-300" : "border-zinc-800/80 hover:bg-white/10"}`}
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
                  className="w-full resize-none border border-zinc-800/80 bg-transparent p-2 outline-none focus:border-sky-300"
                />
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  aria-label="Contact for follow-up (optional)"
                  placeholder="Optional: @handle or email for follow-up"
                  className="w-full border border-zinc-800/80 bg-transparent px-2 py-1.5 outline-none focus:border-sky-300"
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
