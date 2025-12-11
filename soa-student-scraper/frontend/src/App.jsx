import React, { useState, useCallback } from 'react';
import CredentialForm from './components/CredentialForm';
import Dashboard from './components/Dashboard';
import StatusBanner from './components/StatusBanner';

// API base URL - uses proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || '') 
  : '';

/**
 * SOA Student Portal Scraper - Main Application
 * 
 * A secure, real-time web application that allows SOA University students 
 * to fetch their own live academic data from the official portal.
 * 
 * Features:
 * - Real-time data fetching with user credentials
 * - Demo mode with sample data
 * - CAPTCHA handling (automatic OCR)
 * - 3-attempt retry logic
 * - Clean, responsive UI
 * 
 * Security:
 * - Credentials are NEVER logged or stored
 * - Password cleared from memory after API call
 */
function App() {
  // State management
  const [studentData, setStudentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [maskedRegNo, setMaskedRegNo] = useState('');

  /**
   * Fetch live data from the SOA portal
   * SECURITY: Credentials are sent directly to API and cleared immediately after
   */
  const handleFetchLive = useCallback(async (credentials) => {
    setIsLoading(true);
    setMessage('Connecting to SOA portal...');
    setIsDemo(false);
    setStudentData(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/scrape-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      
      // Update state based on response
      setStatus(data.status);
      setMessage(data.message);
      setAttempt(data.attempt || 0);
      setAttemptsRemaining(data.attemptsRemaining || 0);
      
      if (data.success && data.data) {
        setStudentData(data.data);
        setMaskedRegNo(data.data.maskedRegNo || '');
        setIsDemo(false);
      } else {
        // Show suggestion to use dummy data after max attempts
        if (data.attemptsRemaining === 0) {
          setMessage(data.message + ' Click "Load Dummy Data" to see a demo.');
        }
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setStatus('ERROR');
      setMessage('Failed to connect to the server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load dummy/demo data
   * Does NOT attempt any login - just returns sample data
   */
  const handleLoadDummy = useCallback(async () => {
    setIsLoading(true);
    setMessage('Loading demo data...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/dummy-data`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setStudentData(data.data);
        setIsDemo(true);
        setStatus('DEMO_LOADED');
        setMessage('Demo Mode Active — Sample Data');
        setAttempt(0);
        setAttemptsRemaining(3);
        setMaskedRegNo('');
      }
      
    } catch (error) {
      console.error('Error loading dummy data:', error);
      setStatus('ERROR');
      setMessage('Failed to load demo data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Reset the application state
   */
  const handleReset = useCallback(() => {
    setStudentData(null);
    setIsDemo(false);
    setStatus(null);
    setMessage('');
    setAttempt(0);
    setAttemptsRemaining(3);
    setMaskedRegNo('');
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1>🎓 SOA Student Portal</h1>
        <p>Securely access your academic data from the official SOA University portal</p>
      </header>
      
      {/* Main Content */}
      <main className="main-content">
        {/* Status Banner */}
        {(status || isLoading) && (
          <StatusBanner
            status={status}
            message={message}
            isDemo={isDemo}
            maskedRegNo={maskedRegNo}
            isLoading={isLoading}
          />
        )}
        
        {/* Show form if no data loaded */}
        {!studentData && (
          <CredentialForm
            onFetchLive={handleFetchLive}
            onLoadDummy={handleLoadDummy}
            isLoading={isLoading}
            attempt={attempt}
            attemptsRemaining={attemptsRemaining}
          />
        )}
        
        {/* Show dashboard with data */}
        {studentData && (
          <>
            <Dashboard data={studentData} isDemo={isDemo} />
            
            {/* Reset Button */}
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleReset}
              >
                🔄 Fetch Different Data
              </button>
            </div>
          </>
        )}
      </main>
      
      {/* Footer */}
      <footer className="app-footer">
        <p>
          🔒 Your credentials are secure and never stored. 
          Data is fetched directly from the SOA portal using your login.
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          SOA Student Portal Scraper v1.0.0 | Built for SOA University Students
        </p>
      </footer>
    </div>
  );
}

export default App;
