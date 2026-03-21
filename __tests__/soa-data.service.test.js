jest.mock('../server/database/firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false })
      }))
    }))
  },
  isFirebaseAdminReady: false
}));

const {
  normalizeSoaPortalData,
  normalizeStoredPortalData,
  buildAttendanceRouteData,
  buildMarksRouteData,
  buildPortalStatusPayload
} = require('../server/services/soa-data.service');

describe('SOA data service', () => {
  test('normalizes rich SOA portal sections into student-facing data', () => {
    const normalized = normalizeSoaPortalData({
      rawSections: {
        personalInfo: {
          fields: {
            'Student Name': 'Asha Das',
            'Registration No': '2100000001',
            'Enrollment No': 'ENR-7788',
            'Institute Code': 'ITER',
            'Academic Year': '2024-25',
            'Admission Year': '2021',
            'Program': 'B.Tech',
            'Branch': 'Computer Science and Engineering',
            'Batch': '2021-2025',
            'Semester': '7',
            'Date of Birth': '2003-06-01',
            'Blood Group': 'B+',
            'Gender': 'Female',
            'Nationality': 'Indian',
            'Marital Status': 'Single',
            'Category': 'General',
            'Bank Name': 'State Bank of India',
            'Bank Account Number': '1234567890',
            'Father Name': 'Ramesh Das',
            'Father Designation': 'Engineer',
            'Mother Name': 'Sita Das',
            'Hostel Name': 'Girls Hostel',
            'Room Number': '305'
          }
        },
        contactInfo: {
          fields: {
            'Email ID': 'asha@iter.edu.in',
            'Mobile Number': '9876543210',
            'Correspondence Address': 'ITER Hostel, Bhubaneswar',
            'Permanent Address': 'Saheed Nagar, Bhubaneswar',
            'City': 'Bhubaneswar',
            'State': 'Odisha',
            'Pin Code': '751030'
          }
        },
        qualifications: {
          tables: [
            {
              headers: ['Exam', 'Board', 'Institution', 'Year of Passing', 'Percentage', 'Grade'],
              rows: [
                ['12th', 'CBSE', 'ODM Public School', '2021', '92', 'A1']
              ]
            }
          ]
        },
        attendance: {
          tables: [
            {
              headers: ['Subject Code', 'Subject', 'Present', 'Total Classes', 'Percentage'],
              rows: [
                ['CSE401', 'Algorithms', '42', '45', '93']
              ]
            }
          ]
        },
        marks: {
          tables: [
            {
              headers: ['Subject Code', 'Subject', 'Exam Type', 'Marks Obtained', 'Total Marks', 'Grade'],
              rows: [
                ['CSE401', 'Algorithms', 'Mid Sem', '45', '50', 'A']
              ]
            }
          ]
        }
      },
      profile: {
        photo: 'https://example.com/photo.jpg'
      },
      fetchedAt: '2026-03-21T08:00:00.000Z',
      dataSource: 'live_soa_portal'
    });

    expect(normalized.profile.studentName).toBe('Asha Das');
    expect(normalized.profile.registrationNumber).toBe('2100000001');
    expect(normalized.profile.enrollmentNumber).toBe('ENR-7788');
    expect(normalized.profile.branch).toBe('Computer Science and Engineering');
    expect(normalized.personalInfo.fatherDesignation).toBe('Engineer');
    expect(normalized.contactInfo.email).toBe('asha@iter.edu.in');
    expect(normalized.qualifications).toHaveLength(1);
    expect(normalized.attendance.summary[0]).toMatchObject({
      subject: 'Algorithms',
      subject_code: 'CSE401',
      present_count: 42,
      total_classes: 45
    });
    expect(normalized.marks.records[0]).toMatchObject({
      subject: 'Algorithms',
      subjectCode: 'CSE401',
      examType: 'Mid Sem',
      marksObtained: 45,
      totalMarks: 50,
      grade: 'A'
    });
  });

  test('builds attendance and marks fallback payloads for dashboard routes', () => {
    const normalized = normalizeSoaPortalData({
      attendance: [
        { subject: 'Algorithms', subject_code: 'CSE401', attended: '42', total: '45', percentage: '93' }
      ],
      marks: [
        { subject: 'Algorithms', subject_code: 'CSE401', exam_type: 'Mid Sem', marks: '45', total_marks: '50', grade: 'A' }
      ]
    });

    const attendanceRouteData = buildAttendanceRouteData(normalized);
    const marksRouteData = buildMarksRouteData(normalized);

    expect(attendanceRouteData.source).toBe('soa_import');
    expect(attendanceRouteData.summary[0].subject).toBe('Algorithms');
    expect(attendanceRouteData.summary[0].total_classes).toBe(45);
    expect(marksRouteData.source).toBe('soa_import');
    expect(marksRouteData.marks[0]).toMatchObject({
      subject: 'Algorithms',
      subject_code: 'CSE401',
      exam_type: 'Mid Sem',
      marks_obtained: 45,
      total_marks: 50
    });
  });

  test('parses attendance fractions and semester result summaries from SOA tables', () => {
    const normalized = normalizeSoaPortalData({
      rawSections: {
        attendance: {
          tables: [
            {
              headers: ['S.No', 'Stn no', 'Subject Code', 'Subject', 'Total Class', 'Attendance %'],
              rows: [
                ['1', '4', 'CHM2042', 'Introduction to Disaster Management', '9/10', '90.0'],
                ['2', '4', 'CSE2632', 'Algorithms Analysis and Design 2', '21/24', '87.5']
              ]
            }
          ]
        },
        marks: {
          tables: [
            {
              headers: ['Semester', 'Point Secured SGPA', 'Course Credits', 'Earned Credits', 'SGPA', 'CGPA'],
              rows: [
                ['1st SEM.', '179.5', '19', '19', '9.45', '9.45'],
                ['2nd SEM.', '198.5', '21', '21', '9.45', '9.45']
              ]
            }
          ]
        }
      }
    });

    expect(normalized.attendance.summary[0]).toMatchObject({
      subject: 'Introduction to Disaster Management',
      subject_code: 'CHM2042',
      present_count: 9,
      total_classes: 10,
      percentage: 90
    });
    expect(normalized.semesterResults).toHaveLength(2);
    expect(normalized.semesterResults[0]).toMatchObject({
      semester: '1st SEM.',
      pointsSecured: 179.5,
      courseCredits: 19,
      earnedCredits: 19,
      sgpa: 9.45,
      cgpa: 9.45
    });

    const fallback = buildMarksRouteData(normalized);
    expect(fallback.summary[0]).toMatchObject({
      subject: 'Semester 1st SEM.',
      avg_marks: 9.45,
      avg_total: 10,
      exam_type: 'Semester Result'
    });
  });

  test('extracts stacked contact fields and address blocks from SOA contact-info page text', () => {
    const normalized = normalizeSoaPortalData({
      rawSections: {
        contactInfo: {
          pageText: [
            'Student Contact Details',
            'Cell / Mobile',
            '6291547509',
            'Telephone No',
            '0674123456',
            'Personal Email Id',
            'student@example.com',
            'Parent Contact Details',
            'Cell / Mobile',
            '9123456789',
            'Correspondence Address',
            'Address : 1',
            'Plot 10, Lane 4',
            'Address : 2',
            'Bhubaneswar',
            'City',
            'Bhubaneswar',
            'District',
            'Khordha',
            'Postal Code',
            '751003',
            'State',
            'Odisha',
            'Permanent Address',
            'Address : 1',
            'Village Road 2',
            'Address : 2',
            'Kendrapara',
            'City',
            'Kendrapara',
            'District',
            'Kendrapara',
            'Postal Code',
            '754211',
            'State',
            'Odisha'
          ].join('\n')
        }
      }
    });

    expect(normalized.contactInfo).toMatchObject({
      email: 'student@example.com',
      phone: '6291547509',
      alternatePhone: '0674123456',
      guardianPhone: '9123456789',
      correspondenceAddress: 'Plot 10, Lane 4, Bhubaneswar',
      permanentAddress: 'Village Road 2, Kendrapara',
      city: 'Bhubaneswar',
      district: 'Khordha',
      postalCode: '751003',
      state: 'Odisha'
    });
  });

  test('preserves camelCase attendance and marks rows from saved SOA payloads', () => {
    const normalized = normalizeSoaPortalData({
      attendance: [
        {
          subject: 'Algorithms',
          subjectCode: 'CSE401',
          attendedClasses: 42,
          totalClasses: 45,
          percentage: 93.33
        }
      ],
      marks: [
        {
          subject: 'Algorithms',
          subjectCode: 'CSE401',
          examType: 'Mid Sem',
          marksObtained: 45,
          totalMarks: 50,
          publishedAt: '2026-03-21T08:00:00.000Z'
        }
      ]
    });

    expect(normalized.attendance.summary[0]).toMatchObject({
      subject: 'Algorithms',
      subject_code: 'CSE401',
      present_count: 42,
      total_classes: 45
    });
    expect(normalized.marks.records[0]).toMatchObject({
      subject: 'Algorithms',
      subjectCode: 'CSE401',
      examType: 'Mid Sem',
      marksObtained: 45,
      totalMarks: 50
    });
  });

  test('normalizes legacy stored portal data and marks it as reconnectable cache', () => {
    const normalized = normalizeStoredPortalData({
      portalConnected: false,
      portalProvider: 'soa',
      portal_last_synced: '2026-03-20T09:30:00.000Z',
      profile: {
        name: 'Legacy Student',
        registration_number: 'STU123',
        department: 'CSE',
        semester: 6
      },
      attendance_data: [
        { subject: 'Mathematics', subject_code: 'MTH301', present_count: 28, total_classes: 32, percentage: 87.5 }
      ],
      marks_data: [
        { subject: 'Mathematics', subject_code: 'MTH301', exam_type: 'Mid Sem', marks: 40, total_marks: 50, grade: 'A' }
      ]
    });

    const status = buildPortalStatusPayload({
      portalConnected: false,
      portalProvider: 'soa',
      portal_last_synced: '2026-03-20T09:30:00.000Z'
    }, normalized);

    expect(normalized.profile.studentName).toBe('Legacy Student');
    expect(normalized.attendance.summary).toHaveLength(1);
    expect(normalized.marks.records).toHaveLength(1);
    expect(status.hasImportedData).toBe(true);
    expect(status.needsReconnect).toBe(true);
    expect(status.portalProvider).toBe('soa');
  });
});
