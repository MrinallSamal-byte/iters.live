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
});
