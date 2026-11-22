import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { SubmissionForm } from "@/components/forms/SubmissionForm";
import { supabaseAnon } from "@/lib/supabase/server";

export const metadata = { title: "Submit Path — FeederGraph" };

async function entityNames(): Promise<string[]> {
  await connection();
  try {
    const { data } = await supabaseAnon().from("canonical_entities").select("name").order("name");
    return (data ?? []).map((e) => e.name as string);
  } catch {
    return []; // suggestions are optional; form still works
  }
}

async function FormWithSuggestions() {
  return <SubmissionForm suggestions={await entityNames()} />;
}

export default function SubmitPage() {
  return (
    <main className="terminal-bg min-h-dvh">
      <header className="flex flex-wrap items-baseline gap-x-3 border-b border-border px-4 py-2">
        <Link href="/" className="font-mono text-lg font-bold tracking-tight">FEEDERGRAPH</Link>
        <span className="font-mono text-xs text-muted-foreground">submit your internship path</span>
      </header>
      <div className="px-4 py-8 sm:py-12"><Suspense fallback={<SubmissionForm />}><FormWithSuggestions /></Suspense></div>
    </main>
  );
}
