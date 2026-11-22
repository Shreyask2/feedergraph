"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ENTITY_TYPES } from "@/lib/schemas";

interface Sub { id: string; target_company_raw: string; prior_experiences_raw: string[]; flag_reason: string | null }
interface Ent { id: string; name: string }

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [ents, setEnts] = useState<Ent[]>([]);
  const [msg, setMsg] = useState("");

  const headers = { "x-admin-secret": secret, "Content-Type": "application/json" };

  async function load() {
    const r = await fetch("/api/admin/resolve", { headers });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "failed");
    setSubs(j.submissions);
    setEnts(j.entities);
    setMsg("");
  }

  async function resolve(sub: Sub, raw: string, body: Record<string, string>) {
    const r = await fetch("/api/admin/resolve", {
      method: "POST",
      headers,
      body: JSON.stringify({ submission_id: sub.id, raw, ...body }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "failed");
    setMsg(`resolved "${raw}"`);
    load();
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="flex items-baseline gap-3 border-b border-border px-4 py-2">
        <Link href="/" className="font-mono text-lg font-bold tracking-tight">FEEDERGRAPH</Link>
        <span className="font-mono text-xs text-muted-foreground">moderation queue</span>
      </header>
      <div className="flex flex-col gap-4 p-4 font-mono text-sm">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex max-w-md gap-2">
          <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="admin secret" aria-label="Admin secret" />
          <Button type="submit">Load</Button>
        </form>
        {msg && <p role="status" className="text-destructive">{msg}</p>}
        {subs?.length === 0 && <p className="text-muted-foreground">queue empty</p>}
        {subs?.map((s) => (
          <section key={s.id} className="border border-border p-3">
            <p className="mb-2 text-xs text-muted-foreground">{s.flag_reason} · {s.id.slice(0, 8)}</p>
            {[s.target_company_raw, ...(s.prior_experiences_raw ?? [])].map((raw, i) => (
              <Row key={`${raw}-${i}`} raw={raw} ents={ents} onResolve={(b) => resolve(s, raw, b)} />
            ))}
          </section>
        ))}
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
      <span className="min-w-40 font-bold">{raw}</span>
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
