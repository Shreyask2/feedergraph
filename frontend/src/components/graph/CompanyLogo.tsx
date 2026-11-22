"use client";

import { useState } from "react";
import { initials, tierColor } from "@/lib/labels";

function sources(slug: string, domain?: string | null): string[] {
  const d = domain || `${slug.replace(/-/g, "")}.com`;
  return [`https://logo.clearbit.com/${d}`, `https://icons.duckduckgo.com/ip3/${d}.ico`];
}

// Official multicolor "G" (inline: crisp at any size, no network, never a globe).
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

interface Props {
  slug: string;
  /** Real domain from canonical_entities.domain; inferred as `<slug>.com` when null. */
  domain?: string | null;
  name: string;
  tier: string;
  /** Tailwind size class for the tile, e.g. "size-8" */
  className?: string;
}

/** Brand mark straight on the light card: Clearbit, then DuckDuckGo, then to a tier-tinted initial badge. */
export function CompanyLogo({ slug, domain, name, tier, className = "size-8" }: Props) {
  const srcs = slug === "google" ? [] : sources(slug, domain);
  const [i, setI] = useState(0);
  const c = tierColor(tier);

  const tile = "flex shrink-0 items-center justify-center overflow-hidden rounded-md p-0.5";
  if (slug === "google") {
    return (
      <span className={`${className} ${tile}`}>
        <GoogleG />
      </span>
    );
  }
  if (i >= srcs.length) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-md border text-[0.7em] font-semibold`}
        style={{ color: c, borderColor: `${c}66`, background: `${c}14` }}
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <span className={`${className} ${tile}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny external icons; next/image would need remotePatterns + adds nothing */}
      <img
        key={srcs[i]}
        src={srcs[i]}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-full min-w-0 object-contain"
        onError={() => setI((n) => n + 1)}
        // Some icon hosts answer unknown domains with a tiny placeholder instead of an error.
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth < 16) setI((n) => n + 1);
        }}
      />
    </span>
  );
}
