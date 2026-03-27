/** @jest-environment node */

const mockSet = jest.fn().mockRejectedValue(new Error('firestore write failed'));

jest.mock('../database/firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: mockSet
      }))
    }))
  },
  isFirebaseAdminReady: true
}));

const {
  compactPortalDataForStorage,
  localPortalStore,
  normalizeSoaPortalData,
  persistPortalDataForUser
} = require('../services/soa-data.service');

describe('soa-data persistence safeguards', () => {
  beforeEach(() => {
    localPortalStore.clear();
    mockSet.mockClear();
  });

  test('compacts raw portal sections before persistence', () => {
    const normalized = normalizeSoaPortalData({
      profile: {
        name: 'Compact Student',
        registration_number: 'STU20990091',
        department: 'CSE'
      },
      rawSections: {
        admitCard: {
          title: 'Admit Card',
          pageText: 'x'.repeat(5000),
          fields: {
            RollNumber: '24E119C17'
          },
          tables: [
            {
              title: 'Exam Slots',
              headers: ['Subject', 'Date'],
              rows: [
                ['Compiler Design', '2026-03-25']
              ]
            }
          ]
        }
      },
      dataSource: 'compact_test'
    });

    const compact = compactPortalDataForStorage(normalized);

    expect(compact.raw.sections.admitCard).toMatchObject({
      title: 'Admit Card',
      fields: {
        RollNumber: '24E119C17'
      }
    });
    expect(compact.raw.sections.admitCard.pageText).toBeUndefined();
    expect(compact.raw.rawHtml).toBeUndefined();
  });

  test('throws when Firestore persistence fails on Firebase-backed deployments', async () => {
    const normalized = normalizeSoaPortalData({
      profile: {
        name: 'Persist Failure Student',
        registration_number: 'STU20990092',
        department: 'CSE',
        semester: 6
      },
      attendance: [
        {
          subject: 'Distributed Systems',
          subject_code: 'CSE602',
          attended: 18,
          total: 20,
          percentage: '90%'
        }
      ],
      marks: [
        {
          subject: 'Distributed Systems',
          subject_code: 'CSE602',
          marks: 44,
          total_marks: 50,
          exam_type: 'mid-semester',
          grade: 'A'
        }
      ],
      rawSections: {
        marks: {
          title: 'Marks',
          pageText: 'y'.repeat(4000),
          tables: [
            {
              headers: ['Subject', 'Marks'],
              rows: [['Distributed Systems', '44']]
            }
          ]
        }
      },
      dataSource: 'persist_failure_test'
    });

    await expect(
      persistPortalDataForUser({
        userId: 'STU20990092',
        registrationNumber: 'STU20990092',
        normalizedData: normalized,
        isVerified: true,
        portalConnected: true
      })
    ).rejects.toMatchObject({
      code: 'PORTAL_PERSIST_FAILED'
    });

    expect(mockSet).toHaveBeenCalled();
    expect(localPortalStore.get('STU20990092')).toMatchObject({
      portalConnected: true,
      portalData: expect.objectContaining({
        provider: 'soa',
        dataSource: 'persist_failure_test'
      })
    });
    expect(localPortalStore.get('STU20990092').portalData.raw.sections.marks.pageText).toBeUndefined();
  });
});
