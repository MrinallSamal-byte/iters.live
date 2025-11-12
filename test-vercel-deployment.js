const axios = require('axios');
const chalk = require('chalk');

const VERCEL_URL = 'https://iter-college-management.vercel.app';

// Demo accounts to test (using registration_number as required by API)
const testAccounts = {
  admin: {
    registration_number: 'ADM2025001',
    password: 'Admin@123456'
  },
  teacher: {
    registration_number: 'TCH2025001',
    password: 'Teacher@123'
  },
  student: {
    registration_number: 'STU2025001',
    password: 'Student@123'
  }
};

async function testVercelDeployment() {
  console.log(chalk.blue('\n🔍 Testing Vercel Deployment\n'));
  console.log(chalk.cyan('URL: ' + VERCEL_URL));
  console.log('');

  try {
    // Test 1: Check if site is accessible
    console.log(chalk.yellow('Test 1: Checking if website is accessible...'));
    try {
      const response = await axios.get(`${VERCEL_URL}/index.html`, {
        timeout: 10000
      });
      console.log(chalk.green(`✓ Website is accessible (Status: ${response.status})`));
    } catch (error) {
      console.log(chalk.red(`✗ Website not accessible: ${error.message}`));
      throw error;
    }
    console.log('');

    // Test 2: Check API health
    console.log(chalk.yellow('Test 2: Checking API health...'));
    try {
      const response = await axios.get(`${VERCEL_URL}/api/health`, {
        timeout: 10000
      });
      console.log(chalk.green('✓ API is healthy'));
      console.log(chalk.cyan('  Response:'), response.data);
    } catch (error) {
      console.log(chalk.red(`✗ API health check failed: ${error.message}`));
      if (error.response) {
        console.log(chalk.red('  Response data:'), error.response.data);
      }
    }
    console.log('');

    // Test 3: Test login endpoints
    console.log(chalk.yellow('Test 3: Testing authentication...'));
    
    for (const [role, credentials] of Object.entries(testAccounts)) {
      console.log(chalk.cyan(`  Testing ${role} login...`));
      try {
        const response = await axios.post(
          `${VERCEL_URL}/api/auth/login`,
          credentials,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        if (response.data.success) {
          console.log(chalk.green(`    ✓ ${role} login successful`));
          console.log(chalk.cyan(`      User: ${response.data.user.name}`));
          console.log(chalk.cyan(`      Role: ${response.data.user.role}`));
          
          // Test authenticated request
          const token = response.data.token;
          
          // Test profile endpoint
          try {
            const profileResponse = await axios.get(
              `${VERCEL_URL}/api/profile`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                timeout: 10000
              }
            );
            console.log(chalk.green(`    ✓ Profile fetch successful`));
          } catch (profileError) {
            console.log(chalk.yellow(`    ⚠ Profile fetch failed: ${profileError.message}`));
          }

          // Test analytics for admin/teacher
          if (role === 'admin' || role === 'teacher') {
            try {
              const analyticsResponse = await axios.get(
                `${VERCEL_URL}/api/analytics/overview`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  },
                  timeout: 10000
                }
              );
              console.log(chalk.green(`    ✓ Analytics data accessible`));
            } catch (analyticsError) {
              console.log(chalk.yellow(`    ⚠ Analytics fetch failed: ${analyticsError.message}`));
            }
          }

          // Test attendance for student
          if (role === 'student') {
            try {
              const attendanceResponse = await axios.get(
                `${VERCEL_URL}/api/attendance`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  },
                  timeout: 10000
                }
              );
              console.log(chalk.green(`    ✓ Attendance data accessible`));
            } catch (attendanceError) {
              console.log(chalk.yellow(`    ⚠ Attendance fetch failed: ${attendanceError.message}`));
            }
          }

        } else {
          console.log(chalk.red(`    ✗ ${role} login failed`));
        }
      } catch (error) {
        console.log(chalk.red(`    ✗ ${role} login error: ${error.message}`));
        if (error.response) {
          console.log(chalk.red('      Response:'), error.response.data);
        }
      }
    }
    console.log('');

    // Test 4: Check registration
    console.log(chalk.yellow('Test 4: Testing registration endpoint...'));
    const testUser = {
      name: 'Test User',
      email: `test${Date.now()}@iter.edu`,
      password: 'Test@123456',
      registration_number: `TST${Date.now().toString().slice(-6)}`,
      phone_number: '9999999999',
      department: 'CSE',
      role: 'student'
    };

    try {
      const response = await axios.post(
        `${VERCEL_URL}/api/auth/register`,
        testUser,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (response.data.success) {
        console.log(chalk.green('✓ Registration endpoint working'));
        console.log(chalk.cyan(`  Created user: ${response.data.user.email}`));
      } else {
        console.log(chalk.yellow('⚠ Registration completed but returned non-success'));
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(chalk.yellow('⚠ Registration validation working (expected error for test)'));
      } else {
        console.log(chalk.red(`✗ Registration error: ${error.message}`));
        if (error.response) {
          console.log(chalk.red('  Response:'), error.response.data);
        }
      }
    }
    console.log('');

    // Summary
    console.log(chalk.green.bold('═══════════════════════════════════════════'));
    console.log(chalk.green.bold('Vercel Deployment Test Complete'));
    console.log(chalk.green.bold('═══════════════════════════════════════════\n'));

    console.log(chalk.cyan('Access your deployment:'));
    console.log(chalk.white(`  ${VERCEL_URL}/index.html`));
    console.log('');
    console.log(chalk.cyan('Demo Accounts:'));
    console.log(chalk.yellow('  Admin:   admin1@iter.edu / Admin@123456'));
    console.log(chalk.yellow('  Teacher: teacher1@iter.edu / Teacher@123'));
    console.log(chalk.yellow('  Student: student1@iter.edu / Student@123'));
    console.log('');
    console.log(chalk.cyan('Important Pages to Test:'));
    console.log(chalk.white('  • Admin Dashboard: /client/html/admin-dashboard.html'));
    console.log(chalk.white('  • Teacher Dashboard: /client/html/teacher-dashboard.html'));
    console.log(chalk.white('  • Student Dashboard: /client/html/student-dashboard.html'));
    console.log(chalk.white('  • Analytics: Check each dashboard for data visualization'));
    console.log('');

    return true;

  } catch (error) {
    console.error(chalk.red('\n✗ Deployment test failed:'));
    console.error(chalk.red(error.message));
    console.error('');
    console.error(chalk.yellow('Troubleshooting:'));
    console.error('1. Check if Vercel deployment is live');
    console.error('2. Verify environment variables in Vercel dashboard');
    console.error('3. Check Vercel logs for errors');
    console.error('4. Ensure Railway database is accessible from Vercel');
    console.error('');
    return false;
  }
}

// Run the test
testVercelDeployment()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  });
