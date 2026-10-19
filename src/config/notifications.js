const NOTIFICATIONS = {
  table: 'notifications',
  select:
    'id, institution_id, recipient_id, sender_id, type, title, message, data, is_read, read_at, related_entity_type, related_entity_id, created_at, updated_at, recipient:profiles!recipient_id(full_name,email), sender:profiles!sender_id(full_name,email)',
  searchable: ['title', 'message'],
  filters: ['type', 'is_read', 'recipient_id'],
  fields: {
    recipient_id: { type: 'uuid', required: true },
    sender_id: { type: 'uuid' },
    type: { type: 'enum', values: ['low_attendance', 'upcoming_exam', 'overdue_fees', 'admin_update', 'general'], required: true },
    title: { type: 'string', required: true, max: 200 },
    message: { type: 'string', required: true, max: 1000 },
    data: { type: 'string' },
    is_read: { type: 'boolean', default: false },
    related_entity_type: { type: 'string', max: 50 },
    related_entity_id: { type: 'uuid' },
  },
};

module.exports = { NOTIFICATIONS };
