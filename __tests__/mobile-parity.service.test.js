const mockDbQuery = jest.fn(async () => {
  throw new Error('db unavailable');
});

const mockGetPortalSnapshotForUser = jest.fn(async () => ({
  normalizedData: {
    timetable: [
      {
        day: 'Monday',
        time_slot: '09:00-10:00',
        subject: 'Algorithms',
        room: '301',
        teacher: 'Dr. Rao'
      }
    ]
  },
  status: {
    connected: true,
    isVerified: true,
    lastSynced: '2026-03-21T08:00:00.000Z',
    dataSource: 'firebase_portal_import'
  }
}));

const mockBuildAttendanceRouteData = jest.fn(() => ({
  source: 'soa_import',
  summary: [
    {
      subject: 'Algorithms',
      subject_code: 'CSE401',
      total_classes: 45,
      present_count: 42,
      percentage: 93.33
    }
  ],
  records: []
}));

const mockBuildMarksRouteData = jest.fn(() => ({
  source: 'soa_import',
  summary: [
    {
      subject: 'Algorithms',
      exam_type: 'Mid Sem',
      avg_marks: 45,
      avg_total: 50
    }
  ],
  marks: [
    {
      subject: 'Algorithms',
      subject_code: 'CSE401',
      exam_type: 'Mid Sem',
      marks_obtained: 45,
      total_marks: 50,
      grade: 'A'
    }
  ]
}));

function toDocs(items) {
  return items.map((item) => ({
    id: item.id,
    data: () => {
      const { id, ...rest } = item;
      return rest;
    }
  }));
}

function mockCreateCollection(name) {
  if (name === 'files') {
    const items = [
      {
        id: 'file-approved',
        approved: true,
        title: 'Approved Note',
        original_name: 'approved-note.pdf',
        category: 'note',
        subject: 'Algorithms',
        description: 'Approved material'
      },
      {
        id: 'file-pending',
        approved: false,
        title: 'Pending Note',
        original_name: 'pending-note.pdf',
        category: 'note',
        subject: 'Algorithms'
      }
    ];

    return {
      where: jest.fn((field, _op, value) => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: toDocs(items.filter((item) => item[field] === value))
          })
        }))
      })),
      limit: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: toDocs(items) })
      }))
    };
  }

  if (name === 'forum_questions') {
    return {
      limit: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          docs: toDocs([
            {
              id: 'forum-1',
              title: 'How should I revise graphs?',
              description: 'Need a quick revision plan',
              category: 'Algorithms',
              author_name: 'Asha'
            }
          ])
        })
      }))
    };
  }

  if (name === 'payments') {
    const items = [
      {
        id: 'payment-1',
        userId: 'STU20250001',
        paymentId: 'PAY1001',
        category: 'Semester Fee',
        semester: '6',
        amount: 52000,
        status: 'completed'
      }
    ];

    return {
      where: jest.fn((field, _op, value) => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: toDocs(items.filter((item) => item[field] === value))
          })
        }))
      }))
    };
  }

  return {
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ docs: [] })
      }))
    })),
    limit: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ docs: [] })
    }))
  };
}

jest.mock('../server/database/db', () => ({
  query: (...args) => mockDbQuery(...args)
}));

jest.mock('../server/database/firebase', () => ({
  db: {
    collection: jest.fn((name) => mockCreateCollection(name))
  },
  isFirebaseAdminReady: true
}));

jest.mock('../server/config/featureFlags', () => ({
  isPortalEnabled: jest.fn(() => true)
}));

jest.mock('../server/services/soa-data.service', () => ({
  getPortalSnapshotForUser: (...args) => mockGetPortalSnapshotForUser(...args),
  buildAttendanceRouteData: (...args) => mockBuildAttendanceRouteData(...args),
  buildMarksRouteData: (...args) => mockBuildMarksRouteData(...args)
}));

const { buildSnapshot } = require('../server/services/mobile-parity.service');

describe('mobile parity service', () => {
  test('buildSnapshot uses portal-imported student data and shared Firebase-backed files', async () => {
    const snapshot = await buildSnapshot({
      id: 'STU20250001',
      registration_number: 'STU20250001',
      name: 'Asha Das',
      role: 'student',
      department: 'CSE',
      year: 3,
      section: 'A',
      semester: '6'
    });

    expect(mockGetPortalSnapshotForUser).toHaveBeenCalledWith({
      userId: 'STU20250001',
      registrationNumber: 'STU20250001'
    });
    expect(snapshot.portal).toMatchObject({
      enabled: true,
      connected: true,
      verified: true,
      dataSource: 'firebase_portal_import'
    });
    expect(snapshot.shared.fileHub).toHaveLength(1);
    expect(snapshot.shared.fileHub[0]).toMatchObject({
      id: 'file-approved',
      title: 'Approved Note'
    });
    expect(snapshot.student.attendance.summary[0]).toMatchObject({
      subject: 'Algorithms',
      total_classes: 45,
      present_count: 42
    });
    expect(snapshot.student.marks.marks[0]).toMatchObject({
      subject: 'Algorithms',
      marks_obtained: 45,
      total_marks: 50
    });
    expect(snapshot.student.timetable[0]).toMatchObject({
      day_of_week: 'Monday',
      subject: 'Algorithms',
      room: '301'
    });
  });
});
