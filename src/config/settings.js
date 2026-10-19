const INSTITUTION_SETTINGS = {
  table: 'institution_settings',
  select: 'id, institution_id, settings, created_at, updated_at',
  fields: {
    settings: { type: 'string' },
  },
};

const USER_PREFERENCES = {
  table: 'user_preferences',
  select: 'id, institution_id, profile_id, preferences, created_at, updated_at',
  fields: {
    preferences: { type: 'string' },
  },
};

module.exports = { INSTITUTION_SETTINGS, USER_PREFERENCES };
