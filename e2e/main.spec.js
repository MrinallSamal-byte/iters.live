const { test, expect } = require('@playwright/test');

test.describe('Landing Page', () => {
  test('should load landing page', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await expect(page).toHaveTitle(/ITER College Management/);
    await expect(page.locator('.hero-title')).toContainText('ITER EduHub');
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.click('text=Login');
    await expect(page).toHaveURL(/.*login.html/);
  });

  test('should display demo credentials', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.click('a[href="#demo"]');
    await expect(page.locator('.demo-card')).toBeVisible();
  });
});

test.describe('Authentication', () => {
  test('should login as student', async ({ page }) => {
    await page.goto('http://localhost:3000/login.html');
    
    await page.fill('input[name="registration_number"]', 'STU20250001');
    await page.fill('input[name="password"]', 'Student@123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard/);
    await expect(page).toHaveURL(/.*student.html/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:3000/login.html');
    
    await page.fill('input[name="registration_number"]', 'INVALID');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login.html');
    await page.fill('input[name="registration_number"]', 'STU20250001');
    await page.fill('input[name="password"]', 'Student@123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
    
    // Logout
    await page.click('button#logoutBtn');
    await expect(page).toHaveURL(/.*index.html/);
  });
});

test.describe('Student Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('http://localhost:3000/login.html');
    await page.fill('input[name="registration_number"]', 'STU20250001');
    await page.fill('input[name="password"]', 'Student@123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
  });

  test('should display attendance data', async ({ page }) => {
    await page.click('a[href="#attendance"]');
    await expect(page.locator('.attendance-card')).toBeVisible();
  });

  test('should display marks data', async ({ page }) => {
    await page.click('a[href="#marks"]');
    await expect(page.locator('.marks-card')).toBeVisible();
  });

  test('should download a file', async ({ page }) => {
    await page.click('a[href="#notes"]');
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('.download-btn').first()
    ]);
    
    expect(download.suggestedFilename()).toMatch(/.pdf$/);
  });
});

test.describe('Teacher Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher
    await page.goto('http://localhost:3000/login.html');
    await page.fill('input[name="registration_number"]', 'TCH2025001');
    await page.fill('input[name="password"]', 'Teacher@123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
  });

  test('should upload a file', async ({ page }) => {
    await page.click('a[href="#upload"]');
    
    await page.setInputFiles('input[type="file"]', {
      name: 'test-note.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Test PDF content')
    });
    
    await page.fill('select[name="category"]', 'note');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.success-message')).toBeVisible();
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login.html');
    await page.fill('input[name="registration_number"]', 'ADM2025001');
    await page.fill('input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
  });

  test('should display analytics', async ({ page }) => {
    await expect(page.locator('.analytics-card')).toBeVisible();
  });

  test('should approve a file', async ({ page }) => {
    await page.click('a[href="#approvals"]');
    await page.click('.approve-btn').first();
    
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
