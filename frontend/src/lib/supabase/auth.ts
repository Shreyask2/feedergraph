import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

// Cookie-bound server client for the signed-in user's session (route handlers only).
export async function supabaseAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component: cookies are read-only there; safe to ignore
        }
      },
    },
  });
}

/** GitHub handle + numeric id from the OAuth identity, or null if not signed in with GitHub. */
export function githubIdentity(user: User | null): { handle: string; id: number } | null {
  const ident = user?.identities?.find((i) => i.provider === "github");
  const data = ident?.identity_data ?? {};
  const handle = (data.user_name ?? data.preferred_username) as string | undefined;
  const id = Number(data.provider_id ?? ident?.id);
  return handle && Number.isSafeInteger(id) && id > 0 ? { handle, id } : null;
}
