/** Same mark as src/app/icon.svg (the favicon). Keep the two in sync. */
export function BrandLogo({ className = "size-6" }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <rect width="64" height="64" rx="15" fill="#1d4ed8" />
        <path d="M19 20 C32 20 30 32 43 32 M19 44 C32 44 30 32 43 32" stroke="#fff" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="17" cy="20" r="5.5" fill="#fff" />
        <circle cx="17" cy="44" r="5.5" fill="#fff" />
        <circle cx="46" cy="32" r="9.5" fill="#34d399" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">FeederGraph</span>
    </span>
  );
}
