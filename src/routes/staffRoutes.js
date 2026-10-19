const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireCollegeAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { supabaseAdmin } = require('../config/supabase');
const auditService = require('../services/auditService');

const router = express.Router();

// Validation Rules
const staffValidation = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('full_name').trim().notEmpty().withMessage('Full name is required').isLength({ max: 200 }),
  body('role_id').isInt({ min: 1 }).withMessage('A valid role ID is required'),
];

const staffUpdateValidation = [
  body('full_name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('role_id').optional().isInt({ min: 1 }),
  body('institution_id').isUUID().withMessage('A valid institution ID is required'),
];

const assignmentValidation = [
  body('profile_id').isUUID().withMessage('A valid profile ID is required'),
  body('assignment_type').isIn(['department', 'class', 'subject', 'general']).withMessage('Invalid assignment type'),
  body('assignment_id').optional({ nullable: true }).isUUID().withMessage('Assignment ID must be a valid UUID'),
];

const ASSIGNABLE_STAFF_ROLES = [
  'Teacher',
  'Accountant',
  'Student Records Manager',
  'Office Staff',
  'Department Head',
  'Exam Coordinator',
];
const ASSIGNMENT_TABLES = {
  department: 'departments',
  class: 'classes',
  subject: 'subjects',
};

router.get('/roles', authenticate, requireCollegeAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('id, name, rank')
    .in('name', ASSIGNABLE_STAFF_ROLES)
    .order('rank', { ascending: false });

  if (error) throw error;
  res.status(200).json(new ApiResponse(200, 'Assignable staff roles retrieved', {
    roles: data || [],
  }));
}));

// 1. List Staff members for a specific institution
router.get('/', authenticate, requireCollegeAdmin, asyncHandler(async (req, res) => {
  const { search, role_id, page = 1, limit = 20 } = req.query;
  const institutionId = req.user.profile?.institution_id;

  if (!institutionId) throw new ApiError(400, 'User is not associated with any institution');

  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from('roles')
    .select('id, name')
    .in('name', ASSIGNABLE_STAFF_ROLES);
  if (rolesError) throw rolesError;

  const staffRoleIds = (roleRows || []).map((role) => role.id);
  if (!staffRoleIds.length) {
    return res.status(200).json(new ApiResponse(200, 'Staff members retrieved', {
      items: [],
      total: 0,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    }));
  }

  // Build query
  let query = supabaseAdmin
    .from('profiles')
    .select('*, roles(name, rank)')
    .eq('institution_id', institutionId)
    .in('role_id', staffRoleIds);

  if (search) {
    const term = String(search).replace(/[^a-zA-Z0-9 .@_-]/g, '').trim().slice(0, 100);
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  if (role_id) {
    query = query.eq('role_id', role_id);
  }

  const safePage = Math.max(1, parseInt(page, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const { data, error, count } = await query
    .order('full_name', { ascending: true })
    .range((safePage - 1) * safeLimit, safePage * safeLimit - 1);

  if (error) throw error;

  // Fetch assignments for these profiles
  const profileIds = data.map(p => p.id);
  let assignments = [];
  if (profileIds.length) {
    const { data, error: assError } = await supabaseAdmin
      .from('staff_assignments')
      .select('*')
      .in('profile_id', profileIds);

    if (assError) throw assError;
    assignments = data || [];
  }

  // Map assignments to profiles
  const result = data.map(profile => ({
    ...profile,
    assignments: assignments.filter(a => a.profile_id === profile.id)
  }));

  res.status(200).json(new ApiResponse(200, 'Staff members retrieved', {
    items: result,
    total: count || 0,
    page: safePage,
    limit: safeLimit
  }));
}));

// 2. Create Staff Account (Simplified: Creates profile, auth is handled via Supabase)
router.post('/', authenticate, requireCollegeAdmin, validate(staffValidation), asyncHandler(async (req, res) => {
  const { email, full_name, role_id } = req.body;
  const adminInstId = req.user.profile?.institution_id;

  if (!adminInstId) throw new ApiError(403, 'Your account is not associated with an institution');

  const { data: role, error: roleError } = await supabaseAdmin
    .from('roles')
    .select('id, name, rank')
    .eq('id', role_id)
    .maybeSingle();

  if (roleError) throw roleError;
  if (!role) throw new ApiError(400, 'Invalid role ID');
  if (role.rank >= 80 || !ASSIGNABLE_STAFF_ROLES.includes(role.name)) {
    throw new ApiError(403, 'This role cannot be assigned through staff management');
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id, institution_id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfileError) throw existingProfileError;

  let profileId = existingProfile?.id;
  if (existingProfile && existingProfile.institution_id !== adminInstId) {
    throw new ApiError(409, 'This email is already associated with another institution');
  }

  if (!profileId) {
    const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name: full_name },
    });
    if (inviteError) throw inviteError;
    profileId = invitation?.user?.id;
    if (!profileId) throw new ApiError(502, 'The staff invitation did not return a user account');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: profileId,
      email,
      full_name,
      role_id,
      institution_id: adminInstId,
    }, { onConflict: 'id' })
    .select('*, roles(name, rank)')
    .single();

  if (profileError) throw profileError;

  await auditService.logAction({
    actorId: req.user.id,
    action: 'staff.create',
    entityType: 'profile',
    entityId: profile.id,
    newValue: profile,
    ip: req.ip,
  });

  res.status(201).json(new ApiResponse(201, 'Staff account created/updated', profile));
}));

// 3. Update Staff Role and Details
router.patch('/:id', authenticate, requireCollegeAdmin, validate(staffUpdateValidation), asyncHandler(async (req, res) => {
  const profileId = req.params.id;
  const institutionId = req.user.profile?.institution_id;

  // Security: Ensure the profile belongs to the admin's institution
  const { data: profile, error: pError } = await supabaseAdmin
    .from('profiles')
    .select('institution_id')
    .eq('id', profileId)
    .single();

  if (pError || !profile) throw new ApiError(404, 'Staff member not found');
  if (profile.institution_id !== institutionId) {
    throw new ApiError(403, 'This staff member does not belong to your institution');
  }

  const { role_id, full_name } = req.body;
  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role_id !== undefined) {
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('rank, name')
      .eq('id', role_id)
      .maybeSingle();
    if (roleError) throw roleError;
    if (!role || role.rank >= 80 || !ASSIGNABLE_STAFF_ROLES.includes(role.name)) {
      throw new ApiError(403, 'This role cannot be assigned through staff management');
    }
    updates.role_id = role_id;
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(422, 'Provide a name or role to update');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw error;

  res.status(200).json(new ApiResponse(200, 'Staff member updated', data));
}));

// 4. Manage Responsibilities (Assignments)
router.post('/assignments', authenticate, requireCollegeAdmin, validate(assignmentValidation), asyncHandler(async (req, res) => {
  const { profile_id, assignment_type } = req.body;
  const assignmentId = assignment_type === 'general' ? null : req.body.assignment_id;
  const adminInstId = req.user.profile?.institution_id;

  if (!adminInstId) throw new ApiError(403, 'Your account is not associated with an institution');
  if (assignment_type !== 'general' && !assignmentId) {
    throw new ApiError(422, 'An entity ID is required for this responsibility type');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('institution_id')
    .eq('id', profile_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.institution_id !== adminInstId) {
    throw new ApiError(404, 'Staff member not found in your institution');
  }

  if (assignment_type !== 'general') {
    const table = ASSIGNMENT_TABLES[assignment_type];
    const { data: entity, error: entityError } = await supabaseAdmin
      .from(table)
      .select('institution_id')
      .eq('id', assignmentId)
      .maybeSingle();
    if (entityError) throw entityError;
    if (!entity || entity.institution_id !== adminInstId) {
      throw new ApiError(404, 'Assigned entity not found in your institution');
    }
  }

  let existingQuery = supabaseAdmin
    .from('staff_assignments')
    .select('id')
    .eq('profile_id', profile_id)
    .eq('assignment_type', assignment_type);
  existingQuery = assignmentId
    ? existingQuery.eq('assignment_id', assignmentId)
    : existingQuery.is('assignment_id', null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;

  const saveQuery = existing
    ? supabaseAdmin.from('staff_assignments').update({ institution_id: adminInstId }).eq('id', existing.id)
    : supabaseAdmin.from('staff_assignments').insert({
        profile_id,
        institution_id: adminInstId,
        assignment_type,
        assignment_id: assignmentId,
      });
  const { data, error } = await saveQuery.select('*').single();

  if (error) throw error;

  res.status(201).json(new ApiResponse(201, 'Responsibility assigned', data));
}));

router.delete('/assignments/:id', authenticate, requireCollegeAdmin, asyncHandler(async (req, res) => {
  const assignmentId = req.params.id;

  const { data: assignment, error: aError } = await supabaseAdmin
    .from('staff_assignments')
    .select('institution_id')
    .eq('id', assignmentId)
    .single();

  if (aError || !assignment) throw new ApiError(404, 'Assignment not found');
  if (assignment.institution_id !== req.user.profile?.institution_id) {
    throw new ApiError(403, 'Forbidden: Assignment belongs to another institution');
  }

  const { error } = await supabaseAdmin.from('staff_assignments').delete().eq('id', assignmentId);
  if (error) throw error;

  res.status(200).json(new ApiResponse(200, 'Responsibility removed'));
}));

module.exports = router;
