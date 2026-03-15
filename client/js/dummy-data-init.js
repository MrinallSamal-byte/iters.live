/**
 * Auto-initialization script for Dummy Data
 * This ensures dummy data is available immediately when the website starts
 */

(function() {
  'use strict';

  console.log('🎭 Dummy Data Auto-Init: Starting...');

  // Verify DummyData is loaded
  if (typeof window.DummyData === 'undefined') {
    console.error('❌ DummyData not found! Ensure dummy-data.js is loaded before this script.');
    return;
  }

  console.log('✅ DummyData loaded successfully');

  // Auto-populate demo user if not logged in
  function initializeDemoMode() {
    try {
      // Check if user is already authenticated
      if (typeof APP !== 'undefined' && APP.isAuthenticated()) {
        console.log('👤 User already authenticated:', APP.getUserRole());
        return;
      }

      // If on dashboard page but not authenticated, store demo user
      const path = window.location.pathname;
      if (path.includes('/dashboard/')) {
        console.log('📍 On dashboard page without authentication - initializing demo mode');
        
        // Determine role from URL
        let role = 'student';
        if (path.includes('teacher')) role = 'teacher';
        else if (path.includes('admin')) role = 'admin';
        
        // Get demo user
        const demoUser = DummyData.getDemoUser(role);
        console.log('🎭 Auto-initializing demo user:', demoUser.name, `(${role})`);
        
        // Store in localStorage
        if (typeof APP !== 'undefined' && APP.Storage) {
          APP.Storage.set('user', demoUser);
          // Also set a demo token
          APP.Storage.set('accessToken', 'demo-token-' + Date.now());
          console.log('✅ Demo user initialized in storage');
        }
      }
    } catch (error) {
      console.error('Error initializing demo mode:', error);
    }
  }

  // Pre-cache dummy data for instant display
  function precacheDummyData() {
    try {
      console.log('💾 Pre-caching dummy data...');
      
      // Cache common data
      const cachedData = {
        studentAttendance: DummyData.getStudentAttendance(),
        studentMarks: DummyData.getStudentMarks(),
        timetable: DummyData.getTimetable(),
        teacherStats: DummyData.getTeacherStats(),
        adminStats: DummyData.getAdminStats(),
        events: DummyData.getEvents(),
        clubs: DummyData.getClubs()
      };
      
      // Store in window for instant access
      window.CACHED_DUMMY_DATA = cachedData;
      console.log('✅ Dummy data pre-cached:', Object.keys(cachedData).length, 'datasets');
      
      return cachedData;
    } catch (error) {
      console.error('Error pre-caching dummy data:', error);
      return null;
    }
  }

  // Display demo credentials banner
  function showDemoCredentials() {
    // Only show on login or dashboard pages
    const path = window.location.pathname;
    if (!path.includes('/login') && !path.includes('/dashboard/')) {
      return;
    }

    // Check if banner already exists
    if (document.getElementById('demo-credentials-banner')) {
      return;
    }

    const credentials = DummyData.getDemoCredentials();
    console.log('🎭 Demo Credentials Available:', credentials.length, 'accounts');
  }

  // Ensure dummy data is available globally
  function ensureGlobalAccess() {
    if (typeof window.DummyData === 'undefined') {
      console.error('❌ DummyData not available on window object!');
      return false;
    }

    // Verify all main functions exist
    const requiredFunctions = [
      'getDemoUser',
      'getDemoCredentials', 
      'getStudentAttendance',
      'getStudentMarks',
      'getTimetable',
      'getTeacherStats',
      'getAdminStats'
    ];

    const missing = requiredFunctions.filter(fn => typeof DummyData[fn] !== 'function');
    
    if (missing.length > 0) {
      console.error('❌ Missing DummyData functions:', missing);
      return false;
    }

    console.log('✅ All required DummyData functions available');
    return true;
  }

  // Initialize everything
  function init() {
    console.log('🚀 Initializing Dummy Data System...');
    
    // Verify global access
    if (!ensureGlobalAccess()) {
      console.error('❌ Dummy Data initialization failed - missing required functions');
      return;
    }

    // Pre-cache data
    const cachedData = precacheDummyData();
    if (cachedData) {
      console.log('✅ Dummy data pre-cached and ready');
    }

    // Initialize demo mode if needed
    initializeDemoMode();

    // Show demo credentials
    showDemoCredentials();

    console.log('✅ Dummy Data System initialized successfully');
    console.log('📊 Data available for:', Object.keys(window.CACHED_DUMMY_DATA || {}).join(', '));
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }

  // Log demo accounts to console for easy reference
  setTimeout(() => {
    console.log('%c🎭 DEMO ACCOUNTS AVAILABLE', 'color: #FF0000; font-size: 16px; font-weight: bold;');
    console.log('%cStudent: STU20250001 / Student@123', 'color: #00E676; font-size: 14px;');
    console.log('%cTeacher: TCH2025001 / Teacher@123', 'color: #FFB300; font-size: 14px;');
    console.log('%cAdmin: ADM2025001 / Admin@123456', 'color: #FF5252; font-size: 14px;');
    console.log('%c' + '='.repeat(50), 'color: #FF0000;');
    console.log('%cDummy data is automatically loaded and cached!', 'color: #00E676; font-size: 13px;');
    console.log('%cAll dashboard pages will display data instantly.', 'color: #00E676; font-size: 13px;');
  }, 500);

})();
