import { NextResponse, type NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { resolveSchema, normalize, slugify } from "@/lib/schemas";
import { isAdmin } from "@/lib/ip";

const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

// Moderation queue: flagged submissions + entities to map onto.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const db = supabaseService();
    const [subs, ents] = await Promise.all([
      db.from("submissions")
        .select("id,target_company_raw,prior_experiences_raw,flag_reason,created_at")
        .eq("status", "flagged")
        .order("created_at")
        .limit(100),
      db.from("canonical_entities").select("id,name").order("name"),
    ]);
    if (subs.error) throw subs.error;
    if (ents.error) throw ents.error;
    return NextResponse.json({ submissions: subs.data, entities: ents.data });
  } catch (e) {
    console.error("admin queue", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

// Approve a flagged string: map to existing entity or create a new one, then requeue as pending.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = resolveSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "validation failed" }, { status: 400 });
  const v = parsed.data;
  const alias = normalize(v.raw);
  if (!alias) return NextResponse.json({ error: "empty alias" }, { status: 400 });

  try {
    const db = supabaseService();
    let entityId = v.entity_id;
    if (v.action === "new") {
      const slug = slugify(v.new_name!);
      if (!slug) return NextResponse.json({ error: "name needs latin letters or digits for a slug" }, { status: 400 });
      const { data, error } = await db
        .from("canonical_entities")
        .insert({ name: v.new_name!, slug, entity_type: v.entity_type!, tier: v.tier ?? "standard" })
        .select("id")
        .single();
      if (error) {
        const dup = error.code === "23505";
        return NextResponse.json({ error: dup ? "entity name/slug already exists; use map" : "insert failed" }, { status: dup ? 409 : 500 });
      }
      entityId = data.id;
    }

    const { error: aErr } = await db
      .from("entity_aliases")
      .upsert({ alias, entity_id: entityId, match_method: "admin", confidence: 1, is_verified: true }, { onConflict: "alias" });
    if (aErr) {
      // 23503 = entity_id FK violation (bad entity_id)
      return NextResponse.json({ error: aErr.code === "23503" ? "entity not found" : "alias upsert failed" }, { status: aErr.code === "23503" ? 404 : 500 });
    }

    const { error: sErr } = await db
      .from("submissions")
      .update({ status: "pending", flag_reason: null })
      .eq("id", v.submission_id)
      .eq("status", "flagged");
    if (sErr) throw sErr;
    return NextResponse.json({ ok: true, alias, entity_id: entityId });
  } catch (e) {
    console.error("admin resolve", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
