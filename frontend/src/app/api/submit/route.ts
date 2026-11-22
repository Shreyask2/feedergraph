import { NextResponse, after, type NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { githubIdentity, supabaseAuth } from "@/lib/supabase/auth";
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
    // GitHub identity comes only from the verified OAuth session, never the request body.
    const { data: auth } = await (await supabaseAuth()).auth.getUser();
    const gh = githubIdentity(auth.user);

    const db = supabaseService();
    if (gh) {
      const { count: dup, error: dErr } = await db
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("github_user_id", gh.id)
        .eq("internship_season", parsed.data.internship_season);
      if (dErr) throw dErr;
      if ((dup ?? 0) > 0) {
        return NextResponse.json({ error: `@${gh.handle} already submitted for ${parsed.data.internship_season}` }, { status: 409 });
      }
    }
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

    const { error } = await db.from("submissions").insert({
      ...parsed.data,
      github_username: gh?.handle ?? null,
      github_user_id: gh?.id ?? null,
      ip_hash: hash,
      status: "pending",
    });
    // 23505: unique (github_user_id, internship_season) lost a race with a concurrent submit
    if (error?.code === "23505") return NextResponse.json({ error: "already submitted for this season" }, { status: 409 });
    if (error) throw error;

    // Fire-and-forget pipeline trigger; a GitHub hiccup must never fail the submission.
    const { GITHUB_REPO, GITHUB_DISPATCH_TOKEN } = process.env;
    if (GITHUB_REPO && GITHUB_DISPATCH_TOKEN) {
      // after() keeps the serverless function alive until the dispatch finishes.
      after(() =>
        fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/pipeline.yml/dispatches`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: "main" }),
        }).catch((e) => console.error("pipeline dispatch", e)),
      );
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("submit route", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
