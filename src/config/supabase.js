const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
  },
});

// Creates a client that runs every query under the caller's JWT so that
// PostgreSQL RLS is enforced on behalf of the authenticated user.
const createUserClient = (accessToken) =>
  createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

module.exports = { supabase, supabaseAdmin, createUserClient };
