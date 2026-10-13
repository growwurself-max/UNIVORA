const { supabaseAdmin } = require('../config/supabase');

// Audit entries are written with the service-role key (the audit_logs table has
// no INSERT policy for API roles), so they cannot be forged or tampered with by
// regular users. Failures are logged but never break the caller's request.
const logAction = async ({
  actorId = null,
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
  metadata = null,
  ip = null,
}) => {
  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
      metadata,
      ip,
    });

    if (error) {
      console.error('Failed to write audit log:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
    return false;
  }
};

module.exports = { logAction };
