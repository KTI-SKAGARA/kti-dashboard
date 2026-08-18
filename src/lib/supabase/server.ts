import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createClient() {
  const cookieStore = await cookies();

  if (!SUPABASE_CONFIGURED) {
    throw new Error("Supabase belum dikonfigurasi. Set env vars di Vercel Dashboard.");
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll dipanggil dari Server Component — ignore
          }
        },
      },
    }
  );
}
