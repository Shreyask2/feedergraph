import { createBrowserClient } from "@supabase/ssr";

// Browser client: only used for GitHub OAuth sign-in/out. Session lives in cookies.
export function supabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
