"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/types";
import { CHANNELS } from "@/lib/schemas";

const sel = "h-8 w-full border border-input bg-background px-2 font-mono text-sm";
const lbl = "flex flex-col gap-1 font-mono text-xs uppercase text-muted-foreground";

export function SubmissionForm() {
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ro = String(f.get("ro"));
    const body = {
      target_company_raw: f.get("target"),
      role_category: f.get("role"),
      internship_season: f.get("season"),
      prior_experiences_raw: String(f.get("prior") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      channel: f.get("channel"),
      github_username: f.get("github") || null,
      received_return_offer: ro === "" ? null : ro === "yes",
    };
    setBusy(true);
    try {
      const r = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) {
        setStatus({ ok: true, msg: "Submitted. Pending resolution." });
        (e.target as HTMLFormElement).reset();
      } else {
        const detail = j.issues?.map((i: { path: string[]; message: string }) => `${i.path.join(".")}: ${i.message}`).join("; ");
        setStatus({ ok: false, msg: detail || j.error || "failed" });
      }
    } catch {
      setStatus({ ok: false, msg: "network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <label className={lbl}>Target company
        <Input name="target" required maxLength={100} placeholder="e.g. Jane Street" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className={lbl}>Role
          <select name="role" className={sel} required>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label className={lbl}>Season
          <Input name="season" required placeholder="Summer 2026" />
        </label>
      </div>
      <label className={lbl}>Prior experiences (comma separated)
        <Input name="prior" placeholder="Capital One, Mozilla, FAIR" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className={lbl}>How you got it
          <select name="channel" className={sel} required>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className={lbl}>Return offer?
          <select name="ro" className={sel} defaultValue="">
            <option value="">unknown / ongoing</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </label>
      </div>
      <label className={lbl}>GitHub username (optional, boosts trust weight)
        <Input name="github" maxLength={39} />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit path"}</Button>
      {status && (
        <p role="status" className={`font-mono text-sm ${status.ok ? "text-foreground" : "text-destructive"}`}>{status.msg}</p>
      )}
    </form>
  );
}
