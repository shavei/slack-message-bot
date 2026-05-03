import { createClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";

let client;

export function supabaseAdmin() {
  if (!client) {
    const config = getConfig();
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return client;
}
