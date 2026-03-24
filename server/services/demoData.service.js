const { createRecord, listRecords } = require('./firebase-data.service');

// Baseline demo accounts
const DEMO_IDS = {
  student: 'STU20250001',
  teacher: 'TCH2025001',
  admin: 'ADM2025001'
};

function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

async function getDemoUserIdByReg(regNo) {
  const users = await listRecords('users', {
    filters: [{ field: 'registration_number', value: regNo }],
    limit: 1
  });
  return users[0]?.id || null;
}

async function cloneCollection(collectionName, fromStudentId, toStudentId, options = {}) {
  const rows = await listRecords(collectionName, {
    filters: [{ field: 'student_id', value: String(fromStudentId) }]
  });

  let filtered = rows;
  if (typeof options.filter === 'function') {
    filtered = filtered.filter(options.filter);
  }
  if (typeof options.transform === 'function') {
    filtered = filtered.map(options.transform);
  }

  if (options.limit) {
    filtered = filtered
      .sort((left, right) => String(right.created_at || right.exam_date || '').localeCompare(String(left.created_at || left.exam_date || '')))
      .slice(0, options.limit);
  }

  for (const row of filtered) {
    const { id, created_at, updated_at, ...rest } = row;
    await createRecord(collectionName, {
      ...rest,
      student_id: String(toStudentId),
      created_at: created_at || new Date().toISOString(),
      updated_at: updated_at || new Date().toISOString()
    });
  }
}

async function ensureClonedDataFor(userId, role) {
  if (role !== 'student') {
    return;
  }

  const attendance = await listRecords('attendance', {
    filters: [{ field: 'student_id', value: String(userId) }],
    limit: 1
  });

  if (attendance.length > 0) {
    return;
  }

  const demoId = await getDemoUserIdByReg(DEMO_IDS.student);
  if (demoId) {
    await cloneStudentData(demoId, userId);
  }
}

async function cloneStudentData(fromStudentId, toStudentId) {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

  await cloneCollection('attendance', fromStudentId, toStudentId, {
    filter: (row) => Date.parse(row.date || row.created_at || '') >= thirtyDaysAgo
  });

  await cloneCollection('marks', fromStudentId, toStudentId, {
    filter: (row) => Date.parse(row.exam_date || row.created_at || '') >= oneYearAgo
  });

  await cloneCollection('fees', fromStudentId, toStudentId);

  await cloneCollection('admit_cards', fromStudentId, toStudentId, {
    limit: 1,
    transform: (row) => ({
      ...row,
      verification_code: row.verification_code ? `${row.verification_code}_${toStudentId}` : null
    })
  });
}

function varyStudentSnapshot(rows, seed) {
  const rand = mulberry32(seed);
  const jitter = () => (rand() - 0.5);

  const varied = { ...rows };

  if (Array.isArray(varied.summary)) {
    varied.summary = varied.summary.map((summary) => {
      const delta = Math.round(jitter() * 4);
      const pct = clamp((Number(summary.percentage) || 0) + delta, 50, 100);
      return { ...summary, percentage: pct };
    });
  }

  if (Array.isArray(varied.marks)) {
    varied.marks = varied.marks.map((mark) => {
      const delta = Math.round(jitter() * 3);
      const obtained = clamp(Number(mark.marks_obtained) + delta, 0, Number(mark.total_marks));
      return { ...mark, marks_obtained: obtained };
    });
  }

  return varied;
}

module.exports = {
  DEMO_IDS,
  ensureClonedDataFor,
  varyStudentSnapshot
};
