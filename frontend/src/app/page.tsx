import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import Explorer from "./Explorer";

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const c = (await searchParams).company;
  const slug = (Array.isArray(c) ? c[0] : c)?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return {};
  const image = `/api/og?company=${slug}`;
  return {
    openGraph: { images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

// Marks the route dynamic so generateMetadata may read searchParams (cacheComponents).
async function Dynamic() {
  await connection();
  return null;
}

export default function Page() {
  return (
    <>
      <Suspense>
        <Dynamic />
      </Suspense>
      <Explorer />
    </>
  );
}
