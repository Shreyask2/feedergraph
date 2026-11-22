import Link from "next/link";
import type { GraphResponse } from "@/lib/types";
import { CompanyLogo } from "./CompanyLogo";

/** Zero-edge state: turns an empty company page into a contribution prompt. */
export function EmptyPaths({ target }: { target: GraphResponse["target"] }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
      <CompanyLogo slug={target.slug} domain={target.domain} name={target.name} tier={target.tier} className="size-14" />
      <h2 className="font-serif text-2xl font-semibold tracking-tight">No paths mapped for {target.name} yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Interned here? Add where you came from or went next. Anonymous, takes a minute, and it builds the graph for the next intern.
      </p>
      <Link
        href={`/submit?company=${encodeURIComponent(target.name)}`}
        className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        + Add {target.name} Path
      </Link>
    </div>
  );
}
