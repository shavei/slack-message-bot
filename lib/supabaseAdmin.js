import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/config";

let client;

export function supabaseAdmin() {
  if (!client) {
    const config = getSupabaseConfig();
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return client;
}