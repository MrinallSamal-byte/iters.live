import React from 'react';

/**
 * Dashboard Component
 * 
 * Displays student data including:
 * - Personal Information (Name, Enrollment, Branch, etc.)
 * - Current Semester Attendance Table
 * - Academic Results (SGPA, CGPA, Credits)
 */
const Dashboard = ({ data, isDemo }) => {
  if (!data) {
    return null;
  }

  const { personalInfo, attendance, results, currentSemesterSubjects } = data;

  // Get percentage class for styling
  const getPercentageClass = (percentage) => {
    const value = parseFloat(percentage);
    if (isNaN(value)) return '';
    if (value >= 85) return 'high';
    if (value >= 75) return 'medium';
    return 'low';
  };

  // Get initials for photo placeholder
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  return (
    <div className="dashboard-container">
      {/* Personal Information Card */}
      <div className="card">
        <div className="card-header">
          <span className="icon">👤</span>
          <h2>Personal Information</h2>
        </div>
        
        <div className="profile-section">
          {personalInfo?.photo ? (
            <img 
              src={personalInfo.photo} 
              alt="Profile" 
              className="profile-photo"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="profile-photo-placeholder"
            style={{ display: personalInfo?.photo ? 'none' : 'flex' }}
          >
            {getInitials(personalInfo?.name)}
          </div>
          
          <div className="profile-info">
            <h3>{personalInfo?.name || 'Student Name'}</h3>
            <div className="profile-details">
              <div className="profile-detail">
                <span className="label">Registration No</span>
                <span className="value">{personalInfo?.registrationNo || personalInfo?.enrollmentNo || 'N/A'}</span>
              </div>
              <div className="profile-detail">
                <span className="label">Branch</span>
                <span className="value">{personalInfo?.branch || 'N/A'}</span>
              </div>
              <div className="profile-detail">
                <span className="label">Semester</span>
                <span className="value">{personalInfo?.semester || 'N/A'}</span>
              </div>
              {personalInfo?.section && (
                <div className="profile-detail">
                  <span className="label">Section</span>
                  <span className="value">{personalInfo.section}</span>
                </div>
              )}
              {personalInfo?.dateOfBirth && (
                <div className="profile-detail">
                  <span className="label">Date of Birth</span>
                  <span className="value">{personalInfo.dateOfBirth}</span>
                </div>
              )}
              {personalInfo?.gender && (
                <div className="profile-detail">
                  <span className="label">Gender</span>
                  <span className="value">{personalInfo.gender}</span>
                </div>
              )}
              {personalInfo?.bloodGroup && (
                <div className="profile-detail">
                  <span className="label">Blood Group</span>
                  <span className="value">{personalInfo.bloodGroup}</span>
                </div>
              )}
              {personalInfo?.email && (
                <div className="profile-detail">
                  <span className="label">Email</span>
                  <span className="value">{personalInfo.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Card */}
      {attendance && attendance.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="icon">📊</span>
            <h2>Current Semester Attendance</h2>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Attended / Total</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((item, index) => (
                  <tr key={index}>
                    <td><strong>{item.code}</strong></td>
                    <td>{item.name}</td>
                    <td>
                      {item.classesAttended !== undefined && item.totalClasses !== undefined
                        ? `${item.classesAttended} / ${item.totalClasses}`
                        : 'N/A'
                      }
                    </td>
                    <td>
                      <span className={`percentage ${getPercentageClass(item.percentage)}`}>
                        {item.percentage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Academic Results Card */}
      {results && (
        <div className="card">
          <div className="card-header">
            <span className="icon">🎓</span>
            <h2>Academic Results</h2>
          </div>
          
          <div className="stats-grid">
            {results.cgpa && (
              <div className="stat-card">
                <div className="value">{results.cgpa.toFixed(2)}</div>
                <div className="label">CGPA</div>
              </div>
            )}
            {results.totalCreditsEarned && (
              <div className="stat-card">
                <div className="value">{results.totalCreditsEarned}</div>
                <div className="label">Credits Earned</div>
              </div>
            )}
            {results.totalCreditsRequired && (
              <div className="stat-card">
                <div className="value">{results.totalCreditsRequired}</div>
                <div className="label">Total Required</div>
              </div>
            )}
          </div>
          
          {results.sgpa && results.sgpa.length > 0 && (
            <>
              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Semester-wise SGPA</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Semester</th>
                      <th>SGPA</th>
                      {results.sgpa[0]?.credits !== undefined && <th>Credits</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {results.sgpa.map((item, index) => (
                      <tr key={index}>
                        <td>Semester {item.semester}</td>
                        <td><strong>{item.sgpa?.toFixed(2) || 'N/A'}</strong></td>
                        {item.credits !== undefined && <td>{item.credits}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Current Semester Subjects Card */}
      {currentSemesterSubjects && currentSemesterSubjects.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="icon">📚</span>
            <h2>Current Semester Subjects</h2>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Credits</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {currentSemesterSubjects.map((item, index) => (
                  <tr key={index}>
                    <td><strong>{item.code}</strong></td>
                    <td>{item.name}</td>
                    <td>{item.credits}</td>
                    <td>{item.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
