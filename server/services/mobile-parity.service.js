const { db: firebaseDb, isFirebaseAdminReady } = require('../database/firebase');
const { sanitizeUser } = require('../utils/app-session');
const { isPortalEnabled } = require('../config/featureFlags');
const {
  createRecord,
  getRecord,
  listRecords,
  setRecord
} = require('./firebase-data.service');
const {
  getPortalSnapshotForUser,
  buildAttendanceRouteData,
  buildMarksRouteData
} = require('./soa-data.service');

const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const SUBJECTS = [
  { id: 101, name: 'Data Structures', code: 'CSE201' },
  { id: 102, name: 'Algorithms', code: 'CSE202' },
  { id: 103, name: 'Database Systems', code: 'CSE203' },
  { id: 104, name: 'Operating Systems', code: 'CSE204' },
  { id: 105, name: 'Computer Networks', code: 'CSE205' },
  { id: 106, name: 'Software Engineering', code: 'CSE206' }
];
const SEARCH_HINTS = [
  'attendance',
  'notes',
  'events',
  'payments',
  'announcements',
  ...SUBJECTS.map((subject) => subject.name)
];
const SETTINGS_METADATA = {
  announcementEmailEnabled: 'Send announcement emails in addition to in-app notifications.',
  notificationDigest: 'Controls how frequently admins receive digest notifications.',
  attendanceThreshold: 'Attendance percentage threshold used for alerts.',
  paymentGatewayMode: 'Payment gateway mode for sandbox or live transactions.',
  maintenanceMode: 'When enabled, clients should show maintenance messaging.',
  androidMinVersion: 'Minimum supported native Android app version.'
};

const demoClubMemberships = new Map();
const demoSettings = {
  announcementEmailEnabled: true,
  notificationDigest: 'daily',
  attendanceThreshold: 75,
  paymentGatewayMode: 'sandbox',
  maintenanceMode: false,
  androidMinVersion: '2.0.0'
};
let demoAnnouncements = [
  {
    id: 'ann-1',
    title: 'Mid-Semester Examination Window',
    content: 'Mid-semester examinations begin next Monday. Check your department noticeboard for room updates.',
    priority: 'urgent',
    target_audience: 'all',
    department: null,
    status: 'active',
    pinned: true,
    created_by: 'Admin Office',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'ann-2',
    title: 'Hackathon Registration Open',
    content: 'Student teams can now register for the 24-hour campus innovation sprint.',
    priority: 'normal',
    target_audience: 'students',
    department: null,
    status: 'active',
    pinned: false,
    created_by: 'Innovation Cell',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const demoClubs = [
  { id: 1, name: 'Coding Club', category: 'tech', description: 'Competitive programming, projects, and hackathons.', members: 234, events: 12, established: '2020', icon: 'coding' },
  { id: 2, name: 'AI/ML Club', category: 'tech', description: 'Model building, paper reading, and workshops.', members: 178, events: 10, established: '2021', icon: 'ai' },
  { id: 3, name: 'Photography Club', category: 'hobby', description: 'Campus photo-walks and exhibition showcases.', members: 95, events: 6, established: '2020', icon: 'photo' },
  { id: 4, name: 'Dance Crew', category: 'cultural', description: 'Performances, choreography sessions, and auditions.', members: 201, events: 16, established: '2017', icon: 'dance' }
];

const demoSharedFiles = [
  {
    id: 'file-1',
    original_name: 'Software_Engineering_Guide.pdf',
    category: 'note',
    subject: 'Software Engineering',
    description: 'Approved study guide for the current semester.',
    public_url: '/static/uploads/Software_Engineering_Guide.pdf',
    file_size: 2_420_000
  },
  {
    id: 'file-2',
    original_name: 'Campus_Event_Brochure.pdf',
    category: 'announcement',
    subject: 'Campus',
    description: 'Event brochure and schedule.',
    public_url: '/static/uploads/Campus_Event_Brochure.pdf',
    file_size: 845_000
  }
];

function isoOffset(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function getMembershipSet(userId) {
  if (!demoClubMemberships.has(userId)) {
    demoClubMemberships.set(userId, new Set());
  }
  return demoClubMemberships.get(userId);
}

function sortByString(items, field, direction = 'asc') {
  return [...items].sort((left, right) => {
    const leftValue = String(left?.[field] || '');
    const rightValue = String(right?.[field] || '');
    return direction === 'desc'
      ? rightValue.localeCompare(leftValue)
      : leftValue.localeCompare(rightValue);
  });
}

function sortByBooleanThenDate(items, booleanField, dateField) {
  return [...items].sort((left, right) => {
    const boolDiff = Number(Boolean(right?.[booleanField])) - Number(Boolean(left?.[booleanField]));
    if (boolDiff !== 0) {
      return boolDiff;
    }
    return String(right?.[dateField] || '').localeCompare(String(left?.[dateField] || ''));
  });
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function mapById(items = []) {
  return new Map(items.map((item) => [String(item.id), item]));
}

async function listCollection(collectionName, options = {}, fallback = []) {
  try {
    const rows = await listRecords(collectionName, options);
    return rows;
  } catch (error) {
    return typeof fallback === 'function' ? fallback(error) : fallback;
  }
}

async function getUserMetricsById() {
  const [attendance, marks] = await Promise.all([
    listCollection('attendance'),
    listCollection('marks')
  ]);

  const attendanceTotals = new Map();
  attendance.forEach((record) => {
    const studentId = String(record.student_id || '');
    if (!studentId) return;
    const current = attendanceTotals.get(studentId) || { total: 0, present: 0 };
    current.total += 1;
    if (record.status === 'present') {
      current.present += 1;
    }
    attendanceTotals.set(studentId, current);
  });

  const marksTotals = new Map();
  marks.forEach((record) => {
    const studentId = String(record.student_id || '');
    if (!studentId) return;
    const totalMarks = Number(record.total_marks || 0);
    if (!totalMarks) return;
    const current = marksTotals.get(studentId) || { percentageSum: 0, count: 0 };
    current.percentageSum += (Number(record.marks_obtained || 0) / totalMarks) * 100;
    current.count += 1;
    marksTotals.set(studentId, current);
  });

  return {
    attendanceTotals,
    marksTotals
  };
}

async function queryFirebaseData(sql, params = []) {
  const normalizedSql = String(sql || '').replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalizedSql.includes('from notifications')) {
    return listRecords('notifications', {
      filters: [{ field: 'user_id', value: String(params[0]) }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: 6
    });
  }

  if (normalizedSql.includes('from notes') && normalizedSql.includes('branch = $1 or branch is null')) {
    const department = params[0];
    const notes = await listCollection('notes', {
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });
    return notes
      .filter((item) => item.status === 'approved' && (!item.branch || item.branch === department))
      .slice(0, 8);
  }

  if (normalizedSql.includes('from notes') && normalizedSql.includes('uploaded_by = $1 or status = \'approved\'')) {
    const userId = String(params[0]);
    const notes = await listCollection('notes', {
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });
    return notes
      .filter((item) => String(item.uploaded_by || '') === userId || item.status === 'approved')
      .slice(0, 8);
  }

  if (normalizedSql.includes('from clubs')) {
    const clubs = await listCollection('clubs', {
      orderBy: [{ field: 'name', direction: 'asc' }]
    });
    return clubs.filter((item) => item.is_active !== false);
  }

  if (normalizedSql.includes('from announcements')) {
    const announcements = await listCollection('announcements', {
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });
    return sortByBooleanThenDate(announcements, 'pinned', 'created_at').slice(0, 25);
  }

  if (normalizedSql.includes('from attendance') && normalizedSql.includes('order by date desc limit 12')) {
    return listRecords('attendance', {
      filters: [{ field: 'student_id', value: String(params[0]) }],
      orderBy: [{ field: 'date', direction: 'desc' }],
      limit: 12
    });
  }

  if (normalizedSql.includes('from attendance') && normalizedSql.includes('group by subject')) {
    const rows = await listCollection('attendance', {
      filters: [{ field: 'student_id', value: String(params[0]) }]
    });
    const grouped = new Map();
    rows.forEach((item) => {
      const subject = item.subject || 'Subject';
      if (!grouped.has(subject)) {
        grouped.set(subject, {
          subject,
          total_classes: 0,
          present_count: 0,
          percentage: 0
        });
      }
      const group = grouped.get(subject);
      group.total_classes += 1;
      if (item.status === 'present') {
        group.present_count += 1;
      }
      group.percentage = group.total_classes
        ? Number(((group.present_count * 100) / group.total_classes).toFixed(2))
        : 0;
    });
    return sortByString(Array.from(grouped.values()), 'subject', 'asc');
  }

  if (normalizedSql.includes('from marks') && normalizedSql.includes('order by exam_date desc limit 12')) {
    return listRecords('marks', {
      filters: [{ field: 'student_id', value: String(params[0]) }],
      orderBy: [{ field: 'exam_date', direction: 'desc' }],
      limit: 12
    });
  }

  if (normalizedSql.includes('from marks') && normalizedSql.includes('group by subject, exam_type')) {
    const rows = await listCollection('marks', {
      filters: [{ field: 'student_id', value: String(params[0]) }]
    });
    const grouped = new Map();
    rows.forEach((item) => {
      const key = `${item.subject || 'Subject'}::${item.exam_type || 'Exam'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          subject: item.subject || 'Subject',
          exam_type: item.exam_type || 'Exam',
          marksSum: 0,
          totalSum: 0,
          count: 0
        });
      }
      const group = grouped.get(key);
      group.marksSum += Number(item.marks_obtained || 0);
      group.totalSum += Number(item.total_marks || 0);
      group.count += 1;
    });
    return Array.from(grouped.values()).map((item) => ({
      subject: item.subject,
      exam_type: item.exam_type,
      avg_marks: item.count ? Number((item.marksSum / item.count).toFixed(2)) : 0,
      avg_total: item.count ? Number((item.totalSum / item.count).toFixed(2)) : 0
    }));
  }

  if (normalizedSql.includes('from timetable_view')) {
    return listRecords('timetable', {
      filters: [
        { field: 'department', value: params[0] },
        { field: 'year', value: params[1] },
        { field: 'section', value: params[2] }
      ],
      orderBy: [
        { field: 'day_of_week', direction: 'asc' },
        { field: 'start_time', direction: 'asc' }
      ]
    });
  }

  if (normalizedSql.includes('from events')) {
    const events = await listCollection('events', {
      orderBy: [{ field: 'event_date', direction: 'asc' }]
    });
    return events.filter((item) => item.is_active !== false).slice(0, 8);
  }

  if (normalizedSql.includes('from hostel_menu')) {
    const today = todayIsoDate();
    const rows = await listCollection('hostel_menu', {
      orderBy: [{ field: 'date', direction: 'asc' }]
    });
    return rows
      .filter((item) => String(item.date || '') >= today)
      .slice(0, 12);
  }

  if (normalizedSql.includes('from users') && normalizedSql.includes('where role = \'student\' and department = $1')) {
    const department = params[0];
    const users = await listCollection('users', {
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });
    const { attendanceTotals, marksTotals } = await getUserMetricsById();
    return users
      .filter((item) => item.role === 'student' && item.department === department)
      .map((item) => {
        const attendanceStats = attendanceTotals.get(String(item.id)) || { total: 0, present: 0 };
        const marksStats = marksTotals.get(String(item.id)) || { percentageSum: 0, count: 0 };
        return {
          id: item.id,
          name: item.name || item.full_name || item.username || 'Student',
          registration_number: item.registration_number || item.id,
          email: item.email || null,
          department: item.department || null,
          year: item.year ?? null,
          section: item.section || null,
          attendance_percent: attendanceStats.total
            ? Number(((attendanceStats.present * 100) / attendanceStats.total).toFixed(2))
            : 0,
          avg_marks: marksStats.count
            ? Number((marksStats.percentageSum / marksStats.count).toFixed(2))
            : 0
        };
      })
      .slice(0, 200);
  }

  if (normalizedSql.includes('from assignments')) {
    const department = params[0];
    const [assignments, submissions] = await Promise.all([
      listCollection('assignments', {
        orderBy: [{ field: 'deadline', direction: 'desc' }]
      }),
      listCollection('assignment_submissions')
    ]);

    return assignments
      .filter((item) => item.department === department)
      .slice(0, 10)
      .map((item) => {
        const matching = submissions.filter((submission) => String(submission.assignment_id) === String(item.id));
        const gradedCount = matching.filter((submission) => submission.status === 'graded').length;
        return {
          id: item.id,
          title: item.title,
          subject: item.subject,
          description: item.description,
          deadline: item.deadline,
          submissions_count: matching.length,
          pending_count: Math.max(matching.length - gradedCount, 0)
        };
      });
  }

  if (normalizedSql.includes('from question_bank')) {
    return listRecords('question_bank', {
      filters: [{ field: 'teacher_id', value: String(params[0]) }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: 10
    });
  }

  if (normalizedSql.includes('from rubrics')) {
    return listRecords('rubrics', {
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: 5
    });
  }

  if (normalizedSql.includes('from users') && normalizedSql.includes('order by created_at desc limit 25')) {
    return listRecords('users', {
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: 25
    }).then((users) => users.map((item) => ({
      id: item.id,
      name: item.name || item.full_name || item.username || 'User',
      registration_number: item.registration_number || item.id,
      email: item.email || null,
      role: item.role || 'student',
      department: item.department || null,
      year: item.year ?? null,
      section: item.section || null,
      is_active: item.is_active !== false
    })));
  }

  if (normalizedSql.includes('count(case when role = \'student\' then 1 end) as total_students')) {
    const users = await listCollection('users');
    const grouped = new Map();
    users.forEach((item) => {
      if (!item.department) {
        return;
      }
      if (!grouped.has(item.department)) {
        grouped.set(item.department, {
          code: item.department,
          name: item.department,
          total_students: 0,
          total_teachers: 0
        });
      }
      const group = grouped.get(item.department);
      if (item.role === 'student') {
        group.total_students += 1;
      }
      if (item.role === 'teacher') {
        group.total_teachers += 1;
      }
    });
    return sortByString(Array.from(grouped.values()), 'code', 'asc');
  }

  throw new Error(`Unsupported Firebase parity query: ${normalizedSql.slice(0, 80)}`);
}

async function safeQuery(sql, params, fallback) {
  try {
    return await queryFirebaseData(sql, params);
  } catch (error) {
    return typeof fallback === 'function' ? fallback(error) : fallback;
  }
}

async function safeFirestoreQuery(fn, fallback) {
  if (!isFirebaseAdminReady) {
    return typeof fallback === 'function' ? fallback() : fallback;
  }

  try {
    return await fn();
  } catch (error) {
    return typeof fallback === 'function' ? fallback(error) : fallback;
  }
}

function toId(value, fallback) {
  return String(value ?? fallback);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return Boolean(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatBytes(value) {
  const size = toNumber(value, 0);
  if (size <= 0) {
    return null;
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

function trimExtension(fileName = '') {
  return fileName.replace(/\.[^/.]+$/, '');
}

function toDocumentItem(item, fallbackType = 'file') {
  const id = toId(item.id, `${fallbackType}-${Date.now()}`);
  const fileName = item.original_name || item.file_name || item.stored_name || item.title || `document-${id}.pdf`;
  const title = item.title || trimExtension(fileName);
  const downloadUrl = item.download_url || item.downloadUrl || (id ? `/api/files/download/${encodeURIComponent(id)}` : null);

  return {
    id,
    title,
    subject: item.subject || null,
    type: item.type || item.category || fallbackType,
    description: item.description || item.summary || null,
    url: item.public_url || item.publicUrl || null,
    downloadUrl,
    fileName,
    sizeLabel: item.sizeLabel || formatBytes(item.file_size || item.fileSize)
  };
}

function toAnnouncementItem(item) {
  return {
    id: toId(item.id, `announcement-${Date.now()}`),
    title: item.title || 'Announcement',
    content: item.content || item.body || '',
    priority: item.priority || 'normal',
    target_audience: item.target_audience || 'all',
    status: item.status || 'active',
    created_at: item.created_at || new Date().toISOString(),
    department: item.department || null
  };
}

function toClubItem(item, joined = false) {
  return {
    id: toId(item.id, `club-${Date.now()}`),
    name: item.name || 'Club',
    category: item.category || 'general',
    description: item.description || null,
    members: toNumber(item.members || item.member_count, 0),
    events: toNumber(item.events || item.event_count, 0),
    joined
  };
}

function toEventItem(item) {
  return {
    id: toId(item.id, `event-${Date.now()}`),
    title: item.title || 'Event',
    category: item.category || 'general',
    description: item.description || null,
    event_date: item.event_date || null,
    event_time: item.event_time || null,
    location: item.location || null,
    registration_count: toNumber(item.registration_count, 0)
  };
}

function toForumQuestion(item) {
  return {
    id: toId(item.id, `forum-${Date.now()}`),
    title: item.title || 'Forum Question',
    description: item.description || item.content || 'No description available.',
    category: item.category || 'General',
    status: item.status || 'open',
    views: toNumber(item.views, 0),
    upvotes: toNumber(item.upvotes, 0),
    author_name: item.author_name || item.author || item.created_by || 'Community',
    answer_count: toNumber(item.answer_count, 0),
    created_at: item.created_at || new Date().toISOString()
  };
}

function toPaymentItem(item) {
  return {
    id: toId(item.id || item.paymentId, `payment-${Date.now()}`),
    paymentId: item.paymentId || item.payment_id || toId(item.id, `PAY-${Date.now()}`),
    amount: toNumber(item.amount, 0),
    category: item.category || 'General Fee',
    semester: String(item.semester || 'N/A'),
    status: item.status || 'pending',
    transactionId: item.transactionId || item.transaction_id || null,
    paymentDate: item.paymentDate || item.payment_date || item.created_at || null,
    description: item.description || null
  };
}

function toRosterItem(item) {
  return {
    id: toId(item.id, `student-${Date.now()}`),
    name: item.name || 'Student',
    registration_number: item.registration_number || item.reg_no || 'N/A',
    email: item.email || null,
    department: item.department || null,
    year: item.year ?? null,
    section: item.section || null,
    attendance_percent: toNumber(item.attendance_percent, 0),
    avg_marks: toNumber(item.avg_marks, 0)
  };
}

function toAssignmentItem(item) {
  return {
    id: toId(item.id, `assignment-${Date.now()}`),
    title: item.title || 'Assignment',
    subject: item.subject || 'General',
    description: item.description || null,
    deadline: item.deadline || null,
    total_marks: item.total_marks !== undefined ? toNumber(item.total_marks, 0) : null,
    submission_status: item.submission_status || null,
    submissions_count: item.submissions_count !== undefined ? toNumber(item.submissions_count, 0) : null,
    pending_count: item.pending_count !== undefined ? toNumber(item.pending_count, 0) : null
  };
}

function toQuestionBankItem(item) {
  return {
    id: toId(item.id, `question-${Date.now()}`),
    subject_id: item.subject_id !== undefined ? toNumber(item.subject_id, SUBJECTS[0].id) : SUBJECTS[0].id,
    question_text: item.question_text || 'Question',
    question_type: item.question_type || 'mcq',
    difficulty: item.difficulty || 'medium',
    topic: item.topic || null,
    marks: item.marks !== undefined ? toNumber(item.marks, 1) : 1
  };
}

function toRubricItem(item) {
  let criteria = item.criteria;
  if (typeof criteria === 'string') {
    try {
      criteria = JSON.parse(criteria);
    } catch (error) {
      criteria = [];
    }
  }

  if (!Array.isArray(criteria)) {
    criteria = [];
  }

  return {
    id: toId(item.id, `rubric-${Date.now()}`),
    assignment_id: item.assignment_id !== undefined && item.assignment_id !== null ? String(item.assignment_id) : null,
    name: item.name || 'Rubric',
    description: item.description || null,
    criteria: criteria.map((criterion, index) => ({
      name: criterion.name || `Criterion ${index + 1}`,
      description: criterion.description || null,
      max_points: toNumber(criterion.max_points || criterion.maxPoints, 0)
    }))
  };
}

function toAdminUserItem(item) {
  return {
    id: toId(item.id, `user-${Date.now()}`),
    registration_number: item.registration_number || null,
    name: item.name || 'User',
    email: item.email || null,
    role: item.role || 'student',
    department: item.department || null,
    is_active: item.is_active !== false
  };
}

function toApprovalItem(item) {
  return {
    id: toId(item.id, `approval-${Date.now()}`),
    type: item.type || item.category || 'file',
    title: item.title || item.original_name || 'Approval Item',
    uploaded_by: item.uploaded_by || item.uploaded_by_name || item.created_by || null,
    department: item.department || null,
    created_at: item.created_at || new Date().toISOString()
  };
}

function toDepartmentItem(item) {
  return {
    code: item.code || item.department || 'GEN',
    name: item.name || item.department || 'General',
    hod: item.hod || null,
    total_students: toNumber(item.total_students, 0),
    total_teachers: toNumber(item.total_teachers, 0),
    active_courses: toNumber(item.active_courses, 0)
  };
}

function toSettingItem(key, value) {
  return {
    key,
    value: String(value),
    description: SETTINGS_METADATA[key] || null
  };
}

function normalizeSettingsPatch(patch) {
  if (Array.isArray(patch)) {
    return Object.fromEntries(
      patch
        .filter((item) => item && item.key)
        .map((item) => [item.key, coerceSettingValue(item.value)])
    );
  }

  if (Array.isArray(patch?.settings)) {
    return normalizeSettingsPatch(patch.settings);
  }

  if (patch && typeof patch === 'object') {
    return Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, coerceSettingValue(value)])
    );
  }

  return {};
}

function coerceSettingValue(value) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

function buildPublicContent() {
  const landingSections = [
    {
      title: 'Academic workflows',
      body: 'Students can track attendance, marks, timetable, notes, admit card, payments, events, clubs, hostel menu, forum, and AI assistance.',
      highlight: 'Student parity'
    },
    {
      title: 'Teaching workflows',
      body: 'Teachers can mark attendance, upload marks, manage assignments, upload notes, maintain question banks, create rubrics, and review student rosters.',
      highlight: 'Teacher parity'
    },
    {
      title: 'Administrative workflows',
      body: 'Admins can manage users, approvals, analytics, announcements, departments, and platform settings from native Android screens.',
      highlight: 'Admin parity'
    }
  ];

  return {
    landing: {
      title: 'ITERasn hub',
      subtitle: 'Native Android 10+ access to the shared college portal backend.',
      sections: landingSections
    },
    creator: {
      title: 'Creator',
      subtitle: 'Platform and migration context',
      sections: [
        {
          title: 'Independent native client',
          body: 'This Android app talks to backend APIs directly. It does not render website pages through WebView, TWA, or any browser shell.',
          highlight: 'No wrapper UI'
        },
        {
          title: 'Shared backend, native UX',
          body: 'Business workflows are preserved by reusing server routes and normalized contracts while the Android UI remains fully native.',
          highlight: 'API reuse only'
        }
      ]
    },
    connectPortal: {
      title: 'Connect Portal',
      subtitle: 'SOA portal integration entry point',
      sections: [
        {
          title: 'Portal status',
          body: 'Use the shared portal endpoints to check portal availability and connect credentials when that backend capability is enabled.',
          highlight: '/api/portal/status'
        },
        {
          title: 'Native flow',
          body: 'Portal connectivity is exposed as a native Android flow and not by embedding the hosted website.',
          highlight: '/api/portal/login'
        }
      ]
    },
    home: {
      hero: {
        title: 'ITERasn hub',
        subtitle: 'Academic operations across student, teacher, and admin workflows in a native Android client.',
        primaryAction: 'Login',
        secondaryAction: 'Connect Portal'
      },
      featureHighlights: landingSections.map((section) => section.title)
    },
    auth: {
      loginEndpoint: '/api/auth/login',
      registerEndpoint: '/api/auth/register-student',
      demoAccounts: [
        { role: 'student', registration_number: 'STU20250001' },
        { role: 'teacher', registration_number: 'TCH2025001' },
        { role: 'admin', registration_number: 'ADM2025001' }
      ]
    }
  };
}

function buildNavigation(role) {
  const shared = [
    { route: 'notifications', label: 'Notifications', role: null, description: 'Notification center and unread updates.' },
    { route: 'search', label: 'Search', role: null, description: 'Search users, files, events, and announcements.' },
    { route: 'profile', label: 'Profile', role: null, description: 'Profile and session details.' },
    { route: 'fileCenter', label: 'Files', role: null, description: 'Shared file uploads and downloads.' }
  ];

  const byRole = {
    student: [
      { route: 'dashboard', label: 'Dashboard', role: 'student', description: 'Student home and metrics.' },
      { route: 'studentAttendance', label: 'Attendance', role: 'student', description: 'Attendance summary and records.' },
      { route: 'studentMarks', label: 'Marks', role: 'student', description: 'Marks summary and performance.' },
      { route: 'studentTimetable', label: 'Timetable', role: 'student', description: 'Weekly class schedule.' },
      { route: 'studentNotes', label: 'Notes', role: 'student', description: 'Approved notes and study materials.' },
      { route: 'studentAdmit', label: 'Admit Card', role: 'student', description: 'Admit card preview and download.' },
      { route: 'studentEvents', label: 'Events', role: 'student', description: 'Upcoming events and registrations.' },
      { route: 'studentClubs', label: 'Clubs', role: 'student', description: 'Club memberships and activities.' },
      { route: 'studentHostel', label: 'Hostel Menu', role: 'student', description: 'Hostel meals and menus.' },
      { route: 'studentForum', label: 'Forum', role: 'student', description: 'Student discussion forum.' },
      { route: 'studentAi', label: 'AI Assistant', role: 'student', description: 'Study support and AI chat.' },
      { route: 'studentPaymentHistory', label: 'Payments', role: 'student', description: 'Payment history and receipts.' },
      { route: 'studentPaymentMake', label: 'Make Payment', role: 'student', description: 'Native payment submission flow.' }
    ],
    teacher: [
      { route: 'dashboard', label: 'Dashboard', role: 'teacher', description: 'Teacher home and KPIs.' },
      { route: 'teacherAttendance', label: 'Attendance', role: 'teacher', description: 'Attendance marking actions.' },
      { route: 'teacherMarks', label: 'Marks', role: 'teacher', description: 'Marks upload workflow.' },
      { route: 'teacherAssignments', label: 'Assignments', role: 'teacher', description: 'Assignment management.' },
      { route: 'teacherNotes', label: 'Notes', role: 'teacher', description: 'Material and notes uploads.' },
      { route: 'teacherQuestionBank', label: 'Question Bank', role: 'teacher', description: 'Question bank management.' },
      { route: 'teacherRubrics', label: 'Rubric Creator', role: 'teacher', description: 'Rubric creation and review.' },
      { route: 'teacherStudents', label: 'Students', role: 'teacher', description: 'Roster and student insights.' }
    ],
    admin: [
      { route: 'dashboard', label: 'Dashboard', role: 'admin', description: 'Admin home and platform metrics.' },
      { route: 'adminUsers', label: 'Users', role: 'admin', description: 'User management and status changes.' },
      { route: 'adminApprovals', label: 'Approvals', role: 'admin', description: 'Pending approvals and moderation.' },
      { route: 'adminAnalytics', label: 'Analytics', role: 'admin', description: 'Analytics overview.' },
      { route: 'adminAnnouncements', label: 'Announcements', role: 'admin', description: 'Announcement publishing.' },
      { route: 'adminDepartments', label: 'Departments', role: 'admin', description: 'Department health and ownership.' },
      { route: 'adminSettings', label: 'Settings', role: 'admin', description: 'Platform settings and constraints.' }
    ]
  };

  return [...(byRole[role] || []), ...shared];
}

async function getNotifications(userId) {
  const rows = await safeQuery(
    `SELECT id, title, message, type, is_read, created_at, link
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 6`,
    [userId],
    [
      { id: 1, title: 'Assignment deadline tomorrow', message: 'Upload your software engineering assignment before 11:59 PM.', type: 'assignment', is_read: false, created_at: isoOffset(-1), link: null },
      { id: 2, title: 'Fee receipt ready', message: 'Your latest payment receipt is available for download.', type: 'payment', is_read: true, created_at: isoOffset(-3), link: '/api/payments/PAY1001/receipt' }
    ]
  );

  const items = rows.map((item) => ({
    id: toId(item.id, `notification-${Date.now()}`),
    title: item.title || 'Notification',
    message: item.message || '',
    type: item.type || 'info',
    is_read: toBoolean(item.is_read, false),
    created_at: item.created_at || new Date().toISOString(),
    link: item.link || null
  }));

  return {
    unreadCount: items.filter((item) => !item.is_read).length,
    items
  };
}

async function getPortalSummary(portalState = null) {
  return {
    enabled: isPortalEnabled(),
    statusEndpoint: '/api/portal/status',
    connectEndpoint: '/api/portal/login',
    demoEndpoint: '/api/portal/demo',
    connected: Boolean(portalState?.connected),
    verified: Boolean(portalState?.verified),
    lastSynced: portalState?.lastSynced || null,
    dataSource: portalState?.dataSource || null
  };
}

async function getSharedFileHub(user = null) {
  const rows = await safeFirestoreQuery(async () => {
    let ref = firebaseDb.collection('files');

    if (user?.role === 'student') {
      ref = ref.where('approved', '==', true);
    }

    const snapshot = await ref.limit(8).get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => {
        if (user?.role === 'student') {
          return item.approved === true;
        }
        return true;
      });
  }, demoSharedFiles);

  return rows.map((item) => toDocumentItem(item, 'file'));
}

async function getStudentNotes(user) {
  const rows = await safeQuery(
    `SELECT id, title, subject, type, description, file_path, created_at
     FROM notes
     WHERE status = 'approved'
       AND (branch = $1 OR branch IS NULL)
     ORDER BY created_at DESC
     LIMIT 8`,
    [user.department || 'CSE'],
    [
      { id: 1, title: 'Arrays and Linked Lists', subject: 'Data Structures', type: 'notes', description: 'Unit 1 summary and practice set.', file_path: 'Data_Structures_Unit1_Notes.pdf', created_at: isoOffset(-8) },
      { id: 2, title: 'Database PYQ 2024', subject: 'Database Systems', type: 'pyq', description: 'Previous year questions with answers.', file_path: 'Database_PYQ_2024.pdf', created_at: isoOffset(-12) }
    ]
  );

  return rows.map((item) => toDocumentItem({
    id: item.id,
    title: item.title,
    subject: item.subject,
    type: item.type,
    description: item.description,
    original_name: item.file_path || `${item.title}.pdf`,
    download_url: `/api/notes/${encodeURIComponent(toId(item.id, item.title))}/download`
  }, 'note'));
}

async function getTeacherNotes(user) {
  const rows = await safeQuery(
    `SELECT id, title, subject, type, description, file_path, created_at
     FROM notes
     WHERE uploaded_by = $1 OR status = 'approved'
     ORDER BY created_at DESC
     LIMIT 8`,
    [user.id],
    [
      { id: 21, title: 'Operating Systems Process Notes', subject: 'Operating Systems', type: 'notes', description: 'Teacher upload example.', file_path: 'Operating_Systems_Process_Notes.pdf', created_at: isoOffset(-4) }
    ]
  );

  return rows.map((item) => toDocumentItem({
    id: item.id,
    title: item.title,
    subject: item.subject,
    type: item.type,
    description: item.description,
    original_name: item.file_path || `${item.title}.pdf`,
    download_url: `/api/notes/${encodeURIComponent(toId(item.id, item.title))}/download`
  }, 'note'));
}

async function getClubs(userId) {
  const [rows, memberships] = await Promise.all([
    safeQuery(
      `SELECT id, name, category, description, member_count as members, event_count as events, established_year as established
       FROM clubs
       WHERE is_active = TRUE
       ORDER BY name`,
      [],
      demoClubs
    ),
    listCollection('club_memberships', {
      filters: [{ field: 'user_id', value: String(userId) }]
    }, [])
  ]);
  const effectiveRows = rows.length ? rows : demoClubs;

  const membershipIds = new Set(
    memberships
      .filter((item) => item.is_active !== false)
      .map((item) => String(item.club_id))
  );
  const fallbackMemberships = getMembershipSet(userId);
  return effectiveRows.map((club) => toClubItem(
    club,
    membershipIds.has(String(club.id)) || fallbackMemberships.has(toNumber(club.id, 0))
  ));
}

async function getAnnouncements() {
  const rows = await safeQuery(
    `SELECT id, title, content, priority, target_audience, target_department as department,
            CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN 'active' ELSE 'archived' END as status,
            is_pinned as pinned, created_at
     FROM announcements
     ORDER BY is_pinned DESC, created_at DESC
     LIMIT 25`,
    [],
    demoAnnouncements
  );
  const effectiveRows = rows.length ? rows : demoAnnouncements;

  return effectiveRows.map((item) => toAnnouncementItem({
    ...item,
    created_by: item.created_by || 'Admin Office'
  }));
}

async function createAnnouncement(payload, user) {
  const announcement = toAnnouncementItem({
    title: payload.title,
    content: payload.content,
    priority: payload.priority || 'normal',
    target_audience: payload.target_audience || 'all',
    department: payload.department || null,
    status: payload.status || 'active',
    pinned: Boolean(payload.pinned),
    created_by: user.name || 'Admin',
    created_at: new Date().toISOString()
  });

  try {
    const record = await createRecord('announcements', announcement);
    return toAnnouncementItem(record);
  } catch (_) {
    const fallback = {
      ...announcement,
      id: `ann-${Date.now()}`
    };
    demoAnnouncements = [fallback, ...demoAnnouncements];
    return fallback;
  }
}

async function getStoredSettings() {
  try {
    const record = await getRecord('app_settings', 'mobile_parity');
    if (record?.settings && typeof record.settings === 'object') {
      return {
        ...demoSettings,
        ...record.settings
      };
    }

    await setRecord('app_settings', 'mobile_parity', {
      settings: demoSettings
    }, { merge: true });
  } catch (_) {
    // Fall through to demo defaults.
  }

  return { ...demoSettings };
}

async function getSettings() {
  const settings = await getStoredSettings();
  return Object.entries(settings).map(([key, value]) => toSettingItem(key, value));
}

async function updateSettings(patch) {
  const merged = {
    ...(await getStoredSettings()),
    ...normalizeSettingsPatch(patch)
  };

  try {
    await setRecord('app_settings', 'mobile_parity', {
      settings: merged
    }, { merge: true });
  } catch (_) {
    Object.assign(demoSettings, merged);
  }

  return Object.entries(merged).map(([key, value]) => toSettingItem(key, value));
}

async function getPortalStudentData(user) {
  try {
    return await getPortalSnapshotForUser({
      userId: user.id,
      registrationNumber: user.registration_number
    });
  } catch (_) {
    return null;
  }
}

function buildPortalTimetable(normalizedData) {
  return asArray(normalizedData?.timetable).map((item, index) => {
    const [startTime, endTime] = String(item.time_slot || item.time || '')
      .split('-')
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      id: toId(item.id, `portal-slot-${index}`),
      day_of_week: item.day_of_week || item.day || 'Day',
      start_time: item.start_time || startTime || '09:00',
      end_time: item.end_time || endTime || null,
      subject: item.subject || item.subject_name || 'Subject',
      room: item.room || item.room_number || null,
      teacher_name: item.teacher_name || item.teacher || item.faculty || null
    };
  });
}

function buildBunkPlan(summaryRows, threshold = 75) {
  const ratio = threshold / 100;
  const subjects = asArray(summaryRows)
    .filter((item) => toNumber(item.total_classes, 0) > 0)
    .map((item) => {
      const attended = toNumber(item.present_count, 0);
      const total = toNumber(item.total_classes, 0);
      const canMiss = Math.max(0, Math.floor((attended / ratio) - total + 1e-9));
      const deficit = (ratio * total) - attended;
      const recoverNeeded = deficit <= 0
        ? 0
        : Math.ceil((deficit / (1 - ratio)) - 1e-9);

      return {
        subject: item.subject || 'Subject',
        attended,
        total,
        percentage: toNumber(item.percentage, 0),
        canMiss,
        recoverNeeded
      };
    });

  const totalAttended = subjects.reduce((sum, item) => sum + item.attended, 0);
  const totalClasses = subjects.reduce((sum, item) => sum + item.total, 0);
  const overallPercentage = totalClasses
    ? Number(((totalAttended * 100) / totalClasses).toFixed(2))
    : 0;

  return { threshold, subjects, overallPercentage };
}

function parseAgendaTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function resolveEventDueAt(event) {
  const deadlineTimestamp = parseAgendaTimestamp(event.registration_deadline);
  if (deadlineTimestamp !== null) {
    return deadlineTimestamp;
  }

  const time = String(event.event_time || '');
  if (/^\d{1,2}:\d{2}/.test(time)) {
    const combinedTimestamp = parseAgendaTimestamp(`${String(event.event_date)}T${time.slice(0, 5)}:00`);
    if (combinedTimestamp !== null) {
      return combinedTimestamp;
    }
  }

  return parseAgendaTimestamp(event.event_date);
}

async function buildUpcomingAgenda(user, eventRows = []) {
  const now = Date.now();
  const graceWindow = 12 * 60 * 60 * 1000;
  const items = [];

  try {
    const assignments = await listRecords('assignments', {
      filters: [
        { field: 'department', value: user.department },
        { field: 'year', value: user.year }
      ]
    });

    for (const assignment of asArray(assignments)) {
      if (assignment.is_active === false) continue;
      const dueAt = parseAgendaTimestamp(assignment.deadline);
      if (dueAt === null || dueAt < now - graceWindow) continue;
      items.push({
        id: toId(assignment.id, 'assignment'),
        type: 'assignment',
        title: assignment.title || 'Assignment',
        dueAt: new Date(dueAt).toISOString()
      });
    }
  } catch (_) {
    void 0;
  }

  for (const event of asArray(eventRows)) {
    if (event.is_active === false) continue;
    const dueAt = resolveEventDueAt(event);
    if (dueAt === null || dueAt < now - graceWindow) continue;
    items.push({
      id: toId(event.id, 'event'),
      type: 'event',
      title: event.title || 'Event',
      dueAt: new Date(dueAt).toISOString()
    });
  }

  items.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  return items.slice(0, 10);
}

function gradePointOfMark(record) {
  const total = toNumber(record.total_marks, 0);
  if (!(total > 0)) return null;
  return (toNumber(record.marks_obtained, 0) / total) * 10;
}

function creditsOfMark(record) {
  const parsed = Number(record.credits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildCgpaProjection(markRows, targetCgpa = 8.5) {
  const withPoints = asArray(markRows).filter((record) => gradePointOfMark(record) !== null);
  if (withPoints.length === 0) return null;

  const creditRecords = withPoints.filter((record) => creditsOfMark(record) !== null);
  let currentCgpa;
  let completedCredits;
  let averageSemesterCredits = null;

  if (creditRecords.length > 0) {
    const semesters = new Map();
    for (const record of creditRecords) {
      const semester = record.semester || 'Unknown';
      if (!semesters.has(semester)) {
        semesters.set(semester, { qualityPoints: 0, credits: 0 });
      }
      const item = semesters.get(semester);
      const credits = creditsOfMark(record);
      item.qualityPoints += gradePointOfMark(record) * credits;
      item.credits += credits;
    }

    const entries = Array.from(semesters.values());
    const qualityPoints = entries.reduce((sum, item) => sum + item.qualityPoints, 0);
    completedCredits = entries.reduce((sum, item) => sum + item.credits, 0);
    currentCgpa = Number((qualityPoints / completedCredits).toFixed(2));
    averageSemesterCredits = completedCredits / entries.length;
  } else {
    currentCgpa = Number((withPoints.reduce((total, record) => total + gradePointOfMark(record), 0) / withPoints.length).toFixed(2));
    completedCredits = null;
  }

  if (!(averageSemesterCredits > 0)) return null;

  const futureCredits = averageSemesterCredits;
  const projectedTotalCredits = completedCredits + futureCredits;
  const requiredRaw = ((projectedTotalCredits * targetCgpa) - (currentCgpa * completedCredits)) / futureCredits;

  return {
    currentCgpa,
    targetCgpa,
    requiredAverageSgpa: Number(Math.max(0, requiredRaw).toFixed(2)),
    feasible: requiredRaw <= 10
  };
}

async function getStudentSnapshot(user) {
  const portalSnapshot = await getPortalStudentData(user);
  const attendanceRecords = await safeQuery(
    `SELECT id, subject, date, status, remarks
     FROM attendance
     WHERE student_id = $1
     ORDER BY date DESC
     LIMIT 12`,
    [user.id],
    [
      { id: 1, subject: 'Data Structures', date: isoOffset(-2).slice(0, 10), status: 'present', remarks: null },
      { id: 2, subject: 'Algorithms', date: isoOffset(-3).slice(0, 10), status: 'absent', remarks: 'Medical leave' },
      { id: 3, subject: 'Database Systems', date: isoOffset(-4).slice(0, 10), status: 'present', remarks: null }
    ]
  );

  const attendanceSummary = await safeQuery(
    `SELECT subject, COUNT(*) as total_classes,
            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
            ROUND(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as percentage
     FROM attendance
     WHERE student_id = $1
     GROUP BY subject
     ORDER BY subject`,
    [user.id],
    [
      { subject: 'Data Structures', total_classes: 32, present_count: 28, percentage: 87.5 },
      { subject: 'Algorithms', total_classes: 30, present_count: 26, percentage: 86.67 },
      { subject: 'Database Systems', total_classes: 31, present_count: 25, percentage: 80.64 }
    ]
  );

  const markRecords = await safeQuery(
    `SELECT id, subject, exam_type, marks_obtained, total_marks, exam_date, remarks
     FROM marks
     WHERE student_id = $1
     ORDER BY exam_date DESC
     LIMIT 12`,
    [user.id],
    [
      { id: 1, subject: 'Data Structures', exam_type: 'mid-semester', marks_obtained: 85, total_marks: 100, exam_date: isoOffset(-18).slice(0, 10), remarks: 'Good performance' },
      { id: 2, subject: 'Algorithms', exam_type: 'quiz', marks_obtained: 18, total_marks: 20, exam_date: isoOffset(-11).slice(0, 10), remarks: null },
      { id: 3, subject: 'Database Systems', exam_type: 'assignment', marks_obtained: 92, total_marks: 100, exam_date: isoOffset(-7).slice(0, 10), remarks: null }
    ]
  );

  const marksSummary = await safeQuery(
    `SELECT subject, exam_type, AVG(marks_obtained) as avg_marks, AVG(total_marks) as avg_total
     FROM marks
     WHERE student_id = $1
     GROUP BY subject, exam_type
     ORDER BY subject`,
    [user.id],
    [
      { subject: 'Data Structures', exam_type: 'mid-semester', avg_marks: 85, avg_total: 100 },
      { subject: 'Algorithms', exam_type: 'quiz', avg_marks: 18, avg_total: 20 },
      { subject: 'Operating Systems', exam_type: 'assignment', avg_marks: 82, avg_total: 100 }
    ]
  );

  const timetable = await safeQuery(
    `SELECT day_of_week, start_time, end_time, subject, room_number as room, teacher_name
     FROM timetable_view
     WHERE department = $1 AND year = $2 AND section = $3
     ORDER BY day_of_week, start_time`,
    [user.department || 'CSE', user.year || 2, user.section || 'A'],
    [
      { day_of_week: 'Monday', start_time: '09:00', end_time: '10:00', subject: 'Data Structures', room: '301', teacher_name: 'Dr. Priya Sharma' },
      { day_of_week: 'Monday', start_time: '10:00', end_time: '11:00', subject: 'Algorithms', room: '305', teacher_name: 'Prof. Rahul Kumar' },
      { day_of_week: 'Tuesday', start_time: '11:00', end_time: '12:00', subject: 'Database Systems', room: 'Lab 2', teacher_name: 'Dr. Amit Singh' }
    ]
  );

  const events = await safeQuery(
    `SELECT id, title, description, category, event_date, event_time, location
     FROM events
     WHERE is_active = TRUE
     ORDER BY event_date ASC
     LIMIT 8`,
    [],
    [
      { id: 1, title: 'Hackathon 24 Hours', description: 'Build, ship, and demo in one day.', category: 'technical', event_date: isoOffset(10), event_time: '09:00', location: 'Innovation Lab' },
      { id: 2, title: 'Career Guidance Seminar', description: 'Placement prep and recruiter Q&A.', category: 'seminar', event_date: isoOffset(5), event_time: '15:00', location: 'Main Auditorium' }
    ]
  );

  const hostelMenu = await safeQuery(
    `SELECT date, meal_type, menu_items
     FROM hostel_menu
     WHERE date >= CURRENT_DATE
     ORDER BY date ASC, meal_type ASC
     LIMIT 12`,
    [],
    [
      { date: isoOffset(0).slice(0, 10), meal_type: 'breakfast', menu_items: 'Idli, chutney, banana' },
      { date: isoOffset(0).slice(0, 10), meal_type: 'lunch', menu_items: 'Rice, dal, paneer curry, salad' },
      { date: isoOffset(1).slice(0, 10), meal_type: 'dinner', menu_items: 'Chapati, mixed veg, curd' }
    ]
  );

  const forum = await safeFirestoreQuery(async () => {
    const snapshot = await firebaseDb.collection('forum_questions').limit(5).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, [
    { id: '1', title: 'How to approach BST questions?', description: 'Looking for a systematic revision approach.', category: 'Data Structures', upvotes: 15, answer_count: 3, status: 'answered', author_name: 'Riya Das', created_at: isoOffset(-2) },
    { id: '2', title: 'Difference between 2NF and 3NF?', description: 'Need a concise explanation with examples.', category: 'Database', upvotes: 8, answer_count: 2, status: 'open', author_name: 'Arjun Nair', created_at: isoOffset(-5) }
  ]);

  const payments = await safeFirestoreQuery(async () => {
    const snapshot = await firebaseDb.collection('payments').where('userId', '==', user.id).limit(10).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, [
    { id: 'PAY1001', paymentId: 'PAY1001', category: 'Semester Fee', semester: '6', amount: 52000, status: 'completed', paymentDate: isoOffset(-14), transactionId: 'TXN1001' },
    { id: 'PAY1002', paymentId: 'PAY1002', category: 'Hostel Fee', semester: '6', amount: 18000, status: 'pending', paymentDate: isoOffset(-1), transactionId: 'TXN1002' }
  ]);

  const notes = await getStudentNotes(user);
  const sharedFiles = await getSharedFileHub(user);
  const clubs = await getClubs(user.id);

  const normalizedAttendanceRecords = attendanceRecords.map((item) => ({
    id: toId(item.id, `${item.subject}-${item.date}`),
    subject: item.subject || 'Subject',
    date: item.date || isoOffset(0).slice(0, 10),
    status: item.status || 'present',
    remarks: item.remarks || null
  }));
  const normalizedAttendanceSummary = attendanceSummary.map((item) => ({
    subject: item.subject || 'Subject',
    subject_code: item.subject_code || null,
    total_classes: toNumber(item.total_classes, 0),
    present_count: toNumber(item.present_count, 0),
    percentage: toNumber(item.percentage, 0)
  }));
  const normalizedMarkRecords = markRecords.map((item) => ({
    id: toId(item.id, `${item.subject}-${item.exam_type}`),
    subject: item.subject || 'Subject',
    exam_type: item.exam_type || 'Exam',
    marks_obtained: toNumber(item.marks_obtained, 0),
    total_marks: toNumber(item.total_marks, 100),
    exam_date: item.exam_date || null,
    remarks: item.remarks || null
  }));
  const normalizedMarkSummary = marksSummary.map((item) => ({
    subject: item.subject || 'Subject',
    exam_type: item.exam_type || 'Average',
    avg_marks: toNumber(item.avg_marks, 0),
    avg_total: toNumber(item.avg_total, 100)
  }));
  const normalizedTimetable = timetable.map((item, index) => ({
    id: `${item.day_of_week || 'day'}-${index}`,
    day_of_week: item.day_of_week || 'Day',
    start_time: item.start_time || '09:00',
    end_time: item.end_time || null,
    subject: item.subject || 'Subject',
    room: item.room || null,
    teacher_name: item.teacher_name || null
  }));

  const portalAttendanceData = buildAttendanceRouteData(portalSnapshot?.normalizedData);
  const portalMarksData = buildMarksRouteData(portalSnapshot?.normalizedData);
  const portalTimetable = buildPortalTimetable(portalSnapshot?.normalizedData);

  const effectiveAttendanceSummary = portalAttendanceData.summary.length ? portalAttendanceData.summary.map((item) => ({
    subject: item.subject || 'Subject',
    subject_code: item.subject_code || item.subjectCode || null,
    total_classes: toNumber(item.total_classes, 0),
    present_count: toNumber(item.present_count, 0),
    percentage: toNumber(item.percentage, 0)
  })) : normalizedAttendanceSummary;
  const effectiveMarkRecords = portalMarksData.marks.length ? portalMarksData.marks.map((item, index) => ({
    id: toId(item.id, `portal-mark-${index}`),
    subject: item.subject || 'Subject',
    exam_type: item.exam_type || 'Portal',
    marks_obtained: toNumber(item.marks_obtained, 0),
    total_marks: toNumber(item.total_marks, 100),
    exam_date: item.exam_date || portalSnapshot?.status?.lastSynced || null,
    remarks: item.grade || null
  })) : normalizedMarkRecords;
  const effectiveMarkSummary = portalMarksData.summary.length ? portalMarksData.summary.map((item) => ({
    subject: item.subject || 'Subject',
    exam_type: item.exam_type || item.examType || 'Average',
    avg_marks: toNumber(item.avg_marks, 0),
    avg_total: toNumber(item.avg_total, 100)
  })) : normalizedMarkSummary;
  const effectiveTimetable = portalTimetable.length ? portalTimetable : normalizedTimetable;

  const attendancePercent = effectiveAttendanceSummary.length
    ? Math.round(effectiveAttendanceSummary.reduce((acc, row) => acc + toNumber(row.percentage, 0), 0) / effectiveAttendanceSummary.length)
    : 0;
  const cgpa = effectiveMarkSummary.length
    ? Number((effectiveMarkSummary.reduce((acc, row) => acc + (toNumber(row.avg_marks, 0) / Math.max(toNumber(row.avg_total, 100), 1)) * 10, 0) / effectiveMarkSummary.length).toFixed(2))
    : 0;

  let bunkPlan = null;
  try {
    bunkPlan = buildBunkPlan(effectiveAttendanceSummary);
  } catch (_) {
    void 0;
  }

  let agendaUpcoming = [];
  try {
    agendaUpcoming = await buildUpcomingAgenda(user, events);
  } catch (_) {
    void 0;
  }

  let cgpaProjection = null;
  try {
    cgpaProjection = buildCgpaProjection(portalMarksData.marks);
  } catch (_) {
    void 0;
  }

  return {
    dashboardMetrics: [
      { title: 'Attendance', value: `${attendancePercent}%`, detail: 'Overall attendance' },
      { title: 'CGPA', value: cgpa.toFixed(2), detail: 'Academic performance' },
      { title: 'Upcoming Events', value: String(events.length), detail: 'Open registrations' },
      { title: 'Payments', value: String(payments.length), detail: 'Payment records' }
    ],
    sharedFiles,
    portalState: {
      connected: Boolean(portalSnapshot?.status?.connected),
      verified: Boolean(portalSnapshot?.status?.isVerified),
      lastSynced: portalSnapshot?.status?.lastSynced || null,
      dataSource: portalSnapshot?.status?.dataSource || null
    },
    bunkPlan,
    agendaUpcoming,
    cgpaProjection,
    calendarUrl: '/api/calendar.ics',
    student: {
      attendance: {
        records: normalizedAttendanceRecords,
        summary: effectiveAttendanceSummary
      },
      marks: {
        marks: effectiveMarkRecords,
        summary: effectiveMarkSummary,
        cgpa
      },
      timetable: effectiveTimetable,
      notes,
      admitCard: {
        exam_name: 'Semester Admit Card',
        exam_code: `SEM-${user.semester || 'N/A'}`,
        exam_date: isoOffset(14).slice(0, 10),
        public_url: `/api/admitcard/${encodeURIComponent(user.id)}`,
        download_url: `/api/admitcard/${encodeURIComponent(user.id)}/download`
      },
      events: events.map(toEventItem),
      clubs,
      hostelMenu: hostelMenu.map((item, index) => ({
        id: `${item.date}-${item.meal_type}-${index}`,
        date: item.date || isoOffset(0).slice(0, 10),
        meal_type: item.meal_type || 'meal',
        menu_items: item.menu_items || 'Menu unavailable'
      })),
      forum: forum.map(toForumQuestion),
      aiPrompts: [
        'Summarize today’s topics from my timetable.',
        'Help me revise database normalization.',
        'Suggest a study plan for the upcoming mid-semester exam.'
      ],
      payments: payments.map(toPaymentItem)
    }
  };
}

async function getTeacherStudents(user) {
  // Real aggregates from attendance + marks. Kept on a LEFT JOIN so students
  // without any records still appear with zeros instead of being dropped.
  const rows = await safeQuery(
    `SELECT u.id, u.name, u.registration_number, u.email, u.department, u.year, u.section,
            COALESCE(att.attendance_percent, 0) as attendance_percent,
            COALESCE(mk.avg_marks, 0) as avg_marks
     FROM users u
     LEFT JOIN (
       SELECT CAST(student_id AS TEXT) AS sid,
              ROUND(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS attendance_percent
       FROM attendance
       GROUP BY CAST(student_id AS TEXT)
     ) att ON att.sid = CAST(u.id AS TEXT)
     LEFT JOIN (
       SELECT CAST(student_id AS TEXT) AS sid,
              ROUND(AVG(CASE WHEN NULLIF(total_marks, 0) IS NOT NULL
                             THEN marks_obtained * 100.0 / total_marks END), 2) AS avg_marks
       FROM marks
       GROUP BY CAST(student_id AS TEXT)
     ) mk ON mk.sid = CAST(u.id AS TEXT)
     WHERE role = 'student' AND department = $1
     ORDER BY year, section, name
     LIMIT 200`,
    [user.department || 'CSE'],
    [
      { id: 1, name: 'Riya Das', registration_number: 'STU20250110', email: 'riya.das@iter.edu', department: user.department || 'CSE', year: 2, section: 'A', attendance_percent: 84, avg_marks: 86 },
      { id: 2, name: 'Arjun Nair', registration_number: 'STU20250111', email: 'arjun.nair@iter.edu', department: user.department || 'CSE', year: 2, section: 'A', attendance_percent: 73, avg_marks: 79 }
    ]
  );

  return rows.map(toRosterItem);
}

async function getTeacherSnapshot(user) {
  const students = await getTeacherStudents(user);
  const assignments = await safeQuery(
    `SELECT id, title, subject, description, deadline, 12 as submissions_count, 3 as pending_count
     FROM assignments
     WHERE department = $1
     ORDER BY deadline DESC
     LIMIT 10`,
    [user.department || 'CSE'],
    [
      { id: 1, title: 'BST Implementation', subject: 'Data Structures', description: 'Implement insert, search, and traversal.', deadline: isoOffset(4), submissions_count: 27, pending_count: 5 },
      { id: 2, title: 'SQL Optimization Report', subject: 'Database Systems', description: 'Analyze and optimize the provided query set.', deadline: isoOffset(8), submissions_count: 19, pending_count: 11 }
    ]
  );

  const questionBank = await safeQuery(
    `SELECT id, subject_id, question_text, question_type, difficulty, topic, marks
     FROM question_bank
     WHERE teacher_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [user.id],
    [
      { id: 1, subject_id: SUBJECTS[0].id, question_text: 'Explain AVL rotations with a worked example.', question_type: 'short-answer', difficulty: 'medium', topic: 'Trees', marks: 5 },
      { id: 2, subject_id: SUBJECTS[2].id, question_text: 'What is normalization in DBMS?', question_type: 'short-answer', difficulty: 'easy', topic: 'Database Design', marks: 3 }
    ]
  );

  const rubrics = await safeQuery(
    `SELECT id, name, assignment_id, description, criteria, created_at
     FROM rubrics
     ORDER BY created_at DESC
     LIMIT 5`,
    [],
    [
      {
        id: 1,
        name: 'Programming Assignment Rubric',
        assignment_id: 1,
        description: 'Base rubric for lab assignments.',
        criteria: [
          { name: 'Correctness', description: 'Matches expected behavior', max_points: 10 },
          { name: 'Code Quality', description: 'Readable and maintainable code', max_points: 5 }
        ]
      }
    ]
  );

  const notes = await getTeacherNotes(user);
  const sharedFiles = await getSharedFileHub(user);

  return {
    dashboardMetrics: [
      { title: 'Students', value: String(students.length), detail: 'Tracked roster size' },
      { title: 'Assignments', value: String(assignments.length), detail: 'Active assignments' },
      { title: 'Question Bank', value: String(questionBank.length), detail: 'Reusable questions' },
      {
        title: 'Pending Submissions',
        value: String(assignments.reduce((acc, item) => acc + toNumber(item.pending_count, 0), 0)),
        detail: 'Awaiting review'
      }
    ],
    sharedFiles,
    teacher: {
      students,
      assignments: assignments.map(toAssignmentItem),
      notes,
      questionBank: questionBank.map(toQuestionBankItem),
      rubrics: rubrics.map(toRubricItem)
    }
  };
}

async function getAdminSnapshot() {
  const users = await safeQuery(
    `SELECT id, name, registration_number, email, role, department, year, section, is_active
     FROM users
     ORDER BY created_at DESC
     LIMIT 25`,
    [],
    [
      { id: 1, name: 'Shreya Mishra', registration_number: 'STU20250001', email: 'student1@iter.edu', role: 'student', department: 'CSE', year: 2, section: 'A', is_active: true },
      { id: 2, name: 'Dr. Priya Sharma', registration_number: 'TCH2025001', email: 'teacher1@iter.edu', role: 'teacher', department: 'CSE', year: null, section: null, is_active: true },
      { id: 3, name: 'Admin Office', registration_number: 'ADM2025001', email: 'admin@iter.edu', role: 'admin', department: null, year: null, section: null, is_active: true }
    ]
  );

  const departments = await safeQuery(
    `SELECT department as code, department as name,
            COUNT(CASE WHEN role = 'student' THEN 1 END) as total_students,
            COUNT(CASE WHEN role = 'teacher' THEN 1 END) as total_teachers
     FROM users
     WHERE department IS NOT NULL
     GROUP BY department
     ORDER BY department`,
    [],
    DEPARTMENTS.map((department) => ({
      code: department,
      name: department,
      total_students: department === 'CSE' ? 320 : 180,
      total_teachers: department === 'CSE' ? 22 : 14,
      active_courses: department === 'CSE' ? 8 : 5,
      hod: department === 'CSE' ? 'Dr. Priya Sharma' : 'Department Head'
    }))
  );

  const approvals = await safeFirestoreQuery(async () => {
    const snapshot = await firebaseDb.collection('files').where('approved', '==', false).limit(10).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, [
    { id: 'approval-1', type: 'note', title: 'Machine Learning Unit 2 Notes', uploaded_by: 'Dr. K. Rao', department: 'CSE', created_at: isoOffset(-1) }
  ]);

  const announcements = await getAnnouncements();
  const settings = await getSettings();
  const sharedFiles = await getSharedFileHub({ role: 'admin' });

  const totalUsers = users.length;
  const activeUsers = users.filter((item) => item.is_active !== false).length;
  const pendingApprovals = approvals.length;

  return {
    dashboardMetrics: [
      { title: 'Users', value: String(totalUsers), detail: 'Total managed users' },
      { title: 'Active Users', value: String(activeUsers), detail: 'Currently active accounts' },
      { title: 'Approvals', value: String(pendingApprovals), detail: 'Pending moderation items' },
      { title: 'Departments', value: String(departments.length), detail: 'Academic departments tracked' }
    ],
    sharedFiles,
    admin: {
      users: users.map(toAdminUserItem),
      approvals: approvals.map(toApprovalItem),
      analytics: [
        { title: 'Students', value: String(users.filter((item) => item.role === 'student').length), detail: 'Student accounts' },
        { title: 'Teachers', value: String(users.filter((item) => item.role === 'teacher').length), detail: 'Teacher accounts' },
        { title: 'Admins', value: String(users.filter((item) => item.role === 'admin').length), detail: 'Admin accounts' },
        { title: 'Announcements', value: String(announcements.length), detail: 'Published announcements' }
      ],
      announcements,
      departments: departments.map(toDepartmentItem),
      settings
    }
  };
}

function buildDashboard(role, metrics, navigation) {
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';
  return {
    heroTitle: `${roleLabel} Dashboard`,
    heroSubtitle: 'Native Android views powered by shared backend contracts.',
    metrics,
    quickLinks: navigation.slice(0, 4).map((item) => ({
      route: item.route,
      title: item.label,
      description: item.description
    }))
  };
}

async function buildSnapshot(user) {
  const safeUser = sanitizeUser(user);
  const navigation = buildNavigation(safeUser.role);
  const notifications = await getNotifications(safeUser.id);

  let rolePayload = {
    dashboardMetrics: [],
    sharedFiles: await getSharedFileHub(safeUser)
  };

  if (safeUser.role === 'student') {
    rolePayload = await getStudentSnapshot(safeUser);
  } else if (safeUser.role === 'teacher') {
    rolePayload = await getTeacherSnapshot(safeUser);
  } else if (safeUser.role === 'admin') {
    rolePayload = await getAdminSnapshot(safeUser);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    public: buildPublicContent(),
    user: safeUser,
    navigation,
    dashboard: buildDashboard(safeUser.role, rolePayload.dashboardMetrics, navigation),
    notifications,
    shared: {
      fileHub: rolePayload.sharedFiles,
      subjects: SUBJECTS,
      searchHints: SEARCH_HINTS
    },
    search: {
      enabled: true,
      endpoint: '/api/search'
    },
    portal: await getPortalSummary(rolePayload.portalState),
    catalog: {
      departments: DEPARTMENTS,
      subjects: SUBJECTS,
      semesters: ['1', '2', '3', '4', '5', '6', '7', '8']
    }
  };

  if (rolePayload.student) {
    snapshot.student = rolePayload.student;
  }
  if (rolePayload.bunkPlan) {
    snapshot.bunkPlan = rolePayload.bunkPlan;
  }
  if (rolePayload.agendaUpcoming) {
    snapshot.agendaUpcoming = rolePayload.agendaUpcoming;
  }
  if (rolePayload.cgpaProjection) {
    snapshot.cgpaProjection = rolePayload.cgpaProjection;
  }
  if (rolePayload.calendarUrl) {
    snapshot.calendarUrl = rolePayload.calendarUrl;
  }
  if (rolePayload.teacher) {
    snapshot.teacher = rolePayload.teacher;
  }
  if (rolePayload.admin) {
    snapshot.admin = rolePayload.admin;
  }

  return snapshot;
}

async function joinClub(userId, clubId) {
  const membershipId = `${userId}_${clubId}`;
  try {
    await setRecord('club_memberships', membershipId, {
      user_id: String(userId),
      club_id: String(clubId),
      is_active: true
    }, { merge: true });
  } catch (_) {
    getMembershipSet(userId).add(toNumber(clubId, 0));
  }
  return getClubs(userId);
}

async function leaveClub(userId, clubId) {
  const membershipId = `${userId}_${clubId}`;
  try {
    await setRecord('club_memberships', membershipId, {
      user_id: String(userId),
      club_id: String(clubId),
      is_active: false
    }, { merge: true });
  } catch (_) {
    getMembershipSet(userId).delete(toNumber(clubId, 0));
  }
  return getClubs(userId);
}

module.exports = {
  buildPublicContent,
  buildSnapshot,
  createAnnouncement,
  getAnnouncements,
  getClubs,
  getSettings,
  getTeacherStudents,
  joinClub,
  leaveClub,
  updateSettings
};
