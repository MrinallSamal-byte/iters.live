import React from 'react';

/**
 * StatusBanner Component
 * 
 * Displays status messages with appropriate styling:
 * - Demo mode: Purple banner with "Demo" badge
 * - Success: Green banner showing live data fetched
 * - Error: Red banner with error message
 * - Loading: Blue banner with spinner
 */
const StatusBanner = ({ status, message, isDemo, maskedRegNo, isLoading }) => {
  if (isLoading) {
    return (
      <div className="status-banner loading">
        <span className="spinner"></span>
        <span className="message">{message || 'Fetching data from portal...'}</span>
      </div>
    );
  }

  if (isDemo) {
    return (
      <div className="status-banner demo">
        <span className="icon">📊</span>
        <span className="message">
          <strong>Demo Mode Active</strong> — This is sample data for demonstration purposes. 
          Not real student information.
        </span>
        <span className="badge">Demo</span>
      </div>
    );
  }

  if (status === 'SUCCESS') {
    return (
      <div className="status-banner success">
        <span className="icon">✅</span>
        <span className="message">
          <strong>Live data fetched successfully</strong>
          {maskedRegNo && ` using credentials for ${maskedRegNo}`}
        </span>
      </div>
    );
  }

  if (status === 'AUTH_FAILED') {
    return (
      <div className="status-banner error">
        <span className="icon">⚠️</span>
        <span className="message">{message}</span>
      </div>
    );
  }

  if (status === 'PORTAL_UNREACHABLE') {
    return (
      <div className="status-banner error">
        <span className="icon">🔌</span>
        <span className="message">{message}</span>
      </div>
    );
  }

  if (status === 'CAPTCHA_FAILED') {
    return (
      <div className="status-banner error">
        <span className="icon">🔐</span>
        <span className="message">{message}</span>
      </div>
    );
  }

  // Generic error
  if (message) {
    return (
      <div className="status-banner error">
        <span className="icon">❌</span>
        <span className="message">{message}</span>
      </div>
    );
  }

  return null;
};

export default StatusBanner;
