import { NextResponse, type NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { submitSchema } from "@/lib/schemas";
import { ipHash } from "@/lib/ip";

const LIMIT_PER_HOUR = 5;

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) }, { status: 400 });
  }

  try {
    const db = supabaseService();
    const hash = ipHash(req);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: cErr } = await db
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", hash)
      .gte("created_at", since);
    if (cErr) throw cErr;
    if ((count ?? 0) >= LIMIT_PER_HOUR) {
      return NextResponse.json({ error: "rate limit: max 5 submissions per hour" }, { status: 429, headers: { "Retry-After": "3600" } });
    }

    const { error } = await db.from("submissions").insert({ ...parsed.data, ip_hash: hash, status: "pending" });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("submit route", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
