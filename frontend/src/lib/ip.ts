import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

// Raw IPs are never stored or logged: salted SHA-256 only.
export function ipHash(req: NextRequest): string {
  const salt = process.env.IP_SALT;
  if (!salt) throw new Error("IP_SALT not set");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(salt + ip).digest("hex");
}

export function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  const got = req.headers.get("x-admin-secret");
  if (!secret || !got) return false;
  const a = createHash("sha256").update(secret).digest();
  const b = createHash("sha256").update(got).digest();
  return timingSafeEqual(a, b);
}
