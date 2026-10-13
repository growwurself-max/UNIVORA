require('dotenv').config();

const validateEnv = () => {
  const errors = [];

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    errors.push(
      'SUPABASE_URL is required.',
      'Set it to your Supabase project URL in .env',
      'Example: https://your-project-id.supabase.co'
    );
  } else if (!/^https?:\/\//.test(supabaseUrl)) {
    errors.push(
      'SUPABASE_URL must be a valid URL starting with http:// or https://',
      'Use your Supabase project URL from the Supabase dashboard'
    );
  }

  if (!supabaseAnonKey) {
    errors.push('SUPABASE_ANON_KEY is required. Set your Supabase anon/public key in .env');
  }

  if (!supabaseServiceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required. Set your Supabase service role key in .env');
  }

  if (errors.length > 0) {
    console.error('\nUnivora API startup failed — configuration error:\n');
    errors.forEach((message) => console.error(`  • ${message}`));
    console.error('\nCopy .env.example to .env and configure your Supabase credentials.\n');
    process.exit(1);
  }
};

validateEnv();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  supabaseUrl: process.env.SUPABASE_URL.trim(),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY.trim(),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = env;
