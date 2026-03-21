const fs = require('fs');
const path = require('path');
const { db, isFirebaseAdminReady } = require('../database/firebase');

const localPortalStore = new Map();
const DUMMY_DATA_PATH = path.join(__dirname, '../data/dummyStudentData.json');

const FIELD_ALIASES = {
  studentName: ['studentname', 'name', 'fullname', 'studentfullname', 'nameofthestudent'],
  registrationNumber: ['registrationnumber', 'registrationno', 'regnumber', 'regno', 'studentregno', 'userid'],
  enrollmentNumber: ['enrollmentnumber', 'enrollmentno', 'enrolmentnumber', 'enrolmentno', 'admissionnumber'],
  instituteCode: ['institutecode', 'collegecode', 'schoolcode'],
  academicYear: ['academicyear', 'academic_session', 'academicsession'],
  admissionYear: ['admissionyear', 'yearofadmission'],
  program: ['program', 'programme', 'course', 'degree', 'stream'],
  branch: ['branch', 'specialization', 'department', 'discipline'],
  batch: ['batch', 'session', 'group'],
  semester: ['semester', 'sem', 'currentsemester'],
  section: ['section', 'sec'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate'],
  bloodGroup: ['bloodgroup', 'bloodgrp'],
  gender: ['gender', 'sex'],
  nationality: ['nationality', 'citizenship'],
  maritalStatus: ['maritalstatus', 'martialstatus'],
  category: ['category', 'castecategory'],
  bankName: ['bankname', 'nameofthebank'],
  bankAccountNumber: ['bankaccountnumber', 'accountnumber', 'bankacno', 'bankaccno', 'a_cnumber'],
  fatherName: ['fathername', 'fathersname'],
  fatherDesignation: ['fatherdesignation', 'designationoffather', 'fatheroccupation'],
  motherName: ['mothername', 'mothersname'],
  hostelName: ['hostelname', 'hostel', 'hostelblock'],
  roomNumber: ['roomnumber', 'roomno'],
  email: ['email', 'emailid', 'mailid', 'personalemailid'],
  alternateEmail: ['alternateemail', 'alternateemailid'],
  phone: ['mobile', 'mobilenumber', 'mobileno', 'phone', 'phonenumber', 'contactnumber', 'cellmobile', 'cell'],
  alternatePhone: ['alternatemobile', 'alternatecontactnumber', 'secondaryphone', 'alternatephone'],
  guardianPhone: ['guardianphone', 'parentphone', 'fatherphone', 'motherphone'],
  correspondenceAddress: ['correspondenceaddress', 'currentaddress', 'communicationaddress'],
  permanentAddress: ['permanentaddress', 'address'],
  city: ['city'],
  district: ['district'],
  state: ['state'],
  postalCode: ['postalcode', 'pincode', 'zipcode'],
  photoUrl: ['photourl', 'photo', 'studentphoto'],
  cgpa: ['cgpa'],
  sgpa: ['sgpa'],
  year: ['year']
};

function loadDummyData() {
  try {
    return JSON.parse(fs.readFileSync(DUMMY_DATA_PATH, 'utf8'));
  } catch (_) {
    return {
      profile: {},
      attendance: [],
      marks: [],
      timetable: [],
      notifications: [],
      internal_assessments: [],
      fees: {}
    };
  }
}

const DUMMY_DATA = loadDummyData();

function cleanValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || /^(-+|n\/a|na|null|undefined)$/i.test(text)) {
    return null;
  }

  return text;
}

function serializeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? cleanValue(value) : date.toISOString();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toPercentage(value) {
  const text = cleanValue(value);
  if (!text) return null;
  const num = toNumber(text);
  if (num === null) return null;
  return Number(num.toFixed(2));
}

function parseFraction(value) {
  const text = cleanValue(value);
  if (!text) return null;
  const match = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  return { first, second };
}

function isMeaningfulValue(value) {
  return cleanValue(value) !== null;
}

function pickFirst(...values) {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned !== null) {
      return cleaned;
    }
  }

  return null;
}

function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function getFieldAliasSet() {
  return Object.values(FIELD_ALIASES).reduce((set, aliases) => {
    aliases.forEach((alias) => set.add(alias));
    return set;
  }, new Set());
}

const KNOWN_FIELD_LABELS = getFieldAliasSet();

function extractSubjectCode(text) {
  const cleaned = cleanValue(text);
  if (!cleaned) return null;
  const match = cleaned.match(/\b[A-Z]{2,}[ -]?\d{2,}\b/);
  return match ? match[0].replace(/\s+/g, '') : null;
}

function looksLikeSemesterLabel(text) {
  const cleaned = cleanValue(text);
  if (!cleaned) return false;
  return /\b\d+(?:st|nd|rd|th)\s*sem\b/i.test(cleaned) || /\bsem(?:ester)?\b/i.test(cleaned);
}

function looksLikeCodeValue(text) {
  const cleaned = cleanValue(text);
  if (!cleaned) return false;
  return /^[A-Z0-9-]{4,12}$/i.test(cleaned) && /\d/.test(cleaned) && !/\s/.test(cleaned);
}

function dedupeBy(list, keyFn) {
  const seen = new Set();
  return (list || []).filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function groupBy(list, keyFn) {
  return (list || []).reduce((map, item) => {
    const key = keyFn(item);
    if (!key) return map;
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});
}

function inferFieldMapFromText(text) {
  const map = {};
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => cleanValue(line))
    .filter(Boolean);

  lines.forEach((line) => {
    const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!match) return;
    const label = normalizeLabel(match[1]);
    if (!KNOWN_FIELD_LABELS.has(label)) return;
    map[label] = cleanValue(match[2]);
  });

  return map;
}

function normalizeTable(table) {
  if (!table) return null;

  const headers = Array.isArray(table.headers)
    ? table.headers.map((header) => cleanValue(header) || '')
    : [];

  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) => (Array.isArray(row) ? row.map((cell) => cleanValue(cell) || '') : []))
    : [];

  const rowObjects = Array.isArray(table.rowObjects)
    ? table.rowObjects.map((row) => {
      const normalized = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        normalized[normalizeLabel(key)] = cleanValue(value);
      });
      return normalized;
    })
    : [];

  return {
    title: cleanValue(table.title),
    headers,
    rows,
    rowObjects
  };
}

function tableToObjects(table) {
  const normalized = normalizeTable(table);
  if (!normalized) return [];

  if (normalized.rowObjects.length) {
    return normalized.rowObjects;
  }

  if (!normalized.headers.length || !normalized.rows.length) {
    return [];
  }

  return normalized.rows
    .filter((row) => row.some((cell) => cleanValue(cell)))
    .map((row) => normalized.headers.reduce((record, header, index) => {
      record[normalizeLabel(header)] = cleanValue(row[index]);
      return record;
    }, {}));
}

function collectFieldMaps(rawData) {
  const fieldMaps = [];

  if (rawData?.rawSections && typeof rawData.rawSections === 'object') {
    Object.values(rawData.rawSections).forEach((section) => {
      if (section?.fields && typeof section.fields === 'object') {
        const map = {};
        Object.entries(section.fields).forEach(([key, value]) => {
          map[normalizeLabel(key)] = cleanValue(value);
        });
        fieldMaps.push(map);
      }

      if (section?.pageText) {
        fieldMaps.push(inferFieldMapFromText(section.pageText));
      }
    });
  }

  if (rawData?.rawFields && typeof rawData.rawFields === 'object') {
    const map = {};
    Object.entries(rawData.rawFields).forEach(([key, value]) => {
      map[normalizeLabel(key)] = cleanValue(value);
    });
    fieldMaps.push(map);
  }

  if (rawData?.profile && typeof rawData.profile === 'object') {
    const map = {};
    Object.entries(rawData.profile).forEach(([key, value]) => {
      map[normalizeLabel(key)] = cleanValue(value);
    });
    fieldMaps.push(map);
  }

  return fieldMaps.filter((map) => Object.keys(map).length);
}

function collectTables(rawData) {
  const tables = [];

  if (Array.isArray(rawData?.rawTables)) {
    rawData.rawTables.forEach((table) => tables.push(normalizeTable(table)));
  }

  if (rawData?.rawSections && typeof rawData.rawSections === 'object') {
    Object.entries(rawData.rawSections).forEach(([sectionKey, section]) => {
      if (!Array.isArray(section?.tables)) return;
      section.tables.forEach((table) => {
        const normalized = normalizeTable(table);
        if (normalized) {
          normalized.sectionKey = sectionKey;
          tables.push(normalized);
        }
      });
    });
  }

  return tables.filter(Boolean);
}

function findFieldValue(rawData, aliasKey, ...fallbacks) {
  const aliases = FIELD_ALIASES[aliasKey] || [];
  const fieldMaps = collectFieldMaps(rawData);

  for (const alias of aliases) {
    for (const map of fieldMaps) {
      const value = cleanValue(map[alias]);
      if (value !== null) return value;
    }
  }

  return pickFirst(...fallbacks);
}

function normalizeQualifications(rawData) {
  if (Array.isArray(rawData?.qualifications) && rawData.qualifications.length) {
    return rawData.qualifications
      .map((item) => {
        const record = {};
        Object.entries(item || {}).forEach(([key, value]) => {
          const cleaned = cleanValue(value);
          if (cleaned !== null) {
            record[key] = cleaned;
          }
        });
        return record;
      })
      .filter((item) => Object.keys(item).length);
  }

  const qualificationTables = collectTables(rawData).filter((table) => {
    const title = normalizeLabel(table.title);
    const headerText = normalizeLabel(table.headers.join(' '));
    return (
      title.includes('qualification') ||
      headerText.includes('qualification') ||
      headerText.includes('board') ||
      headerText.includes('university') ||
      headerText.includes('institution')
    );
  });

  return qualificationTables.flatMap((table) => tableToObjects(table).map((row) => {
    const percentage = pickFirst(
      row.percentage,
      row.percentagemarks,
      row.aggregate,
      row.cgpa
    );

    const normalized = {
      exam: pickFirst(row.qualificationcode, row.examination, row.exam, row.degree, row.qualification, row.class),
      board: pickFirst(row.boardname, row.board, row.university, row.council),
      institution: pickFirst(row.institution, row.schoolcollege, row.school, row.college, row.institute),
      year: pickFirst(row.yearofpassing, row.passingyear, row.year),
      marksObtained: pickFirst(row.marksobtained, row.obtainedmarks, row.score),
      totalMarks: pickFirst(row.fullmarks, row.totalmarks, row.maxmarks, row.outof),
      percentage,
      specialization: pickFirst(row.specialization, row.subjects, row.stream),
      grade: pickFirst(row.grade, row.division)
    };

    return Object.fromEntries(
      Object.entries(normalized).filter(([, value]) => value !== null)
    );
  })).filter((item) => Object.keys(item).length);
}

function normalizeAttendanceRecords(rawData) {
  const records = [];
  const defaultSemester = findFieldValue(rawData, 'semester', rawData?.profile?.semester);

  if (Array.isArray(rawData?.attendance)) {
    rawData.attendance.forEach((item) => {
      const subject = pickFirst(item.subject, item.paper, item.course, item.name);
      const subjectCode = pickFirst(item.subject_code, item.subjectCode, extractSubjectCode(subject));
      const totalValue = pickFirst(item.total_classes, item.totalClasses, item.total, item.classes);
      const totalFraction = parseFraction(totalValue);
      const attended = toNumber(pickFirst(item.present_count, item.presentCount, item.attended, item.present)) ?? totalFraction?.first ?? null;
      const total = totalFraction?.second ?? toNumber(totalValue) ?? null;
      const percentage = toPercentage(item.percentage) ?? (
        attended !== null && total ? Number(((attended / total) * 100).toFixed(2)) : null
      );

      if (!subject && subjectCode === null) return;

      records.push({
        subject: subject || subjectCode || 'Unknown Subject',
        subjectCode,
        attendedClasses: attended,
        totalClasses: total,
        percentage,
        teacher: pickFirst(item.teacher, item.faculty, item.staff),
        semester: pickFirst(item.semester, defaultSemester)
      });
    });
  }

  collectTables(rawData).forEach((table) => {
    const headerText = normalizeLabel(table.headers.join(' '));
    const title = normalizeLabel(table.title);
    if (!title.includes('attendance') && !headerText.includes('attendance') && !headerText.includes('present')) {
      return;
    }

    tableToObjects(table).forEach((row) => {
      const subject = pickFirst(row.subject, row.paper, row.course, row.subname);
      const subjectCode = pickFirst(row.subjectcode, row.code, extractSubjectCode(subject));
      const totalValue = pickFirst(row.totalclass, row.total, row.totalclasses, row.classesheld, row.totalcount);
      const totalFraction = parseFraction(totalValue);
      const attended = toNumber(pickFirst(row.present, row.attended, row.presentcount, row.presentclasses)) ?? totalFraction?.first ?? null;
      const total = totalFraction?.second ?? toNumber(totalValue) ?? null;
      const percentage = toPercentage(row.percentage) ?? (
        attended !== null && total ? Number(((attended / total) * 100).toFixed(2)) : null
      );

      if (!subject && !subjectCode) return;

      records.push({
        subject: subject || subjectCode || 'Unknown Subject',
        subjectCode,
        attendedClasses: attended,
        totalClasses: total,
        percentage,
        teacher: pickFirst(row.teacher, row.faculty, row.staff),
        semester: pickFirst(row.semester, defaultSemester)
      });
    });
  });

  const deduped = dedupeBy(records, (item) => `${item.subject || ''}:${item.subjectCode || ''}`);
  const overall = deduped.reduce((acc, item) => {
    acc.present += Number(item.attendedClasses || 0);
    acc.total += Number(item.totalClasses || 0);
    return acc;
  }, { present: 0, total: 0 });

  return {
    records: deduped,
    summary: deduped.map((item) => ({
      subject: item.subject,
      subject_code: item.subjectCode,
      present_count: Number(item.attendedClasses || 0),
      total_classes: Number(item.totalClasses || 0),
      percentage: item.percentage
    })),
    overall: {
      presentClasses: overall.present,
      totalClasses: overall.total,
      percentage: overall.total ? Number(((overall.present / overall.total) * 100).toFixed(2)) : null
    }
  };
}

function normalizeSemesterResults(rawData) {
  const records = [];

  collectTables(rawData).forEach((table) => {
    const headerText = normalizeLabel(table.headers.join(' '));
    const title = normalizeLabel(table.title);
    if (
      !title.includes('result') &&
      !headerText.includes('sgpa') &&
      !headerText.includes('cgpa') &&
      !headerText.includes('earnedcredits')
    ) {
      return;
    }

    tableToObjects(table).forEach((row) => {
      const semester = pickFirst(row.semester, row.sem);
      if (!semester) return;

      records.push({
        semester,
        pointsSecured: toNumber(pickFirst(row.pointsecuredsgpa, row.pointsecured, row.score)),
        courseCredits: toNumber(pickFirst(row.coursecredits, row.credits)),
        earnedCredits: toNumber(pickFirst(row.earnedcredits)),
        sgpa: toNumber(row.sgpa),
        cgpa: toNumber(row.cgpa)
      });
    });
  });

  return dedupeBy(records, (item) => item.semester);
}

function normalizeMarksRecords(rawData, semesterResults = []) {
  const records = [];
  const defaultSemester = findFieldValue(rawData, 'semester', rawData?.profile?.semester);

  const sourceLists = [
    ...(Array.isArray(rawData?.marks) ? [rawData.marks] : []),
    ...(Array.isArray(rawData?.results) ? [rawData.results] : []),
    ...(Array.isArray(rawData?.internalAssessments) ? [rawData.internalAssessments] : [])
  ];

  sourceLists.forEach((list) => {
    list.forEach((item) => {
      const subject = pickFirst(item.subject, item.paper, item.course, item.name);
      const subjectCode = pickFirst(item.subject_code, item.subjectCode, extractSubjectCode(subject));
      const marksObtained = toNumber(pickFirst(item.marks_obtained, item.marks, item.score, item.total_score));
      const totalMarks = toNumber(pickFirst(item.total_marks, item.max_marks, item.out_of));
      if (!subjectCode && looksLikeSemesterLabel(subject) && totalMarks === null) return;
      const percentage = toPercentage(item.percentage) ?? (
        marksObtained !== null && totalMarks ? Number(((marksObtained / totalMarks) * 100).toFixed(2)) : null
      );

      if (!subject && !subjectCode) return;

      records.push({
        subject: subject || subjectCode || 'Unknown Subject',
        subjectCode,
        examType: pickFirst(item.exam_type, item.examType, item.exam, item.assessmentType),
        marksObtained,
        totalMarks,
        percentage,
        grade: pickFirst(item.grade, item.result, item.status),
        credits: toNumber(item.credits),
        semester: pickFirst(item.semester, defaultSemester),
        publishedAt: serializeDate(item.published_at || item.result_date || item.exam_date)
      });
    });
  });

  collectTables(rawData).forEach((table) => {
    const headerText = normalizeLabel(table.headers.join(' '));
    const title = normalizeLabel(table.title);
    if (
      headerText.includes('sgpa') ||
      headerText.includes('cgpa') ||
      headerText.includes('earnedcredits') ||
      !title.includes('mark') &&
      !title.includes('result') &&
      !title.includes('assessment') &&
      !headerText.includes('mark') &&
      !headerText.includes('grade')
    ) {
      return;
    }

    tableToObjects(table).forEach((row) => {
      const subject = pickFirst(row.subject, row.paper, row.course, row.subname);
      const subjectCode = pickFirst(row.subjectcode, row.code, extractSubjectCode(subject));
      const marksObtained = toNumber(pickFirst(row.marksobtained, row.marks, row.score, row.obtained));
      const totalMarks = toNumber(pickFirst(row.totalmarks, row.maxmarks, row.outof));
      if (!subjectCode && looksLikeSemesterLabel(subject) && totalMarks === null) return;
      const percentage = toPercentage(row.percentage) ?? (
        marksObtained !== null && totalMarks ? Number(((marksObtained / totalMarks) * 100).toFixed(2)) : null
      );

      if (!subject && !subjectCode) return;

      records.push({
        subject: subject || subjectCode || 'Unknown Subject',
        subjectCode,
        examType: pickFirst(row.examtype, row.exam, row.assessment, row.test),
        marksObtained,
        totalMarks,
        percentage,
        grade: pickFirst(row.grade, row.result, row.status),
        credits: toNumber(row.credits),
        semester: pickFirst(row.semester, defaultSemester),
        publishedAt: serializeDate(row.resultdate || row.examdate)
      });
    });
  });

  const deduped = dedupeBy(
    records,
    (item) => `${item.subject || ''}:${item.subjectCode || ''}:${item.examType || ''}:${item.publishedAt || ''}`
  );

  const grouped = groupBy(deduped, (item) => item.subjectCode || item.subject);
  const summary = Object.values(grouped).map((items) => {
    const subject = items[0];
    const marks = items.filter((item) => item.marksObtained !== null);
    const avgMarks = marks.length
      ? Number((marks.reduce((total, item) => total + Number(item.marksObtained || 0), 0) / marks.length).toFixed(2))
      : null;
    const avgTotal = marks.length
      ? Number((marks.reduce((total, item) => total + Number(item.totalMarks || 0), 0) / marks.length).toFixed(2))
      : null;

    return {
      subject: subject.subject,
      subject_code: subject.subjectCode,
      avg_marks: avgMarks,
      avg_total: avgTotal,
      exam_type: items.map((item) => item.examType).filter(Boolean).join(', ') || null,
      credits: pickFirst(subject.credits)
    };
  });

  const cgpaFromField = toNumber(findFieldValue(rawData, 'cgpa'));
  const cgpaFromSemesterResults = semesterResults.length ? toNumber(semesterResults[semesterResults.length - 1]?.cgpa) : null;
  const validSummaryRows = summary.filter((item) => item.avg_marks && item.avg_total);
  const calculatedCgpa = validSummaryRows.length
    ? Number((
      validSummaryRows.reduce((total, item) => (
        total + ((Number(item.avg_marks) / Number(item.avg_total)) * 10)
      ), 0) / validSummaryRows.length
    ).toFixed(2))
    : null;

  return {
    records: deduped,
    summary,
    cgpa: cgpaFromField || cgpaFromSemesterResults || calculatedCgpa,
    sgpa: toNumber(findFieldValue(rawData, 'sgpa')) || (semesterResults.length ? toNumber(semesterResults[semesterResults.length - 1]?.sgpa) : null)
  };
}

function buildProfileSummary(rawData) {
  const photoUrl = pickFirst(
    rawData?.profile?.photoUrl,
    rawData?.profile?.photo_url,
    rawData?.profile?.photo,
    findFieldValue(rawData, 'photoUrl')
  );

  const hostelName = findFieldValue(rawData, 'hostelName', rawData?.profile?.hostel);
  const roomNumber = findFieldValue(rawData, 'roomNumber');
  const rawBranch = findFieldValue(rawData, 'branch', rawData?.profile?.branch, rawData?.profile?.department);
  const branch = looksLikeCodeValue(rawBranch)
    ? pickFirst(rawData?.profile?.department, rawData?.rawSections?.marks?.fields?.Branch, rawData?.rawSections?.subjects?.fields?.Branch, rawBranch)
    : rawBranch;
  const section = findFieldValue(rawData, 'section', rawData?.profile?.section) || (looksLikeCodeValue(rawBranch) ? rawBranch : null);

  return {
    studentName: findFieldValue(rawData, 'studentName', rawData?.profile?.name),
    registrationNumber: findFieldValue(
      rawData,
      'registrationNumber',
      rawData?.portalRegistrationNumber,
      rawData?.loginUserId,
      rawData?.profile?.registrationNo,
      rawData?.profile?.registration_number
    ),
    enrollmentNumber: findFieldValue(
      rawData,
      'enrollmentNumber',
      rawData?.profile?.enrollmentNo,
      rawData?.profile?.enrollment_number
    ),
    instituteCode: findFieldValue(rawData, 'instituteCode'),
    academicYear: findFieldValue(rawData, 'academicYear'),
    admissionYear: findFieldValue(rawData, 'admissionYear', rawData?.profile?.admission_year),
    program: findFieldValue(rawData, 'program', rawData?.profile?.course, rawData?.profile?.program),
    branch,
    department: pickFirst(
      rawData?.profile?.department,
      branch,
      findFieldValue(rawData, 'program')
    ),
    batch: findFieldValue(rawData, 'batch'),
    semester: findFieldValue(rawData, 'semester', rawData?.profile?.semester),
    section,
    dateOfBirth: findFieldValue(rawData, 'dateOfBirth', rawData?.profile?.dob, rawData?.profile?.dateOfBirth),
    bloodGroup: findFieldValue(rawData, 'bloodGroup', rawData?.profile?.blood_group),
    gender: findFieldValue(rawData, 'gender', rawData?.profile?.gender),
    nationality: findFieldValue(rawData, 'nationality', rawData?.profile?.nationality),
    maritalStatus: findFieldValue(rawData, 'maritalStatus'),
    category: findFieldValue(rawData, 'category', rawData?.profile?.category),
    bankName: findFieldValue(rawData, 'bankName'),
    bankAccountNumber: findFieldValue(rawData, 'bankAccountNumber'),
    fatherName: findFieldValue(rawData, 'fatherName', rawData?.profile?.father_name),
    fatherDesignation: findFieldValue(rawData, 'fatherDesignation'),
    motherName: findFieldValue(rawData, 'motherName', rawData?.profile?.mother_name),
    hostelName,
    roomNumber,
    email: findFieldValue(rawData, 'email', rawData?.profile?.email),
    alternateEmail: findFieldValue(rawData, 'alternateEmail'),
    phone: findFieldValue(rawData, 'phone', rawData?.profile?.phone),
    alternatePhone: findFieldValue(rawData, 'alternatePhone'),
    guardianPhone: findFieldValue(rawData, 'guardianPhone'),
    correspondenceAddress: findFieldValue(rawData, 'correspondenceAddress'),
    permanentAddress: findFieldValue(rawData, 'permanentAddress', rawData?.profile?.address),
    city: findFieldValue(rawData, 'city'),
    district: findFieldValue(rawData, 'district'),
    state: findFieldValue(rawData, 'state'),
    postalCode: findFieldValue(rawData, 'postalCode'),
    photoUrl
  };
}

function normalizeSoaPortalData(rawData = {}) {
  const profile = buildProfileSummary(rawData);
  const attendance = normalizeAttendanceRecords(rawData);
  const semesterResults = normalizeSemesterResults(rawData);
  const marks = normalizeMarksRecords(rawData, semesterResults);
  const qualifications = normalizeQualifications(rawData);
  const rawSections = rawData.rawSections || {};
  const fetchedAt = serializeDate(rawData.fetchedAt || rawData.metadata?.fetchedAt || new Date());

  return {
    provider: 'soa',
    dataSource: pickFirst(rawData.dataSource, 'live_soa_portal'),
    fetchedAt,
    profile,
    personalInfo: {
      studentName: profile.studentName,
      registrationNumber: profile.registrationNumber,
      enrollmentNumber: profile.enrollmentNumber,
      instituteCode: profile.instituteCode,
      academicYear: profile.academicYear,
      admissionYear: profile.admissionYear,
      program: profile.program,
      branch: profile.branch,
      batch: profile.batch,
      semester: profile.semester,
      section: profile.section,
      dateOfBirth: profile.dateOfBirth,
      bloodGroup: profile.bloodGroup,
      gender: profile.gender,
      nationality: profile.nationality,
      maritalStatus: profile.maritalStatus,
      category: profile.category,
      bankName: profile.bankName,
      bankAccountNumber: profile.bankAccountNumber,
      fatherName: profile.fatherName,
      fatherDesignation: profile.fatherDesignation,
      motherName: profile.motherName,
      hostelName: profile.hostelName,
      roomNumber: profile.roomNumber,
      photoUrl: profile.photoUrl
    },
    contactInfo: {
      email: profile.email,
      alternateEmail: profile.alternateEmail,
      phone: profile.phone,
      alternatePhone: profile.alternatePhone,
      guardianPhone: profile.guardianPhone,
      correspondenceAddress: profile.correspondenceAddress,
      permanentAddress: profile.permanentAddress,
      city: profile.city,
      district: profile.district,
      state: profile.state,
      postalCode: profile.postalCode
    },
    qualifications,
    attendance,
    marks,
    semesterResults,
    results: marks.records,
    internalAssessments: Array.isArray(rawData.internalAssessments) ? rawData.internalAssessments : [],
    timetable: Array.isArray(rawData.timetable) ? rawData.timetable : [],
    subjects: Array.isArray(rawData.subjects) ? rawData.subjects : [],
    notifications: Array.isArray(rawData.notifications) ? rawData.notifications : [],
    backlogs: Array.isArray(rawData.backlogs) ? rawData.backlogs : [],
    fees: rawData.fees || {},
    raw: {
      sections: rawSections,
      tables: collectTables(rawData),
      profile: rawData.profile || {},
      rawHtml: cleanValue(rawData.rawHtml)
    }
  };
}

function normalizeStoredPortalData(userData = {}) {
  if (userData.portalData?.provider === 'soa') {
    return {
      ...userData.portalData,
      fetchedAt: serializeDate(userData.portalData.fetchedAt || userData.portal_last_synced || new Date()),
      dataSource: userData.portalData.dataSource || 'cached_soa_import'
    };
  }

  const hasLegacyData = Boolean(
    userData.profile ||
    (Array.isArray(userData.attendance_data) && userData.attendance_data.length) ||
    (Array.isArray(userData.marks_data) && userData.marks_data.length) ||
    (Array.isArray(userData.internal_assessments_data) && userData.internal_assessments_data.length)
  );

  if (!hasLegacyData) {
    return null;
  }

  return normalizeSoaPortalData({
    profile: userData.profile || {},
    attendance: userData.attendance_data || [],
    marks: userData.marks_data || [],
    results: userData.results_data || [],
    internalAssessments: userData.internal_assessments_data || [],
    timetable: userData.timetable_data || [],
    subjects: userData.courses_data || [],
    notifications: userData.notifications_data || [],
    backlogs: userData.backlogs_data || [],
    fees: userData.fees_data || {},
    fetchedAt: userData.portal_last_synced,
    dataSource: userData.portalProvider === 'soa' ? 'cached_soa_import' : pickFirst(userData.dataSource, 'cached_import')
  });
}

function buildLegacyProfile(normalized) {
  const { profile } = normalized;
  const hostel = [profile.hostelName, profile.roomNumber].filter(Boolean).join(', ') || null;

  return {
    name: profile.studentName,
    registration_number: profile.registrationNumber,
    enrollment_number: profile.enrollmentNumber,
    email: profile.email,
    department: profile.department || profile.branch || profile.program,
    section: profile.section,
    semester: profile.semester,
    phone: profile.phone,
    father_name: profile.fatherName,
    mother_name: profile.motherName,
    dob: profile.dateOfBirth,
    address: profile.permanentAddress || profile.correspondenceAddress,
    district: profile.district,
    blood_group: profile.bloodGroup,
    admission_year: profile.admissionYear,
    hostel,
    category: profile.category,
    gender: profile.gender,
    nationality: profile.nationality,
    photo_url: profile.photoUrl
  };
}

function buildPortalStatusPayload(userData = {}, normalized = null) {
  const hasImportedData = Boolean(
    normalized &&
    (
      isMeaningfulValue(normalized.profile.studentName) ||
      isMeaningfulValue(normalized.profile.enrollmentNumber) ||
      normalized.attendance.records.length ||
      normalized.marks.records.length ||
      (Array.isArray(normalized.semesterResults) && normalized.semesterResults.length) ||
      normalized.qualifications.length
    )
  );

  return {
    connected: Boolean(userData.portalConnected),
    isVerified: Boolean(userData.isVerified),
    portalProvider: userData.portalProvider || (hasImportedData ? 'soa' : null),
    lastSynced: serializeDate(userData.portal_last_synced),
    hasImportedData,
    needsReconnect: Boolean(userData.portalNeedsReconnect) || (hasImportedData && !userData.portalConnected),
    dataSource: pickFirst(normalized?.dataSource, userData.dataSource),
    profileSummary: hasImportedData ? {
      studentName: normalized.profile.studentName,
      registrationNumber: normalized.profile.registrationNumber,
      branch: normalized.profile.branch,
      semester: normalized.profile.semester,
      photoUrl: normalized.profile.photoUrl
    } : null
  };
}

function buildFirestoreUpdate(normalized, options = {}) {
  return {
    portalConnected: options.portalConnected !== false,
    portalNeedsReconnect: Boolean(options.portalNeedsReconnect),
    portalProvider: 'soa',
    portalRegistrationNumber: cleanValue(options.registrationNumber) || normalized.profile.registrationNumber,
    portal_last_synced: new Date(options.lastSynced || normalized.fetchedAt || Date.now()),
    isVerified: options.isVerified !== false,
    portalData: normalized,
    profile: buildLegacyProfile(normalized),
    attendance_data: normalized.attendance.summary,
    marks_data: normalized.marks.records.map((record) => ({
      subject: record.subject,
      subject_code: record.subjectCode,
      marks: record.marksObtained,
      grade: record.grade,
      exam_type: record.examType,
      total_marks: record.totalMarks,
      credits: record.credits,
      percentage: record.percentage
    })),
    timetable_data: normalized.timetable,
    courses_data: normalized.subjects,
    results_data: normalized.results,
    notifications_data: normalized.notifications,
    backlogs_data: normalized.backlogs,
    internal_assessments_data: normalized.internalAssessments,
    fees_data: normalized.fees,
    updated_at: new Date()
  };
}

function getStoreKeys(userId, registrationNumber) {
  return dedupeBy(
    [cleanValue(userId), cleanValue(registrationNumber)].filter(Boolean),
    (item) => item
  );
}

async function readUserDoc(userId, registrationNumber) {
  const keys = getStoreKeys(userId, registrationNumber);

  if (isFirebaseAdminReady) {
    for (const key of keys) {
      try {
        const snapshot = await db.collection('users').doc(key).get();
        if (snapshot.exists) {
          return {
            id: snapshot.id,
            data: snapshot.data() || {},
            source: 'firestore'
          };
        }
      } catch (_) {
        // Fall back to local store below.
      }
    }
  }

  for (const key of keys) {
    if (localPortalStore.has(key)) {
      return {
        id: key,
        data: localPortalStore.get(key) || {},
        source: 'memory'
      };
    }
  }

  return {
    id: keys[0] || null,
    data: {},
    source: isFirebaseAdminReady ? 'firestore' : 'memory'
  };
}

async function persistPortalDataForUser({ userId, registrationNumber, normalizedData, isVerified = true, portalConnected = true }) {
  const updateData = buildFirestoreUpdate(normalizedData, {
    registrationNumber,
    isVerified,
    portalConnected,
    portalNeedsReconnect: false
  });
  const primaryKey = cleanValue(userId) || cleanValue(registrationNumber);
  const keys = primaryKey ? [primaryKey] : [];

  if (isFirebaseAdminReady) {
    for (const key of keys) {
      try {
        await db.collection('users').doc(key).set(updateData, { merge: true });
      } catch (_) {
        // Try the next key or fall back to local store below.
      }
    }
  }

  keys.forEach((key) => {
    const existing = localPortalStore.get(key) || {};
    localPortalStore.set(key, { ...existing, ...updateData });
  });

  return updateData;
}

async function getPortalSnapshotForUser({ userId, registrationNumber }) {
  const record = await readUserDoc(userId, registrationNumber);
  const normalized = normalizeStoredPortalData(record.data);

  return {
    userId: record.id || userId || registrationNumber || null,
    source: record.source,
    rawUserData: record.data,
    normalizedData: normalized,
    status: buildPortalStatusPayload(record.data, normalized)
  };
}

async function disconnectPortalForUser({ userId, registrationNumber }) {
  const current = await readUserDoc(userId, registrationNumber);
  const updateData = {
    portalConnected: false,
    portalNeedsReconnect: true,
    isVerified: false,
    portalProvider: current.data.portalProvider || 'soa',
    updated_at: new Date()
  };

  const primaryKey = cleanValue(userId || current.id) || cleanValue(registrationNumber);
  const keys = primaryKey ? [primaryKey] : [];

  if (isFirebaseAdminReady) {
    for (const key of keys) {
      try {
        await db.collection('users').doc(key).set(updateData, { merge: true });
      } catch (_) {
        // Fall back to local store below.
      }
    }
  }

  keys.forEach((key) => {
    const existing = localPortalStore.get(key) || {};
    localPortalStore.set(key, { ...existing, ...updateData });
  });

  const snapshot = await getPortalSnapshotForUser({ userId, registrationNumber });
  return snapshot;
}

function buildAttendanceRouteData(normalizedData) {
  if (!normalizedData) {
    return {
      records: [],
      summary: [],
      source: 'none'
    };
  }

  return {
    records: normalizedData.attendance.records.map((item, index) => ({
      id: `soa-attendance-${index + 1}`,
      student_id: normalizedData.profile.registrationNumber,
      subject: item.subject,
      subject_code: item.subjectCode,
      status: null,
      date: null,
      teacher: item.teacher,
      attended_classes: item.attendedClasses,
      total_classes: item.totalClasses,
      percentage: item.percentage
    })),
    summary: normalizedData.attendance.summary,
    source: 'soa_import'
  };
}

function buildMarksRouteData(normalizedData) {
  if (!normalizedData) {
    return {
      marks: [],
      summary: [],
      cgpa: null,
      source: 'none'
    };
  }

  if (!normalizedData.marks.records.length && Array.isArray(normalizedData.semesterResults) && normalizedData.semesterResults.length) {
    return {
      marks: normalizedData.semesterResults.map((item, index) => ({
        id: `soa-semester-result-${index + 1}`,
        student_id: normalizedData.profile.registrationNumber,
        subject: `Semester ${item.semester}`,
        subject_code: null,
        exam_type: 'Semester Result',
        marks_obtained: item.sgpa,
        total_marks: 10,
        grade: null,
        credits: item.courseCredits,
        semester: item.semester,
        exam_date: null,
        points_secured: item.pointsSecured,
        earned_credits: item.earnedCredits,
        cgpa: item.cgpa
      })),
      summary: normalizedData.semesterResults.map((item) => ({
        subject: `Semester ${item.semester}`,
        subject_code: null,
        avg_marks: item.sgpa,
        avg_total: 10,
        exam_type: 'Semester Result',
        credits: item.courseCredits
      })),
      cgpa: normalizedData.marks.cgpa,
      semesterResults: normalizedData.semesterResults,
      source: 'soa_import'
    };
  }

  return {
    marks: normalizedData.marks.records.map((item, index) => ({
      id: `soa-mark-${index + 1}`,
      student_id: normalizedData.profile.registrationNumber,
      subject: item.subject,
      subject_code: item.subjectCode,
      exam_type: item.examType,
      marks_obtained: item.marksObtained,
      total_marks: item.totalMarks,
      grade: item.grade,
      credits: item.credits,
      semester: item.semester,
      exam_date: item.publishedAt
    })),
    summary: normalizedData.marks.summary,
    cgpa: normalizedData.marks.cgpa,
    semesterResults: normalizedData.semesterResults || [],
    source: 'soa_import'
  };
}

function getDemoPortalData() {
  return normalizeSoaPortalData({
    profile: DUMMY_DATA.profile || {},
    attendance: DUMMY_DATA.attendance || [],
    marks: DUMMY_DATA.marks || [],
    results: DUMMY_DATA.results || [],
    internalAssessments: DUMMY_DATA.internal_assessments || [],
    timetable: DUMMY_DATA.timetable || [],
    subjects: DUMMY_DATA.courses || DUMMY_DATA.registered_subjects || [],
    notifications: DUMMY_DATA.notifications || [],
    backlogs: DUMMY_DATA.backlogs || [],
    fees: DUMMY_DATA.fees || {},
    fetchedAt: DUMMY_DATA.lastUpdated || new Date(),
    dataSource: DUMMY_DATA.dataSource || 'demo'
  });
}

module.exports = {
  DUMMY_DATA,
  localPortalStore,
  normalizeSoaPortalData,
  normalizeStoredPortalData,
  buildPortalStatusPayload,
  buildFirestoreUpdate,
  persistPortalDataForUser,
  getPortalSnapshotForUser,
  disconnectPortalForUser,
  buildAttendanceRouteData,
  buildMarksRouteData,
  getDemoPortalData,
  serializeDate
};
