require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

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

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (nodeEnv === 'production' && (!corsOrigin || corsOrigin === '*' || corsOrigin.split(',').some((origin) => origin.trim() === '*'))) {
    errors.push('CORS_ORIGIN must contain explicit trusted origins in production; wildcard origins are not allowed.');
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
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  supabaseUrl: process.env.SUPABASE_URL.trim(),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY.trim(),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '*',
  isProduction: nodeEnv === 'production',
  demoEmail: process.env.DEMO_EMAIL?.trim(),
  demoPassword: process.env.DEMO_PASSWORD,
  geminiApiKey: process.env.GEMINI_API_KEY?.trim(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash',
};

module.exports = env;
