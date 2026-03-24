/** @jest-environment node */

const {
  localPortalStore,
  normalizeSoaPortalData,
  persistPortalDataForUser,
  getPortalSnapshotForUser,
  disconnectPortalForUser
} = require('../services/soa-data.service');

describe('soa-data.service', () => {
  beforeEach(() => {
    localPortalStore.clear();
  });

  test('persists normalized portal data and exposes a connected snapshot', async () => {
    const normalized = normalizeSoaPortalData({
      profile: {
        name: 'Portal Native Student',
        registration_number: 'STU20990011',
        department: 'CSE',
        semester: 6
      },
      attendance: [
        {
          subject: 'Native Systems Design',
          subject_code: 'CSE601',
          attended: 18,
          total: 20,
          percentage: '90%'
        }
      ],
      marks: [
        {
          subject: 'Native Systems Design',
          subject_code: 'CSE601',
          marks: 46,
          total_marks: 50,
          exam_type: 'mid-semester',
          grade: 'A'
        }
      ],
      timetable: [
        {
          day: 'Monday',
          time_slot: '09:00-10:00',
          subject: 'Native Systems Design',
          teacher: 'Dr. Compose',
          room: 'Lab 3'
        }
      ],
      dataSource: 'firebase_native_test'
    });

    await persistPortalDataForUser({
      userId: 'STU20990011',
      registrationNumber: 'STU20990011',
      normalizedData: normalized,
      isVerified: true,
      portalConnected: true
    });

    const snapshot = await getPortalSnapshotForUser({
      userId: 'STU20990011',
      registrationNumber: 'STU20990011'
    });

    expect(snapshot.source).toBe('memory');
    expect(snapshot.status).toMatchObject({
      connected: true,
      isVerified: true,
      hasImportedData: true,
      dataSource: 'firebase_native_test'
    });
    expect(snapshot.normalizedData.profile.registrationNumber).toBe('STU20990011');
    expect(snapshot.normalizedData.attendance.summary[0]).toMatchObject({
      subject: 'Native Systems Design',
      percentage: 90
    });
    expect(snapshot.normalizedData.marks.summary[0].subject).toBe('Native Systems Design');
  });

  test('disconnect marks the stored portal data as needing reconnect without removing imported data', async () => {
    const normalized = normalizeSoaPortalData({
      profile: {
        name: 'Reconnect Student',
        registration_number: 'STU20990012',
        department: 'IT'
      },
      attendance: [
        { subject: 'Applied Kotlin', attended: 8, total: 10, percentage: '80%' }
      ],
      dataSource: 'firebase_disconnect_test'
    });

    await persistPortalDataForUser({
      userId: 'STU20990012',
      registrationNumber: 'STU20990012',
      normalizedData: normalized,
      isVerified: true,
      portalConnected: true
    });

    await disconnectPortalForUser({
      userId: 'STU20990012',
      registrationNumber: 'STU20990012'
    });

    const snapshot = await getPortalSnapshotForUser({
      userId: 'STU20990012',
      registrationNumber: 'STU20990012'
    });

    expect(snapshot.status.connected).toBe(false);
    expect(snapshot.status.needsReconnect).toBe(true);
    expect(snapshot.status.hasImportedData).toBe(true);
    expect(snapshot.normalizedData.attendance.summary[0].subject).toBe('Applied Kotlin');
  });

  test('preserves richer SOA sections after persisting and reloading a saved snapshot', async () => {
    const normalized = normalizeSoaPortalData({
      profile: {
        name: 'Snapshot Student',
        registration_number: 'STU20990013',
        department: 'CSE',
        semester: 7
      },
      timetable: [
        {
          day: 'Monday',
          time_slot: '08:00-09:00',
          subject: 'Compiler Design',
          teacher: 'Dr. Parser',
          room: 'LH-7'
        }
      ],
      subjects: [
        {
          subject_code: 'CSE701',
          subject_name: 'Compiler Design',
          credits: '4'
        }
      ],
      internalAssessments: [
        {
          subject: 'Compiler Design',
          quiz_1: 9,
          assignment_1: 10,
          total: 19
        }
      ],
      notifications: [
        {
          title: 'Mid-semester registration',
          published_at: '2026-03-20T10:00:00.000Z'
        }
      ],
      backlogs: [
        {
          subject: 'Theory of Computation',
          status: 'Cleared'
        }
      ],
      fees: {
        outstandingAmount: 0,
        status: 'Paid'
      },
      dataSource: 'firebase_rich_snapshot_test'
    });

    await persistPortalDataForUser({
      userId: 'STU20990013',
      registrationNumber: 'STU20990013',
      normalizedData: normalized,
      isVerified: true,
      portalConnected: true
    });

    const snapshot = await getPortalSnapshotForUser({
      userId: 'STU20990013',
      registrationNumber: 'STU20990013'
    });

    expect(snapshot.normalizedData.timetable).toHaveLength(1);
    expect(snapshot.normalizedData.timetable[0]).toMatchObject({
      subject: 'Compiler Design',
      room: 'LH-7'
    });
    expect(snapshot.normalizedData.subjects).toHaveLength(1);
    expect(snapshot.normalizedData.subjects[0]).toMatchObject({
      subject_code: 'CSE701',
      subject_name: 'Compiler Design'
    });
    expect(Array.isArray(snapshot.normalizedData.results)).toBe(true);
    expect(snapshot.normalizedData.internalAssessments).toHaveLength(1);
    expect(snapshot.normalizedData.notifications).toHaveLength(1);
    expect(snapshot.normalizedData.backlogs).toHaveLength(1);
    expect(snapshot.normalizedData.fees).toMatchObject({
      status: 'Paid'
    });
  });

  test('normalizes timetable and subject rows from captured SOA section tables', () => {
    const normalized = normalizeSoaPortalData({
      rawSections: {
        timetable: {
          tables: [
            {
              headers: ['Monday', 'Tuesday', 'Wednesday'],
              rows: [
                ['08:00 AM to 09:00 AM CSE3141 Lab', '10:00 AM to 11:00 AM MTH3003 Room 411', '']
              ]
            }
          ]
        },
        subjects: {
          tables: [
            {
              title: 'Registered Subjects',
              headers: ['Subject Code', 'Subject Name', 'Credits'],
              rows: [
                ['CSE3141', 'Computer Science Workshop 2', '2'],
                ['MTH3003', 'Applied Linear Algebra', '4']
              ]
            }
          ]
        }
      },
      dataSource: 'raw_sections_test'
    });

    expect(normalized.timetable).toHaveLength(1);
    expect(normalized.timetable[0]).toMatchObject({
      monday: '08:00 AM to 09:00 AM CSE3141 Lab',
      tuesday: '10:00 AM to 11:00 AM MTH3003 Room 411'
    });
    expect(normalized.subjects).toHaveLength(2);
    expect(normalized.subjects[0]).toMatchObject({
      subjectcode: 'CSE3141',
      subjectname: 'Computer Science Workshop 2',
      credits: '2'
    });
  });
});
