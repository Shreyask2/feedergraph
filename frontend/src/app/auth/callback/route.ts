import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuth } from "@/lib/supabase/auth";

// GitHub OAuth (PKCE) lands here: exchange ?code for a session cookie, then go back.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const raw = searchParams.get("next") ?? "/submit";
  // only same-origin relative paths: blocks open redirects like //evil.com or /\evil.com
  const next = /^\/(?![/\\])/.test(raw) ? raw : "/submit";

  if (code) {
    const supabase = await supabaseAuth();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("auth callback", error.message);
  }
  return NextResponse.redirect(`${origin}/submit?auth=failed`);
}
