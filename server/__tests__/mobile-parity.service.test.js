/** @jest-environment node */

const parityService = require('../services/mobile-parity.service');
const {
  localPortalStore,
  normalizeSoaPortalData,
  persistPortalDataForUser
} = require('../services/soa-data.service');

describe('mobile-parity.service', () => {
  beforeEach(() => {
    localPortalStore.clear();
  });

  test('buildSnapshot reuses stored portal attendance, marks, and timetable for student parity', async () => {
    const user = {
      id: 'STU20990101',
      registration_number: 'STU20990101',
      name: 'Native Snapshot Student',
      email: 'snapshot.student@iter.edu',
      role: 'student',
      department: 'CSE',
      year: 3,
      section: 'A',
      semester: '5'
    };

    const normalized = normalizeSoaPortalData({
      profile: {
        name: user.name,
        registration_number: user.registration_number,
        department: user.department,
        semester: user.semester
      },
      attendance: [
        {
          subject: 'Android Migration Studio',
          subject_code: 'CSE777',
          attended: 19,
          total: 20,
          percentage: '95%'
        }
      ],
      marks: [
        {
          subject: 'Android Migration Studio',
          subject_code: 'CSE777',
          marks: 48,
          total_marks: 50,
          exam_type: 'sessional',
          grade: 'O'
        }
      ],
      timetable: [
        {
          day: 'Friday',
          time_slot: '14:00-15:00',
          subject: 'Android Migration Studio',
          teacher: 'Prof. Native',
          room: 'C-401'
        }
      ],
      dataSource: 'firebase_mobile_snapshot_test'
    });

    await persistPortalDataForUser({
      userId: user.id,
      registrationNumber: user.registration_number,
      normalizedData: normalized,
      isVerified: true,
      portalConnected: true
    });

    const snapshot = await parityService.buildSnapshot(user);

    expect(snapshot.user.registration_number).toBe('STU20990101');
    expect(snapshot.portal).toMatchObject({
      connected: true,
      verified: true,
      dataSource: 'firebase_mobile_snapshot_test'
    });
    expect(snapshot.navigation.some((item) => item.route === 'studentAi')).toBe(true);
    expect(snapshot.student.attendance.summary[0]).toMatchObject({
      subject: 'Android Migration Studio',
      percentage: 95
    });
    expect(snapshot.student.marks.summary[0].subject).toBe('Android Migration Studio');
    expect(snapshot.student.timetable[0].subject).toBe('Android Migration Studio');
    expect(Array.isArray(snapshot.shared.fileHub)).toBe(true);
  });
});
