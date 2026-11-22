"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ENTITY_TYPES } from "@/lib/schemas";

interface Sub { id: string; target_company_raw: string; prior_experiences_raw: string[]; flag_reason: string | null }
const FLAG_LABELS: Record<string, string> = {
  new_entity_candidate: "New company candidate",
  ambiguous_fuzzy_match: "Ambiguous match",
};
interface Fb { id: string; category: string; message: string; page_context: string | null; github_username: string | null; contact: string | null; created_at: string }
interface Ent { id: string; name: string }

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [ents, setEnts] = useState<Ent[]>([]);
  const [fb, setFb] = useState<Fb[] | null>(null);
  const [msg, setMsg] = useState("");

  const headers = { "x-admin-secret": secret, "Content-Type": "application/json" };

  // fetch + JSON parse can throw (offline, non-JSON 5xx): surface as a message, never an unhandled rejection.
  async function call(init?: RequestInit) {
    try {
      const r = await fetch("/api/admin/resolve", { headers, ...init });
      const j = await r.json().catch(() => ({}));
      return r.ok ? { j } : { err: (j.error as string) ?? "failed" };
    } catch {
      return { err: "network error" };
    }
  }

  async function load() {
    const { j, err } = await call();
    if (err) return setMsg(err);
    setSubs(j.submissions ?? []);
    setEnts(j.entities ?? []);
    setMsg("");
    try {
      const r = await fetch("/api/admin/feedback", { headers });
      const f = await r.json().catch(() => ({}));
      if (r.ok) setFb(f.feedback ?? []);
      else setMsg((f.error as string) ?? "feedback load failed");
    } catch {
      setMsg("network error");
    }
  }

  async function resolve(sub: Sub, raw: string, body: Record<string, string>) {
    const { err } = await call({ method: "POST", body: JSON.stringify({ submission_id: sub.id, raw, ...body }) });
    if (err) return setMsg(err);
    setMsg(`resolved "${raw}"`);
    load();
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link href="/" aria-label="FeederGraph home"><BrandLogo /></Link>
        <span className="text-sm text-muted-foreground">/ Moderation queue</span>
      </header>
      <div className="flex flex-col gap-4 p-4 text-sm">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex max-w-md gap-2">
          <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="admin secret" aria-label="Admin secret" />
          <Button type="submit">Load</Button>
        </form>
        {msg && <p role="status" className="text-destructive">{msg}</p>}
        {subs?.length === 0 && <p className="text-muted-foreground">queue empty</p>}
        {subs?.map((s) => (
          <section key={s.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="mb-2 text-xs text-muted-foreground">{s.flag_reason ? FLAG_LABELS[s.flag_reason] ?? s.flag_reason.replace(/_/g, " ") : "flagged"} · {s.id.slice(0, 8)}</p>
            {[s.target_company_raw, ...(s.prior_experiences_raw ?? [])].map((raw, i) => (
              <Row key={`${raw}-${i}`} raw={raw} ents={ents} onResolve={(b) => resolve(s, raw, b)} />
            ))}
          </section>
        ))}
        {fb && (
          <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Feedback ({fb.length})</h2>
            {fb.length === 0 && <p className="text-muted-foreground">none yet</p>}
            {fb.map((f) => (
              <div key={f.id} className="border-t border-border py-2 first:border-t-0">
                <p className="text-xs text-muted-foreground">
                  {f.category.replace(/_/g, " ")} · {new Date(f.created_at).toLocaleString()}{f.page_context ? ` · ${f.page_context}` : ""}
                </p>
                {(f.github_username || f.contact) && (
                  <p className="flex flex-wrap gap-2 text-xs">
                    {f.github_username && <span className="rounded border border-blue-200 bg-blue-50 px-1 text-blue-700">@{f.github_username}</span>}
                    {f.contact && <span className="break-all">{f.contact}</span>}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{f.message}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

// One string per row: map to an existing entity or create a new one.
function Row({ raw, ents, onResolve }: { raw: string; ents: Ent[]; onResolve: (b: Record<string, string>) => void }) {
  const [entityId, setEntityId] = useState("");
  const [type, setType] = useState<string>("company");
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
      <span className="min-w-0 break-all font-bold sm:min-w-40">{raw}</span>
      <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="h-8 border border-input bg-background px-2" aria-label={`Map ${raw} to`}>
        <option value="">map to…</option>
        {ents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <Button size="sm" disabled={!entityId} onClick={() => onResolve({ action: "map", entity_id: entityId })}>Map</Button>
      <span className="text-muted-foreground">or</span>
      <select value={type} onChange={(e) => setType(e.target.value)} className="h-8 border border-input bg-background px-2" aria-label="Entity type">
        {ENTITY_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <Button size="sm" variant="outline" onClick={() => onResolve({ action: "new", new_name: raw, entity_type: type })}>Create new</Button>
    </div>
  );
}
