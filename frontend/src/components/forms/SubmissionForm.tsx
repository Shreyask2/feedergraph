"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/types";
import { CHANNELS } from "@/lib/schemas";
import { channelLabel, roleLabel } from "@/lib/labels";
import { supabaseBrowser } from "@/lib/supabase/browser";

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-4 fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** OAuth-backed GitHub verification. The handle shown is display-only; the API reads it from the session. */
function GitHubVerify() {
  const [handle, setHandle] = useState<string | null | undefined>(undefined); // undefined = loading
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const failed = new URLSearchParams(window.location.search).get("auth") === "failed";
    (async () => {
      try {
        const { data } = await supabaseBrowser().auth.getUser();
        const gh = data.user?.identities?.find((i) => i.provider === "github");
        setHandle((gh?.identity_data?.user_name as string | undefined) ?? null);
      } catch {
        setHandle(null); // auth env not configured or network error: anonymous only
      }
      if (failed) setErr("GitHub sign-in failed. Try again.");
    })();
  }, []);

  async function signIn() {
    setErr(null);
    try {
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/submit` },
      });
      if (error) setErr(error.message);
    } catch {
      setErr("GitHub sign-in is not configured.");
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    setHandle(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
      {handle ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300">
            <BadgeCheck className="size-3.5" /> Verified as @{handle}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">2x trust weight</span>
          <button type="button" onClick={signOut} className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
            <LogOut className="size-3" /> sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={signIn}
          disabled={handle === undefined}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white font-sans text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
        >
          <GitHubMark /> Verify with GitHub (2x Trust Weight)
        </button>
      )}
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        Optional. Accounts 30+ days old with at least one original repo count at 1.0 weight (vs 0.5). One verified entry per
        season. We only read your public handle.
      </p>
      {err && <p role="alert" className="font-mono text-xs text-destructive">{err}</p>}
    </div>
  );
}

const sel = "h-9 w-full rounded-lg border border-input bg-background px-2 font-mono text-sm";
const lbl = "flex flex-col gap-1 font-mono text-xs uppercase text-muted-foreground";

export function SubmissionForm({ suggestions = [] }: { suggestions?: string[] }) {
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
    <form onSubmit={onSubmit} className="glass mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl [&_input]:h-9 p-5 shadow-2xl sm:p-7">
      <header className="space-y-1">
        <h2 className="font-sans text-xl font-bold">Add your internship path</h2>
        <p className="font-mono text-xs text-muted-foreground">
          Anonymous and takes a minute. Verify with GitHub and your entry counts at full weight, so verified paths move the
          graph most.
        </p>
      </header>
      <GitHubVerify />
      <label className={lbl}>Target company
        <Input name="target" required maxLength={100} placeholder="e.g. Jane Street" list="entity-suggestions" autoComplete="off" />
        <datalist id="entity-suggestions">{suggestions.map((n) => <option key={n} value={n} />)}</datalist>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className={lbl}>Role
          <select name="role" className={sel} required>{ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select>
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
          <select name="channel" className={sel} required>{CHANNELS.map((c) => <option key={c} value={c}>{channelLabel(c)}</option>)}</select>
        </label>
        <label className={lbl}>Return offer?
          <select name="ro" className={sel} defaultValue="">
            <option value="">unknown / ongoing</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </label>
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit path"}</Button>
      {status && (
        <p role="status" className={`font-mono text-sm ${status.ok ? "text-foreground" : "text-destructive"}`}>{status.msg}</p>
      )}
    </form>
  );
}
