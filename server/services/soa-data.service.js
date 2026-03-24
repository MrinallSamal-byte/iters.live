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
  phone: ['mobile', 'mobilenumber', 'mobileno', 'phone', 'phonenumber', 'contactnumber', 'cellmobile', 'cell', 'telephoneno', 'telephone', 'landline'],
  alternatePhone: ['alternatemobile', 'alternatecontactnumber', 'secondaryphone', 'alternatephone', 'telephoneno2', 'telephone2'],
  guardianPhone: ['guardianphone', 'parentphone', 'fatherphone', 'motherphone', 'parentmobile', 'parentcontact'],
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

function isAddressMarkerValue(value) {
  const cleaned = cleanValue(value);
  return Boolean(cleaned) && (/^[123]$/.test(cleaned) || /^address\s*:?\s*[123]$/i.test(cleaned));
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

  const sectionHeadings = new Set([
    'studentcontactdetails',
    'parentcontactdetails',
    'correspondenceaddress',
    'permanentaddress',
    'studentspersonalinfo',
    'studentscontactinfo',
    'studentsqualifications',
    'personalinformation'
  ]);

  lines.forEach((line) => {
    const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!match) return;
    const label = normalizeLabel(match[1]);
    if (!KNOWN_FIELD_LABELS.has(label)) return;
    const value = cleanValue(match[2]);
    if (!value) return;
    if (label === 'address' && isAddressMarkerValue(value)) return;
    map[label] = value;
  });

  for (let index = 0; index < lines.length - 1; index += 1) {
    const labelLine = lines[index];
    const nextLine = lines[index + 1];
    const label = normalizeLabel(labelLine);
    const value = cleanValue(nextLine);

    if (!KNOWN_FIELD_LABELS.has(label) || !value || map[label]) continue;

    const nextLabel = normalizeLabel(nextLine);
    if (KNOWN_FIELD_LABELS.has(nextLabel) || sectionHeadings.has(nextLabel)) {
      continue;
    }

    if ((label === 'correspondenceaddress' || label === 'permanentaddress') && isAddressMarkerValue(value)) {
      continue;
    }

    map[label] = value;
  }

  return map;
}

function getPageTextLines(rawData, sectionKey) {
  return String(rawData?.rawSections?.[sectionKey]?.pageText || '')
    .split(/\n+/)
    .map((line) => cleanValue(line))
    .filter(Boolean);
}

function collectBlockLines(lines, headingMatchers = [], stopMatchers = []) {
  let startIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeLabel(lines[index]);
    if (headingMatchers.includes(normalized)) {
      startIndex = index + 1;
      break;
    }
  }

  if (startIndex === -1) return [];

  const block = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const normalized = normalizeLabel(lines[index]);
    if (stopMatchers.includes(normalized)) {
      break;
    }
    block.push(lines[index]);
  }

  return block;
}

function extractValueFromBlock(blockLines, aliases = []) {
  for (let index = 0; index < blockLines.length; index += 1) {
    const line = blockLines[index];
    const inlineMatch = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (inlineMatch) {
      const label = normalizeLabel(inlineMatch[1]);
      if (aliases.includes(label)) {
        const value = cleanValue(inlineMatch[2]);
        if (value) return value;
      }
      continue;
    }

    const label = normalizeLabel(line);
    if (!aliases.includes(label)) continue;
    const value = cleanValue(blockLines[index + 1]);
    if (value) return value;
  }

  return null;
}

function buildAddressFromBlock(blockLines) {
  const addressParts = [];

  for (let index = 0; index < blockLines.length; index += 1) {
    const line = blockLines[index];
    const normalized = normalizeLabel(line);
    if (!['address', 'address1', 'address2', 'address3'].includes(normalized)) {
      continue;
    }

    const inlineMatch = line.match(/^([^:]{2,80}):\s*(.+)$/);
    const inlineValue = cleanValue(inlineMatch ? inlineMatch[2] : null);
    const value = inlineValue && !isAddressMarkerValue(inlineValue)
      ? inlineValue
      : cleanValue(blockLines[index + 1]);
    if (value) {
      addressParts.push(value);
    }
  }

  return dedupeBy(addressParts, (part) => part).join(', ') || null;
}

function extractGroupedContactInfo(rawData) {
  const lines = getPageTextLines(rawData, 'contactInfo');
  if (!lines.length) {
    return {
      student: {},
      parent: {},
      correspondence: {},
      permanent: {}
    };
  }

  const studentBlock = collectBlockLines(lines, ['studentcontactdetails'], ['parentcontactdetails', 'correspondenceaddress', 'permanentaddress']);
  const parentBlock = collectBlockLines(lines, ['parentcontactdetails'], ['correspondenceaddress', 'permanentaddress']);
  const correspondenceBlock = collectBlockLines(lines, ['correspondenceaddress'], ['permanentaddress']);
  const permanentBlock = collectBlockLines(lines, ['permanentaddress'], []);

  return {
    student: {
      phone: extractValueFromBlock(studentBlock, ['cellmobile', 'mobile', 'mobileno', 'mobilenumber']),
      telephone: extractValueFromBlock(studentBlock, ['telephoneno', 'telephone']),
      email: extractValueFromBlock(studentBlock, ['personalemailid', 'emailid', 'email'])
    },
    parent: {
      phone: extractValueFromBlock(parentBlock, ['cellmobile', 'mobile', 'mobileno', 'mobilenumber']),
      telephone: extractValueFromBlock(parentBlock, ['telephoneno', 'telephone']),
      email: extractValueFromBlock(parentBlock, ['emailid', 'email'])
    },
    correspondence: {
      address: buildAddressFromBlock(correspondenceBlock),
      city: extractValueFromBlock(correspondenceBlock, ['city']),
      district: extractValueFromBlock(correspondenceBlock, ['district']),
      state: extractValueFromBlock(correspondenceBlock, ['state']),
      postalCode: extractValueFromBlock(correspondenceBlock, ['postalcode', 'pincode', 'zipcode'])
    },
    permanent: {
      address: buildAddressFromBlock(permanentBlock),
      city: extractValueFromBlock(permanentBlock, ['city']),
      district: extractValueFromBlock(permanentBlock, ['district']),
      state: extractValueFromBlock(permanentBlock, ['state']),
      postalCode: extractValueFromBlock(permanentBlock, ['postalcode', 'pincode', 'zipcode'])
    }
  };
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
      const attended = toNumber(pickFirst(item.present_count, item.presentCount, item.attended, item.present, item.attendedClasses)) ?? totalFraction?.first ?? null;
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
      const marksObtained = toNumber(pickFirst(item.marks_obtained, item.marks, item.score, item.total_score, item.marksObtained));
      const totalMarks = toNumber(pickFirst(item.total_marks, item.max_marks, item.out_of, item.totalMarks));
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
        publishedAt: serializeDate(item.published_at || item.result_date || item.exam_date || item.publishedAt)
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

function normalizeStructuredArray(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (Array.isArray(item)) {
        const row = item.map((cell) => cleanValue(cell)).filter((cell) => cell !== null);
        return row.length ? row : null;
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = {};
      Object.entries(item).forEach(([key, value]) => {
        const cleaned = cleanValue(value);
        if (cleaned !== null) {
          record[key] = cleaned;
        }
      });

      return Object.keys(record).length ? record : null;
    })
    .filter(Boolean);
}

function isTimetableTable(table) {
  const title = normalizeLabel(table?.title);
  const headerText = normalizeLabel((table?.headers || []).join(' '));

  return (
    table?.sectionKey === 'timetable' ||
    title.includes('timetable') ||
    title.includes('schedule') ||
    headerText.includes('monday') ||
    headerText.includes('tuesday') ||
    headerText.includes('wednesday') ||
    headerText.includes('thursday') ||
    headerText.includes('friday') ||
    headerText.includes('saturday')
  );
}

function isSubjectTable(table) {
  const title = normalizeLabel(table?.title);
  const headerText = normalizeLabel((table?.headers || []).join(' '));

  return (
    table?.sectionKey === 'subjects' ||
    title.includes('registeredsubject') ||
    title.includes('subjects') ||
    title.includes('courses') ||
    headerText.includes('subjectcode') ||
    headerText.includes('subjectname') ||
    headerText.includes('coursecode') ||
    headerText.includes('coursename')
  );
}

function normalizeTimetableRecords(rawData) {
  const directRecords = normalizeStructuredArray(rawData?.timetable);
  if (directRecords.length) {
    return directRecords;
  }

  const records = [];
  collectTables(rawData)
    .filter(isTimetableTable)
    .forEach((table) => {
      const objectRows = tableToObjects(table).map((row) =>
        Object.fromEntries(
          Object.entries(row || {})
            .map(([key, value]) => [key, cleanValue(value)])
            .filter(([, value]) => value !== null)
        )
      ).filter((row) => Object.keys(row).length);

      if (objectRows.length) {
        records.push(...objectRows);
        return;
      }

      const normalized = normalizeTable(table);
      if (!normalized?.rows?.length) return;
      normalized.rows.forEach((row) => {
        const cells = row.map((cell) => cleanValue(cell)).filter((cell) => cell !== null);
        if (cells.length) {
          records.push(cells);
        }
      });
    });

  return dedupeBy(records, (item) => JSON.stringify(item));
}

function normalizeSubjectRecords(rawData) {
  const directRecords = normalizeStructuredArray(rawData?.subjects || rawData?.courses);
  if (directRecords.length) {
    return directRecords;
  }

  const records = collectTables(rawData)
    .filter(isSubjectTable)
    .flatMap((table) => tableToObjects(table))
    .map((row) =>
      Object.fromEntries(
        Object.entries(row || {})
          .map(([key, value]) => [key, cleanValue(value)])
          .filter(([, value]) => value !== null)
      )
    )
    .filter((row) => Object.keys(row).length);

  return dedupeBy(records, (item) => JSON.stringify(item));
}

function buildProfileSummary(rawData) {
  const groupedContact = extractGroupedContactInfo(rawData);
  const correspondenceAddressCandidate = findFieldValue(rawData, 'correspondenceAddress');
  const permanentAddressCandidate = findFieldValue(rawData, 'permanentAddress', rawData?.profile?.address);
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
    email: findFieldValue(rawData, 'email', rawData?.profile?.email, groupedContact.student.email),
    alternateEmail: findFieldValue(rawData, 'alternateEmail'),
    phone: findFieldValue(rawData, 'phone', rawData?.profile?.phone, groupedContact.student.phone),
    alternatePhone: findFieldValue(rawData, 'alternatePhone', groupedContact.student.telephone),
    guardianPhone: findFieldValue(rawData, 'guardianPhone', groupedContact.parent.phone, groupedContact.parent.telephone),
    correspondenceAddress: isAddressMarkerValue(correspondenceAddressCandidate)
      ? groupedContact.correspondence.address
      : pickFirst(correspondenceAddressCandidate, groupedContact.correspondence.address),
    permanentAddress: isAddressMarkerValue(permanentAddressCandidate)
      ? groupedContact.permanent.address
      : pickFirst(permanentAddressCandidate, groupedContact.permanent.address),
    city: findFieldValue(rawData, 'city', groupedContact.correspondence.city, groupedContact.permanent.city),
    district: findFieldValue(rawData, 'district', groupedContact.correspondence.district, groupedContact.permanent.district),
    state: findFieldValue(rawData, 'state', groupedContact.correspondence.state, groupedContact.permanent.state),
    postalCode: findFieldValue(rawData, 'postalCode', groupedContact.correspondence.postalCode, groupedContact.permanent.postalCode),
    photoUrl
  };
}

function normalizeSoaPortalData(rawData = {}) {
  const profile = buildProfileSummary(rawData);
  const attendance = normalizeAttendanceRecords(rawData);
  const semesterResults = normalizeSemesterResults(rawData);
  const marks = normalizeMarksRecords(rawData, semesterResults);
  const qualifications = normalizeQualifications(rawData);
  const timetable = normalizeTimetableRecords(rawData);
  const subjects = normalizeSubjectRecords(rawData);
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
    timetable,
    subjects,
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
    dataSource: normalized.dataSource || 'cached_soa_import',
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

async function ensureSqlPortalSnapshotTable() {
  return false;
}

function toSqlJson(value) {
  return value === undefined ? null : JSON.stringify(value ?? null);
}

function fromSqlJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }
  return value;
}

function buildSqlSnapshotRow(updateData = {}, options = {}) {
  return {
    userId: cleanValue(options.userId) || cleanValue(updateData.portalRegistrationNumber),
    registrationNumber: cleanValue(updateData.portalRegistrationNumber),
    portalConnected: Boolean(updateData.portalConnected),
    portalNeedsReconnect: Boolean(updateData.portalNeedsReconnect),
    isVerified: Boolean(updateData.isVerified),
    portalProvider: cleanValue(updateData.portalProvider),
    portalLastSynced: updateData.portal_last_synced ? new Date(updateData.portal_last_synced) : null,
    dataSource: pickFirst(updateData.dataSource, updateData.portalData?.dataSource, 'cached_soa_import'),
    portalData: updateData.portalData || null,
    profile: updateData.profile || {},
    attendanceData: Array.isArray(updateData.attendance_data) ? updateData.attendance_data : [],
    marksData: Array.isArray(updateData.marks_data) ? updateData.marks_data : [],
    timetableData: Array.isArray(updateData.timetable_data) ? updateData.timetable_data : [],
    coursesData: Array.isArray(updateData.courses_data) ? updateData.courses_data : [],
    resultsData: Array.isArray(updateData.results_data) ? updateData.results_data : [],
    notificationsData: Array.isArray(updateData.notifications_data) ? updateData.notifications_data : [],
    backlogsData: Array.isArray(updateData.backlogs_data) ? updateData.backlogs_data : [],
    internalAssessmentsData: Array.isArray(updateData.internal_assessments_data) ? updateData.internal_assessments_data : [],
    feesData: updateData.fees_data || {},
    updatedAt: updateData.updated_at ? new Date(updateData.updated_at) : new Date()
  };
}

async function writeSqlPortalSnapshot(updateData, options = {}) {
  return true;
}

function hydrateSqlPortalSnapshot(row = {}) {
  return {
    portalConnected: Boolean(row.portal_connected),
    portalNeedsReconnect: Boolean(row.portal_needs_reconnect),
    isVerified: Boolean(row.is_verified),
    portalProvider: cleanValue(row.portal_provider),
    portalRegistrationNumber: cleanValue(row.registration_number),
    portal_last_synced: row.portal_last_synced || null,
    dataSource: cleanValue(row.data_source),
    portalData: fromSqlJson(row.portal_data),
    profile: fromSqlJson(row.profile, {}),
    attendance_data: fromSqlJson(row.attendance_data, []),
    marks_data: fromSqlJson(row.marks_data, []),
    timetable_data: fromSqlJson(row.timetable_data, []),
    courses_data: fromSqlJson(row.courses_data, []),
    results_data: fromSqlJson(row.results_data, []),
    notifications_data: fromSqlJson(row.notifications_data, []),
    backlogs_data: fromSqlJson(row.backlogs_data, []),
    internal_assessments_data: fromSqlJson(row.internal_assessments_data, []),
    fees_data: fromSqlJson(row.fees_data, {}),
    updated_at: row.updated_at || null
  };
}

async function readSqlPortalSnapshot(userId, registrationNumber) {
  return null;
}

function getStoreKeys(userId, registrationNumber) {
  return dedupeBy(
    [cleanValue(userId), cleanValue(registrationNumber)].filter(Boolean),
    (item) => item
  );
}

async function readUserDoc(userId, registrationNumber) {
  const keys = getStoreKeys(userId, registrationNumber);

  try {
    const sqlRecord = await readSqlPortalSnapshot(userId, registrationNumber);
    if (sqlRecord) {
      return sqlRecord;
    }
  } catch (_) {
    // Fall back to Firestore or in-memory stores below.
  }

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
  const keys = getStoreKeys(userId, registrationNumber);

  try {
    await writeSqlPortalSnapshot(updateData, {
      userId: primaryKey
    });
  } catch (_) {
    // Fall back to Firestore and in-memory cache below.
  }

  if (isFirebaseAdminReady) {
    for (const key of primaryKey ? [primaryKey] : []) {
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
    dataSource: pickFirst(current.data.dataSource, current.data.portalData?.dataSource, 'cached_soa_import'),
    updated_at: new Date()
  };

  const primaryKey = cleanValue(userId || current.id) || cleanValue(registrationNumber);
  const keys = getStoreKeys(primaryKey, registrationNumber || current.data.portalRegistrationNumber);

  try {
    await writeSqlPortalSnapshot({
      ...current.data,
      ...updateData
    }, {
      userId: primaryKey
    });
  } catch (_) {
    // Fall back to Firestore and in-memory cache below.
  }

  if (isFirebaseAdminReady) {
    for (const key of primaryKey ? [primaryKey] : []) {
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
