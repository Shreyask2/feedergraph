import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BrandLogo } from "@/components/BrandLogo";
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
    <main className="bg-background min-h-dvh">
      <header className="flex items-center gap-x-3 border-b border-border bg-card px-4 py-2.5">
        <Link href="/" aria-label="FeederGraph home"><BrandLogo /></Link>
        <span className="text-sm text-muted-foreground">/ Submit your path</span>
      </header>
      <div className="px-4 py-8 sm:py-12"><Suspense fallback={<SubmissionForm />}><FormWithSuggestions /></Suspense></div>
    </main>
  );
}
