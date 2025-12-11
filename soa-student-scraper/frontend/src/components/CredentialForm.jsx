import React, { useState } from 'react';

/**
 * CredentialForm Component
 * 
 * Clean login form with:
 * - Registration Number input
 * - Password input (masked)
 * - Fetch Live Data button
 * - Load Dummy Data button
 * - Real-time status updates
 * 
 * SECURITY:
 * - Password is NEVER logged or stored locally
 * - Only sent to backend for immediate use
 * - Cleared from state after submission
 */
const CredentialForm = ({ onFetchLive, onLoadDummy, isLoading, attempt, attemptsRemaining }) => {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!registrationNumber.trim()) {
      setError('Please enter your Registration Number');
      return false;
    }
    if (registrationNumber.trim().length < 6) {
      setError('Registration Number must be at least 6 characters');
      return false;
    }
    if (!password) {
      setError('Please enter your Password');
      return false;
    }
    setError('');
    return true;
  };

  const handleFetchLive = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Call parent handler with credentials
    // NOTE: Password is only held in memory and sent directly to API
    onFetchLive({
      registration_number: registrationNumber.trim(),
      password: password
    });
    
    // Clear password from local state after submission
    // Security: Don't keep password in component state longer than necessary
    setPassword('');
  };

  const handleLoadDummy = () => {
    setError('');
    // Clear form when loading dummy data
    setRegistrationNumber('');
    setPassword('');
    onLoadDummy();
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="icon">🔐</span>
        <h2>Enter Your Credentials</h2>
      </div>
      
      <form onSubmit={handleFetchLive} className="credential-form">
        <div className="form-group">
          <label htmlFor="regNumber">Registration Number</label>
          <input
            type="text"
            id="regNumber"
            name="regNumber"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="e.g., 2461XXXXXXX"
            autoComplete="username"
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your portal password"
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>
        
        {error && (
          <div className="status-banner error" style={{ marginBottom: '1rem' }}>
            <span className="icon">⚠️</span>
            <span className="message">{error}</span>
          </div>
        )}
        
        {attempt > 0 && attemptsRemaining > 0 && (
          <div className="status-banner loading" style={{ marginBottom: '1rem' }}>
            <span className="icon">🔄</span>
            <span className="message">
              Attempt {attempt}/3 — {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
            </span>
          </div>
        )}
        
        <div className="btn-group">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Fetching...
              </>
            ) : (
              <>
                🚀 Fetch Live Data
              </>
            )}
          </button>
          
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLoadDummy}
            disabled={isLoading}
          >
            📊 Load Dummy Data
          </button>
        </div>
        
        <p style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center', 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)' 
        }}>
          🔒 Your credentials are secure. They are never stored or logged.
        </p>
      </form>
    </div>
  );
};

export default CredentialForm;
