import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client dengan service_role key — HANYA untuk server actions.
 * Jangan pernah import di client components!
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
