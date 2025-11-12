const { query, transaction } = require('../database/db');

// Baseline demo accounts
const DEMO_IDS = {
  student: 'STU20250001',
  teacher: 'TCH2025001',
  admin: 'ADM2025001'
};

// PRNG with seed for stable per-login variability
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
  const rows = await query('SELECT id FROM users WHERE registration_number = $1', [regNo]);
  return rows[0]?.id || null;
}

async function ensureClonedDataFor(userId, role) {
  // Clone minimal dependent data if the user has no records yet
  if (role === 'student') {
    const att = await query('SELECT id FROM attendance WHERE student_id = $1 LIMIT 1', [userId]);
    if (att.length === 0) {
      const demoId = await getDemoUserIdByReg(DEMO_IDS.student);
      if (demoId) await cloneStudentData(demoId, userId);
    }
  }
}

async function cloneStudentData(fromStudentId, toStudentId) {
  // Copy a lightweight slice of data to keep DB small on free plans
  await transaction(async (client) => {
    // Attendance (recent 30 days)
    await client.query(
      `INSERT INTO attendance (student_id, subject, date, status, marked_by, remarks, created_at)
       SELECT $1, subject, date, status, marked_by, remarks, created_at
       FROM attendance WHERE student_id = $2 AND date >= (CURRENT_DATE - INTERVAL '30 days')`,
      [toStudentId, fromStudentId]
    );

    // Marks (recent)
    await client.query(
      `INSERT INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by, remarks, created_at, updated_at)
       SELECT $1, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by, remarks, created_at, updated_at
       FROM marks WHERE student_id = $2 AND exam_date >= (CURRENT_DATE - INTERVAL '365 days')`,
      [toStudentId, fromStudentId]
    );

    // Fees
    await client.query(
      `INSERT INTO fees (student_id, semester, amount, paid_amount, due_date, payment_status, transaction_id, payment_date, receipt_url, created_at, updated_at)
       SELECT $1, semester, amount, paid_amount, due_date, payment_status, transaction_id, payment_date, receipt_url, created_at, updated_at
       FROM fees WHERE student_id = $2`,
      [toStudentId, fromStudentId]
    );

    // Admit card (latest only)
    await client.query(
      `INSERT INTO admit_cards (student_id, exam_name, exam_date, file_id, qr_code, verification_code, is_active, generated_at)
       SELECT $1, exam_name, exam_date, file_id, qr_code, CONCAT(verification_code, '_', $1::text), is_active, generated_at
       FROM admit_cards WHERE student_id = $2 ORDER BY generated_at DESC LIMIT 1`,
      [toStudentId, fromStudentId]
    );
  });
}

function varyStudentSnapshot(rows, seed) {
  const rand = mulberry32(seed);
  const jitter = () => (rand() - 0.5);

  const varied = { ...rows };

  // Attendance summary tweaks on the fly
  if (Array.isArray(varied.summary)) {
    varied.summary = varied.summary.map(s => {
      const delta = Math.round(jitter() * 4); // ±4%
      const pct = clamp((Number(s.percentage) || 0) + delta, 50, 100);
      return { ...s, percentage: pct };
    });
  }

  // Marks tweaks
  if (Array.isArray(varied.marks)) {
    varied.marks = varied.marks.map(m => {
      const delta = Math.round(jitter() * 3); // small ±3 marks
      const mo = clamp(Number(m.marks_obtained) + delta, 0, Number(m.total_marks));
      return { ...m, marks_obtained: mo };
    });
  }

  return varied;
}

module.exports = {
  DEMO_IDS,
  ensureClonedDataFor,
  varyStudentSnapshot
};
