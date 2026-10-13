const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');

const getHealth = asyncHandler(async (req, res) => {
  // Probe a real table (created by the Phase 0 migrations) with a cheap
  // head/count request instead of the non-existent `_health` table.
  const { error } = await supabaseAdmin.from('institutions').select('id').limit(1);

  const database = error ? 'disconnected' : 'connected';

  res.status(200).json(
    new ApiResponse(200, 'Univora API is running', {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database,
      ...(!env.isProduction && error ? { databaseError: error.message } : {}),
    })
  );
});

module.exports = { getHealth };
