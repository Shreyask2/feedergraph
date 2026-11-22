import Link from "next/link";
import { SubmissionForm } from "@/components/forms/SubmissionForm";

export const metadata = { title: "Submit Path — FeederGraph" };

export default function SubmitPage() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="flex items-baseline gap-3 border-b border-border px-4 py-2">
        <Link href="/" className="font-mono text-lg font-bold tracking-tight">FEEDERGRAPH</Link>
        <span className="font-mono text-xs text-muted-foreground">submit your internship path</span>
      </header>
      <div className="p-4"><SubmissionForm /></div>
    </main>
  );
}
