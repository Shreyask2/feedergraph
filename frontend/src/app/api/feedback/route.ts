import { NextResponse, type NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { feedbackSchema } from "@/lib/schemas";
import { githubIdentity, supabaseAuth } from "@/lib/supabase/auth";
import { ipHash } from "@/lib/ip";

const LIMIT_PER_HOUR = 5;

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = feedbackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "message must be 5–1000 characters" }, { status: 400 });
  }
  try {
    const db = supabaseService();
    const hash = ipHash(req);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: cErr } = await db
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", hash)
      .gte("created_at", since);
    if (cErr) throw cErr;
    if ((count ?? 0) >= LIMIT_PER_HOUR) {
      return NextResponse.json({ error: "rate limit: max 5 per hour" }, { status: 429, headers: { "Retry-After": "3600" } });
    }
    // GitHub handle comes only from the verified OAuth session, never the request body.
    const { data: auth } = await (await supabaseAuth()).auth.getUser();
    const { contact, ...rest } = parsed.data;
    const { error } = await db.from("feedback").insert({
      ...rest,
      contact: contact || null,
      github_username: githubIdentity(auth.user)?.handle ?? null,
      ip_hash: hash,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("feedback route", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
