const { createUserClient } = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { INSTITUTION_SETTINGS, USER_PREFERENCES } = require('../config/settings');

const parseObject = (value, field) => {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new ApiError(422, `${field} must contain valid JSON`);
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(422, `${field} must be a JSON object`);
  }
  return parsed;
};

const getInstitutionSettings = async ({ accessToken }) => {
  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase.from(INSTITUTION_SETTINGS.table).select(INSTITUTION_SETTINGS.select).maybeSingle();
  if (error) throw error;
  return data;
};

const upsertInstitutionSettings = async ({ accessToken, payload }) => {
  const supabase = createUserClient(accessToken);
  const settings = parseObject(payload?.settings, 'settings');
  const { data, error } = await supabase
    .from(INSTITUTION_SETTINGS.table)
    .upsert({ settings }, { onConflict: 'institution_id' })
    .select(INSTITUTION_SETTINGS.select)
    .single();
  if (error) throw error;
  return data;
};

const getUserPreferences = async ({ accessToken }) => {
  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase.from(USER_PREFERENCES.table).select(USER_PREFERENCES.select).maybeSingle();
  if (error) throw error;
  return data;
};

const upsertUserPreferences = async ({ accessToken, profileId, payload }) => {
  const supabase = createUserClient(accessToken);
  const preferences = parseObject(payload?.preferences, 'preferences');
  const { data, error } = await supabase
    .from(USER_PREFERENCES.table)
    .upsert({ profile_id: profileId, preferences }, { onConflict: 'profile_id' })
    .select(USER_PREFERENCES.select)
    .single();
  if (error) throw error;
  return data;
};

module.exports = { getInstitutionSettings, upsertInstitutionSettings, getUserPreferences, upsertUserPreferences };
