const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { auth } = require('../database/firebase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const parityService = require('../services/mobile-parity.service');
const notificationService = require('../services/notification.service');
const { recordAudit } = require('../services/audit.service');
const { revokeUserSessions, invalidateLiveUser } = require('../services/session-guard.service');
const { toSafeCsv } = require('../utils/csv.util');
const {
  createRecord,
  listRecords,
  getRecord,
  updateRecord,
  deleteRecord,
  countRecords,
  isValidDocId
} = require('../services/firebase-data.service');

const MAX_PAGE_SIZE = 5000;
const IN_QUERY_CHUNK = 30;
const ROLES = ['student', 'teacher', 'admin'];
const REGISTRATION_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    registration_number: user.registration_number,
    email: user.email,
    phone_number: user.phone_number || null,
    role: user.role,
    department: user.department || null,
    year: user.year ?? null,
    section: user.section || null,
    is_active: user.is_active !== false,
    created_at: user.created_at || null
  };
}

async function findUserOr404(req, res) {
  const user = isValidDocId(req.params.id) ? await getRecord('users', req.params.id) : null;
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return null;
  }
  return user;
}

/**
 * Is `user` the only remaining active admin?
 */
async function isLastActiveAdmin(user) {
  if (user.role !== 'admin' || user.is_active === false) return false;
  const admins = await countRecords('users', { filters: [{ field: 'role', value: 'admin' }] });
  if (admins <= 1) return true;
  const inactiveAdmins = await countRecords('users', {
    filters: [{ field: 'role', value: 'admin' }, { field: 'is_active', value: false }]
  });
  return admins - inactiveAdmins <= 1;
}

/**
 * Apply an activation change with the same rules for every endpoint that can do it.
 * Returns { error: {status, message} } or { user }.
 */
async function applyActiveState(req, user, isActive) {
  if (!isActive) {
    if (String(user.id) === String(req.user.id)) {
      return { error: { status: 409, message: 'You cannot deactivate your own account' } };
    }
    if (await isLastActiveAdmin(user)) {
      return { error: { status: 409, message: 'The last active administrator cannot be deactivated' } };
    }
  }

  await updateRecord('users', user.id, { is_active: isActive });
  if (!isActive) {
    // Also end any session issued so far, so re-activating later cannot revive old tokens.
    await revokeUserSessions(user.id);
  }
  invalidateLiveUser(user.id);

  await recordAudit(req, {
    action: isActive ? 'user_activate' : 'user_deactivate',
    entityType: 'user',
    entityId: user.id,
    summary: `${user.name || user.id} (${user.registration_number || user.id})`
  });

  return { user: { ...user, is_active: isActive } };
}

// Departments statistics
router.get('/departments', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const users = await listRecords('users');
    const grouped = new Map();

    for (const user of users) {
      if (!user.department) continue;
      if (!grouped.has(user.department)) {
        grouped.set(user.department, {
          code: user.department,
          name: user.department,
          hod: null,
          total_students: 0,
          total_teachers: 0,
          active_courses: 0
        });
      }

      const item = grouped.get(user.department);
      if (user.role === 'student') item.total_students += 1;
      if (user.role === 'teacher') {
        item.total_teachers += 1;
        if (!item.hod) {
          item.hod = user.name || null;
        }
      }
    }

    res.json({
      success: true,
      data: Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name))
    });
  } catch (error) {
    next(error);
  }
});

// Dashboard statistics
router.get('/stats', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    // Server-side counts: no collection is downloaded for a number on a dashboard.
    const [
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalFiles,
      totalAssignments,
      totalEvents,
      cancelledEvents,
      attendanceTotal,
      attendancePresent,
      announcements,
      users
    ] = await Promise.all([
      countRecords('users', { filters: [{ field: 'role', value: 'student' }] }),
      countRecords('users', { filters: [{ field: 'role', value: 'teacher' }] }),
      countRecords('users', { filters: [{ field: 'role', value: 'admin' }] }),
      countRecords('files'),
      countRecords('assignments'),
      countRecords('events'),
      countRecords('events', { filters: [{ field: 'is_active', value: false }] }),
      countRecords('attendance'),
      countRecords('attendance', { filters: [{ field: 'status', op: 'in', value: ['present', 'late'] }] }),
      parityService.getAnnouncements(),
      listRecords('users')
    ]);

    const departmentCounts = new Map();
    for (const user of users) {
      if (user.department) departmentCounts.set(user.department, (departmentCounts.get(user.department) || 0) + 1);
    }

    // Real figure, or null when nothing has been recorded yet (never an invented number).
    const avgAttendance = attendanceTotal > 0
      ? Number(((attendancePresent * 100) / attendanceTotal).toFixed(1))
      : null;

    const data = {
      total_departments: departmentCounts.size,
      total_students: totalStudents,
      total_teachers: totalTeachers,
      total_admins: totalAdmins,
      total_files: totalFiles,
      total_assignments: totalAssignments,
      total_events: Math.max(0, totalEvents - cancelledEvents),
      total_announcements: announcements.length
    };

    res.json({
      success: true,
      data: {
        ...data,
        totalDepartments: data.total_departments,
        totalStudents: data.total_students,
        totalTeachers: data.total_teachers,
        totalAdmins: data.total_admins,
        totalFiles: data.total_files,
        totalAssignments: data.total_assignments,
        totalEvents: data.total_events,
        totalAnnouncements: data.total_announcements,
        avgAttendance,
        departments: Array.from(departmentCounts.entries())
          .map(([name, total]) => ({ name, total }))
          .sort((left, right) => left.name.localeCompare(right.name))
      }
    });
  } catch (error) {
    next(error);
  }
});

// User management: search, filter, paginate, export
router.get('/users', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { role, department, status, q, format } = req.query;
    const pageNum = Math.max(1, Math.floor(toNumber(req.query.page, 1)));
    const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(toNumber(req.query.limit, 50))));

    if (role && !ROLES.includes(String(role))) {
      return res.status(400).json({ success: false, message: `role must be one of ${ROLES.join(', ')}` });
    }
    if (status && !['active', 'inactive'].includes(String(status))) {
      return res.status(400).json({ success: false, message: 'status must be active or inactive' });
    }

    const filters = [];
    if (role) filters.push({ field: 'role', value: String(role) });
    if (department) filters.push({ field: 'department', value: String(department) });

    let users = await listRecords('users', {
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    if (status === 'active') users = users.filter((user) => user.is_active !== false);
    if (status === 'inactive') users = users.filter((user) => user.is_active === false);

    const needle = typeof q === 'string' ? q.trim().toLowerCase() : '';
    if (needle) {
      users = users.filter((user) => [user.name, user.registration_number, user.email]
        .some((field) => String(field || '').toLowerCase().includes(needle)));
    }

    if (format === 'csv') {
      const columns = ['registration_number', 'name', 'email', 'role', 'department', 'year', 'section', 'phone_number', 'status', 'created_at'];
      const rows = users.map((user) => ({ ...publicUser(user), status: user.is_active === false ? 'inactive' : 'active' }));

      await recordAudit(req, {
        action: 'user_export',
        entityType: 'user',
        summary: `${rows.length} users exported`,
        metadata: { role: role || null, department: department || null, status: status || null, q: needle || null }
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      return res.send(toSafeCsv(rows, columns));
    }

    const total = users.length;
    const offset = (pageNum - 1) * limitNum;

    res.json({
      success: true,
      data: users.slice(offset, offset + limitNum).map(publicUser),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/users', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const {
      name,
      registration_number,
      email,
      password,
      phone_number,
      department,
      year,
      section,
      role
    } = req.body || {};

    if (!name || !registration_number || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, registration_number, password and role are required' });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be one of student, teacher, admin' });
    }

    if (!REGISTRATION_NUMBER_PATTERN.test(String(registration_number))) {
      return res.status(400).json({
        success: false,
        message: 'registration_number must be 3-40 letters, digits, hyphens or underscores'
      });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ success: false, message: 'password must be 8-128 characters' });
    }

    if (email && !EMAIL_PATTERN.test(String(email))) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const parsedYear = year === undefined || year === null || year === '' ? null : Number(year);
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 6)) {
      return res.status(400).json({ success: false, message: 'year must be a whole number between 1 and 6' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const payload = {
      name: String(name).trim(),
      registration_number: String(registration_number),
      email: email || null,
      password: hashedPassword,
      phone_number: phone_number || null,
      department: department || null,
      year: parsedYear,
      section: section || null,
      role,
      is_active: true,
      last_login: null
    };

    // `exclusive` makes "create if absent" atomic: two admins submitting the
    // same registration number cannot both succeed.
    try {
      await createRecord('users', payload, { id: String(registration_number), exclusive: true });
    } catch (createError) {
      if (createError?.code === 6 || /ALREADY_EXISTS/i.test(createError?.message || '')) {
        return res.status(409).json({ success: false, message: 'User already exists' });
      }
      throw createError;
    }

    if (email) {
      try {
        await auth.createUser({
          uid: String(registration_number),
          email,
          password
        });
      } catch (authError) {
        console.warn('Failed to create Firebase Auth user for admin-created account:', authError.message);
      }
    }

    await recordAudit(req, {
      action: 'user_create',
      entityType: 'user',
      entityId: registration_number,
      summary: `${payload.name} (${role})`,
      metadata: { role, department: payload.department }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: String(registration_number) }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id/toggle-active', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const user = await findUserOr404(req, res);
    if (!user) return;

    const result = await applyActiveState(req, user, user.is_active === false);
    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }

    res.json({ success: true, message: 'User status updated', isActive: result.user.is_active });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/status', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { isActive } = req.body || {};

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
    }

    const user = await findUserOr404(req, res);
    if (!user) return;

    const result = await applyActiveState(req, user, isActive);
    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }

    res.json({ success: true, isActive });
  } catch (error) {
    next(error);
  }
});

// Force a user to sign in again on every device
router.post('/users/:id/revoke-sessions', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const user = await findUserOr404(req, res);
    if (!user) return;

    const revokedAt = await revokeUserSessions(user.id);

    await recordAudit(req, {
      action: 'user_revoke_sessions',
      entityType: 'user',
      entityId: user.id,
      summary: `${user.name || user.id} signed out everywhere`
    });

    res.json({ success: true, message: 'All sessions for this user have been ended', data: { revokedAt } });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { name, email, role, department } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      }
      updates.name = String(name).trim();
    }

    if (email !== undefined) {
      if (!EMAIL_PATTERN.test(String(email))) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }
      updates.email = String(email);
    }

    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: 'Role must be one of student, teacher, admin' });
      }
      updates.role = role;
    }

    if (department !== undefined) {
      updates.department = department || null;
    }

    const user = await findUserOr404(req, res);
    if (!user) return;

    if (updates.role && updates.role !== user.role && user.role === 'admin') {
      if (String(user.id) === String(req.user.id)) {
        return res.status(409).json({ success: false, message: 'You cannot remove your own administrator role' });
      }
      if (await isLastActiveAdmin(user)) {
        return res.status(409).json({ success: false, message: 'The last active administrator cannot be demoted' });
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateRecord('users', user.id, updates);
      invalidateLiveUser(user.id);

      await recordAudit(req, {
        action: updates.role && updates.role !== user.role ? 'user_role_change' : 'user_update',
        entityType: 'user',
        entityId: user.id,
        summary: `${user.name || user.id}`,
        metadata: {
          before: Object.fromEntries(Object.keys(updates).map((key) => [key, user[key] ?? null])),
          after: updates
        }
      });
    }

    res.json({ success: true, data: publicUser({ ...user, ...updates }) });
  } catch (error) {
    next(error);
  }
});

// Approvals queue
router.get('/approvals', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const files = await listRecords('files', {
      filters: [{ field: 'approved', value: false }],
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    // Rejected files keep approved=false forever - exclude them from the queue
    const pending = files.filter((file) => file.status !== 'rejected').slice(0, 100);

    // Only the uploaders of the files on screen are looked up.
    const uploaderIds = Array.from(new Set(pending.map((file) => file.uploaded_by).filter(Boolean).map(String)));
    const userNameById = new Map();
    for (let index = 0; index < uploaderIds.length; index += IN_QUERY_CHUNK) {
      const found = await listRecords('users', {
        filters: [{ field: 'id', op: 'in', value: uploaderIds.slice(index, index + IN_QUERY_CHUNK) }]
      });
      found.forEach((user) => userNameById.set(user.id, user.name));
    }

    res.json({
      success: true,
      data: pending.map((file) => ({
        ...file,
        uploaded_by_name: userNameById.get(file.uploaded_by) || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post('/approvals/:id/reject', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const file = await getRecord('files', req.params.id);

    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const reason = (req.body && req.body.reason) || null;

    await updateRecord('files', req.params.id, {
      approved: false,
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString()
    });

    await recordAudit(req, {
      action: 'file_reject',
      entityType: 'file',
      entityId: req.params.id,
      summary: file.original_name || req.params.id,
      metadata: { reason }
    });

    try {
      await notificationService.create({
        userId: file.uploaded_by,
        title: 'File Rejected',
        message: `Your file "${file.original_name}" was rejected by a moderator.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'file',
        link: '/dashboard/files.html',
        metadata: { fileId: req.params.id, reason }
      });
    } catch (_) {
      void 0;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Activity logs: filter by who / what / when, with paging and CSV export
router.get('/activity-log', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { action, user_id: userId, entity_type: entityType, from, to, format } = req.query;
    const pageNum = Math.max(1, Math.floor(toNumber(req.query.page, 1)));
    const limitNum = Math.min(1000, Math.max(1, Math.floor(toNumber(req.query.limit, 100))));

    const filters = [];
    if (action) filters.push({ field: 'action', value: String(action) });
    if (userId) filters.push({ field: 'user_id', value: String(userId) });
    if (entityType) filters.push({ field: 'entity_type', value: String(entityType) });

    const fromTime = from ? Date.parse(from) : null;
    const toTime = to ? Date.parse(to) : null;
    if ((from && Number.isNaN(fromTime)) || (to && Number.isNaN(toTime))) {
      return res.status(400).json({ success: false, message: 'from and to must be valid dates' });
    }
    if (fromTime !== null) filters.push({ field: 'created_at', op: '>=', value: new Date(fromTime).toISOString() });
    // A bare date ("2025-11-03") as `to` should include that whole day.
    if (toTime !== null) {
      const inclusiveEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(to)) ? toTime + 24 * 60 * 60 * 1000 - 1 : toTime;
      filters.push({ field: 'created_at', op: '<=', value: new Date(inclusiveEnd).toISOString() });
    }

    const logs = await listRecords('activity_log', {
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    const total = logs.length;
    const offset = (pageNum - 1) * limitNum;
    const pageLogs = format === 'csv' ? logs.slice(0, MAX_PAGE_SIZE) : logs.slice(offset, offset + limitNum);

    // Names for the entries on screen only (older entries have no stored actor_name).
    const userIds = Array.from(new Set(pageLogs.map((log) => log.user_id).filter(Boolean).map(String)));
    const userNameById = new Map();
    for (let index = 0; index < userIds.length; index += IN_QUERY_CHUNK) {
      const found = await listRecords('users', {
        filters: [{ field: 'id', op: 'in', value: userIds.slice(index, index + IN_QUERY_CHUNK) }]
      });
      found.forEach((user) => userNameById.set(user.id, user.name));
    }

    const rows = pageLogs.map((log) => ({
      ...log,
      user_name: userNameById.get(String(log.user_id)) || log.actor_name || null
    }));

    if (format === 'csv') {
      const columns = ['created_at', 'user_name', 'actor_role', 'action', 'entity_type', 'entity_id', 'summary', 'ip'];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="activity-log.csv"');
      return res.send(toSafeCsv(rows, columns));
    }

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/announcements', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = await parityService.getAnnouncements();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/announcements', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = await parityService.createAnnouncement(req.body, req.user);

    await recordAudit(req, {
      action: 'announcement_create',
      entityType: 'announcement',
      entityId: data.id,
      summary: data.title
    });

    try {
      const io = req.app.get('io');
      if (io) {
        io.to('role:student').to('role:teacher').emit('announcement:new', {
          id: data.id,
          title: data.title,
          message: data.content,
          createdAt: data.created_at
        });
      }
    } catch (_) {
      void 0;
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put('/announcements/:id', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const announcement = await getRecord('announcements', req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const { title, content } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'content is required' });
    }

    const priority = req.body.priority || 'normal';
    if (!['urgent', 'normal', 'info'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Priority must be one of urgent, normal, info' });
    }

    const targetAudience = req.body.target_audience || 'all';
    if (!['all', 'students', 'teachers', 'department'].includes(targetAudience)) {
      return res.status(400).json({ success: false, message: 'Target audience must be one of all, students, teachers, department' });
    }

    const updates = {
      title: String(title).trim(),
      content: String(content).trim(),
      priority,
      target_audience: targetAudience,
      target_department: req.body.department || null,
      department: req.body.department || null,
      is_pinned: Boolean(req.body.pinned),
      pinned: Boolean(req.body.pinned),
      status: req.body.status || announcement.status || 'active',
      updated_at: new Date().toISOString()
    };

    await updateRecord('announcements', req.params.id, updates);

    await recordAudit(req, {
      action: 'announcement_update',
      entityType: 'announcement',
      entityId: req.params.id,
      summary: updates.title
    });

    res.json({ success: true, data: { ...announcement, ...updates } });
  } catch (error) {
    next(error);
  }
});

router.delete('/announcements/:id', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const announcement = await getRecord('announcements', req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    await deleteRecord('announcements', req.params.id);

    await recordAudit(req, {
      action: 'announcement_delete',
      entityType: 'announcement',
      entityId: req.params.id,
      summary: announcement.title
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = await parityService.getSettings();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = await parityService.updateSettings(req.body);

    await recordAudit(req, {
      action: 'settings_update',
      entityType: 'settings',
      summary: 'Platform settings changed',
      metadata: { fields: Object.keys(req.body || {}) }
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
