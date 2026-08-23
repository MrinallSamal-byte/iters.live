/** @jest-environment node */

const {
  localPortalStore,
  normalizeSoaPortalData,
  __private
} = require('../services/soa-data.service');

const { toNumber, toPercentage, mergePreservingBest, normalizeSubjectRecords } = __private;

describe('soa-data parsing helpers', () => {
  beforeEach(() => {
    localPortalStore.clear();
  });

  describe('toNumber', () => {
    test('takes the numerator from fractions like 18/20', () => {
      expect(toNumber('18/20')).toBe(18);
    });

    test('treats comma groups as thousands separators', () => {
      expect(toNumber('1,234')).toBe(1234);
    });

    test('treats a single comma as a decimal separator', () => {
      expect(toNumber('1,5')).toBe(1.5);
    });

    test('parses percentages down to the numeric value', () => {
      expect(toNumber('84.5%')).toBe(84.5);
    });

    test('returns null for non-numeric text', () => {
      expect(toNumber('abc')).toBeNull();
    });

    test('returns null for empty input', () => {
      expect(toNumber('')).toBeNull();
    });

    test('keeps negative numbers intact', () => {
      expect(toNumber('-3')).toBe(-3);
    });
  });

  describe('toPercentage', () => {
    test('parses valid percentages', () => {
      expect(toPercentage('84.5%')).toBe(84.5);
    });

    test('rejects values above 100 instead of clamping', () => {
      expect(toPercentage('120%')).toBeNull();
    });

    test('rejects negative values', () => {
      expect(toPercentage('-5%')).toBeNull();
    });

    test('accepts fraction strings within range', () => {
      expect(toPercentage('18/20')).toBe(18);
    });

    test('returns null for non-numeric placeholders', () => {
      expect(toPercentage('n/a')).toBeNull();
    });
  });

  describe('mergePreservingBest', () => {
    test('restores previous arrays when the next snapshot is degraded and keeps next metadata', () => {
      const previous = {
        profile: { studentName: 'Old Student' },
        fetchedAt: '2026-01-01T00:00:00.000Z',
        qualifications: [],
        attendance: {
          records: [
            { subject: 'Compiler Design', subjectCode: 'CSE701', attendedClasses: 18, totalClasses: 20, percentage: 90 },
            { subject: 'Operating Systems', subjectCode: 'CSE702', attendedClasses: 16, totalClasses: 20, percentage: 80 }
          ],
          summary: [],
          overall: { presentClasses: 0, totalClasses: 0, percentage: null }
        },
        marks: { records: [], summary: [], cgpa: null, sgpa: null },
        results: [],
        internalAssessments: [],
        timetable: [],
        subjects: [],
        notifications: []
      };
      const next = {
        profile: { studentName: 'New Student' },
        fetchedAt: '2026-08-01T00:00:00.000Z',
        qualifications: [],
        attendance: { records: [], summary: [], overall: { presentClasses: 0, totalClasses: 0, percentage: null } },
        marks: {
          records: [
            { subject: 'Database Systems', subjectCode: 'CSE703', marksObtained: 44, totalMarks: 50 },
            { subject: 'Computer Networks', subjectCode: 'CSE704', marksObtained: 40, totalMarks: 50 }
          ],
          summary: [],
          cgpa: null,
          sgpa: null
        },
        results: [],
        internalAssessments: [],
        timetable: [],
        subjects: [],
        notifications: []
      };

      const merged = mergePreservingBest(previous, next);

      expect(merged.attendance.records).toHaveLength(2);
      expect(merged.attendance.records[0]).toMatchObject({ subject: 'Compiler Design', percentage: 90 });
      expect(merged.marks.records).toHaveLength(2);
      expect(merged.marks.records[0]).toMatchObject({ subject: 'Database Systems', marksObtained: 44 });
      expect(merged.profile.studentName).toBe('New Student');
      expect(merged.fetchedAt).toBe('2026-08-01T00:00:00.000Z');
    });

    test('prefers next data whenever it is present', () => {
      const previous = {
        attendance: { records: [{ subject: 'Stale Subject' }], summary: [] },
        marks: { records: [], summary: [] },
        notifications: [{ title: 'Old notice' }]
      };
      const next = {
        attendance: { records: [{ subject: 'Fresh Subject' }], summary: [] },
        marks: { records: [], summary: [] },
        notifications: [{ title: 'New notice' }]
      };

      const merged = mergePreservingBest(previous, next);

      expect(merged.attendance.records).toEqual([{ subject: 'Fresh Subject' }]);
      expect(merged.notifications).toEqual([{ title: 'New notice' }]);
    });

    test('returns empty regions untouched when both sides are empty', () => {
      const previous = {
        profile: {},
        fetchedAt: '2026-01-01T00:00:00.000Z',
        attendance: { records: [], summary: [] },
        marks: { records: [], summary: [] },
        subjects: [],
        notifications: []
      };
      const next = {
        profile: {},
        fetchedAt: '2026-08-01T00:00:00.000Z',
        attendance: { records: [], summary: [] },
        marks: { records: [], summary: [] },
        subjects: [],
        notifications: []
      };

      const merged = mergePreservingBest(previous, next);

      expect(merged.attendance.records).toEqual([]);
      expect(merged.marks.records).toEqual([]);
      expect(merged.subjects).toEqual([]);
      expect(merged.notifications).toEqual([]);
      expect(merged.fetchedAt).toBe('2026-08-01T00:00:00.000Z');
    });

    test('passes through the next snapshot when no previous snapshot exists', () => {
      const next = {
        profile: { studentName: 'Only Student' },
        attendance: { records: [{ subject: 'Compiler Design' }], summary: [] }
      };

      expect(mergePreservingBest(null, next)).toBe(next);
    });
  });

  describe('normalizeSubjectRecords', () => {
    test('prefers clean section tables over a noisy list capture', () => {
      const rawData = {
        rawSections: {
          subjects: {
            title: 'Registered Subjects',
            tables: [
              {
                title: 'Registered Subjects',
                headers: ['Subject Code', 'Subject Name', 'Credits'],
                rows: [
                  ['CSE3141', 'Computer Science Workshop 2', '2'],
                  ['MTH3003', 'Applied Linear Algebra', '4'],
                  ['CSE3005', 'Software Engineering', '3']
                ]
              }
            ]
          }
        },
        subjects: [
          { name: 'Home' },
          { name: 'Dashboard' },
          { name: 'Attendance' },
          { name: 'Marks' },
          { name: 'Time Table' },
          { name: 'Logout' }
        ]
      };

      const records = normalizeSubjectRecords(rawData);

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual({
        subjectcode: 'CSE3141',
        subjectname: 'Computer Science Workshop 2',
        credits: '2'
      });
      expect(records.map((record) => record.subjectcode)).toEqual(['CSE3141', 'MTH3003', 'CSE3005']);
    });

    test('falls back to the list capture when no section tables exist', () => {
      const records = normalizeSubjectRecords({
        subjects: [
          { name: 'Computer Science Workshop 2' },
          { name: 'Applied Linear Algebra' }
        ]
      });

      expect(records).toEqual([
        { name: 'Computer Science Workshop 2' },
        { name: 'Applied Linear Algebra' }
      ]);
    });

    test('wires table preference into full normalization output', () => {
      const normalized = normalizeSoaPortalData({
        rawSections: {
          subjects: {
            tables: [
              {
                headers: ['Subject Code', 'Subject Name'],
                rows: [['CSE3141', 'Computer Science Workshop 2']]
              }
            ]
          }
        },
        subjects: [
          { name: 'Home' },
          { name: 'Logout' }
        ],
        dataSource: 'subject_preference_test'
      });

      expect(normalized.subjects).toHaveLength(1);
      expect(normalized.subjects[0]).toMatchObject({ subjectcode: 'CSE3141' });
    });
  });
});
