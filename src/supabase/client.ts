// Supabase client — single instance for the whole app.
//
// Why this lives in its own module: every CRUD function in queries.ts
// imports `supabase` from here. Centralising the construction means
// we configure auth, persist-session, etc. in exactly one place.
//
// The credentials are public-by-design (the anon key is meant to ship
// to the browser; security is enforced by Row Level Security policies
// on the database side). They come from Vite env vars rather than
// being hard-coded so the same source builds against different
// projects (e.g. a future staging project) without code changes.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surface a clear error during boot rather than letting the first
  // CRUD call fail with a cryptic "fetch failed" later.
  throw new Error(
    'Supabase credentials missing. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (local) or as GitHub ' +
      'Actions secrets (deployed).',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // We have no user accounts, so don't try to persist or refresh
    // any session. Keeps the network panel quiet.
    persistSession: false,
    autoRefreshToken: false,
  },
});