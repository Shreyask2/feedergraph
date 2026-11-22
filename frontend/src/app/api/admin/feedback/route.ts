import { NextResponse, type NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/ip";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { data, error } = await supabaseService()
      .from("feedback")
      .select("id,category,message,page_context,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ feedback: data });
  } catch (e) {
    console.error("admin feedback", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
