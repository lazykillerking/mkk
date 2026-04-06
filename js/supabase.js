import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// The generated env script exposes only safe public values on window for browser use.
const publicEnv = window.__PUBLIC_ENV__ || {};

// Keeping the names explicit avoids confusion with private server-side environment variables.
const supabaseUrl = publicEnv.SUPABASE_URL || "";
const supabaseAnonKey = publicEnv.SUPABASE_ANON_KEY || "";

// Static frontends can only use the public anon key; service-role secrets must never be shipped.
const missingConfig = [];
if (!supabaseUrl) {
  missingConfig.push("SUPABASE_URL");
}
if (!supabaseAnonKey) {
  missingConfig.push("SUPABASE_ANON_KEY");
}

// The shared storage key ensures all pages read the same persisted auth session.
export const supabase = missingConfig.length === 0
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "mkk-auth"
    }
  })
  : null;

// A reusable helper gives callers a consistent way to fail when config has not been generated yet.
export function requireSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  throw new Error(
    "Supabase public config is missing. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env, then run `npm run sync:env`."
  );
}

// Pages can use this to surface a friendly setup message instead of a generic stack trace.
export function getSupabaseConfigError() {
  if (missingConfig.length === 0) {
    return "";
  }

  return "Missing public config: " + missingConfig.join(", ") + ". Run `npm run sync:env` after updating .env.";
}
