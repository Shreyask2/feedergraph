/** Same mark as src/app/icon.svg (the favicon). Keep the two in sync. */
export function BrandLogo({ className = "size-5" }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <rect width="64" height="64" rx="14" fill="#09090b" />
        <path d="M17 20 L40 32 M17 44 L40 32" stroke="#52525b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M34 26.5 L41 32 L34 37.5" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="14" cy="19" r="5" fill="#09090b" stroke="#a1a1aa" strokeWidth="2.5" />
        <circle cx="14" cy="45" r="5" fill="#09090b" stroke="#a1a1aa" strokeWidth="2.5" />
        <circle cx="48" cy="32" r="9" fill="#34d399" />
        <circle cx="48" cy="32" r="13" fill="none" stroke="#38bdf8" strokeOpacity=".55" strokeWidth="1.5" />
      </svg>
      <span className="font-mono text-sm font-bold tracking-tight">FEEDERGRAPH</span>
    </span>
  );
}
