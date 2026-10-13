/* eslint-disable no-console */
// Promotes an existing Supabase auth user to the platform-level `super_admin`
// role using the service-role key. Run this once after applying the Phase 1
// migration to bootstrap the first platform administrator.
//
//   npm run promote:super-admin -- admin@example.com [full name]

require('../src/config/env');
const { supabaseAdmin } = require('../src/config/supabase');

const email = (process.argv[2] || '').trim().toLowerCase();
const fullName = (process.argv[3] || '').trim() || null;

const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

(async () => {
  if (!email) {
    fail('Usage: npm run promote:super-admin -- <email> [full name]');
  }

  const { data: superAdminRole, error: roleError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'super_admin')
    .maybeSingle();

  if (roleError) {
    fail(`Could not read roles: ${roleError.message}. Have the Phase 1 migrations been applied?`);
  }
  if (!superAdminRole) {
    fail('The "super_admin" role does not exist. Apply supabase/migrations/20261013000001_phase0_phase1_core.sql first.');
  }

  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    fail(`Could not list users: ${listError.message}`);
  }

  const user = usersData?.users?.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) {
    fail(`No auth user found for "${email}". Register the account first, then run this again.`);
  }

  const { error: upsertError } = await supabaseAdmin.from('profiles').upsert(
    {
      id: user.id,
      institution_id: null,
      role_id: superAdminRole.id,
      full_name: fullName,
      email: user.email,
    },
    { onConflict: 'id' }
  );

  if (upsertError) {
    fail(`Failed to promote user: ${upsertError.message}`);
  }

  console.log(`\nSuccess: ${email} is now a platform super administrator.\n`);
})();