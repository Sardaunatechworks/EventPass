// ============================================================
// EventPass: src/services/supabase.js
// Supabase client singleton
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Config } from '../config.js';

let _client = null;

/**
 * Returns the Supabase client singleton.
 * Throws if credentials are not configured.
 */
export function getSupabaseClient() {
  if (_client) return _client;

  const { url, anonKey } = Config.supabase;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase credentials not configured. ' +
      'Add <meta name="supabase-url"> and <meta name="supabase-anon-key"> to your HTML.'
    );
  }

  _client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'eventpass_auth',
    },
    global: {
      headers: {
        'x-application-name': 'EventPass/1.0',
      },
    },
  });

  return _client;
}

/** Shorthand alias */
export const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabaseClient()[prop];
  },
});

export default supabase;
