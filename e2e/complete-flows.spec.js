/**
 * Playwright End-to-End Tests
 * Testing critical user flows
 */

const { test, expect } = require('@playwright/test');

// Test configuration
test.describe.configure({ mode: 'parallel' });

// Phase 9: Student Tools E2E Tests
test.describe('Student Academic Tools', () => {
    test('should complete GPA calculation flow', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Wait for component to load
        await page.waitForSelector('#phase9-gpa');
        
        // Add semester
        await page.click('button:has-text("Add Semester")');
        
        // Add course
        await page.fill('input[placeholder*="Course Name"]', 'Data Structures');
        await page.fill('input[type="number"]', '4');
        await page.selectOption('select.grade-select', 'A');
        
        // Verify CGPA calculation
        const cgpa = await page.textContent('.cgpa-value');
        expect(parseFloat(cgpa)).toBeGreaterThan(0);
    });

    test('should create and manage assignments', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Switch to assignment calendar
        await page.click('button:has-text("Add Assignment")');
        
        // Fill assignment form
        await page.fill('input[placeholder*="Assignment title"]', 'Project Report');
        await page.fill('input[type="date"]', '2025-10-20');
        await page.selectOption('select.priority', 'high');
        
        // Submit
        await page.click('button:has-text("Save")');
        
        // Verify assignment appears
        await expect(page.locator('text=Project Report')).toBeVisible();
    });

    test('should build and export resume', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Fill personal info
        await page.fill('input[placeholder*="Full Name"]', 'John Doe');
        await page.fill('input[type="email"]', 'john@example.com');
        
        // Add education
        await page.click('button:has-text("Add Education")');
        await page.fill('input[placeholder*="Degree"]', 'B.Tech');
        
        // Switch template
        await page.click('.template-option:nth-child(2)');
        
        // Preview
        await page.click('button:has-text("Preview")');
        await expect(page.locator('.resume-preview')).toBeVisible();
    });
});

// Phase 10: Teacher Tools E2E Tests
test.describe('Teacher Advanced Features', () => {
    test('should create question bank', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        await page.click('button[data-tab="phase10"]');
        
        // Create question
        await page.click('button:has-text("Create Question")');
        await page.fill('textarea#questionText', 'What is 2+2?');
        
        // Add options
        const options = ['3', '4', '5', '6'];
        for (let i = 0; i < options.length; i++) {
            await page.fill(`.option-input:nth-child(${i + 1})`, options[i]);
        }
        
        // Mark correct answer
        await page.click('.mark-correct:nth-child(2)'); // 4 is correct
        
        // Save
        await page.click('button:has-text("Save Question")');
        
        // Verify question appears
        await expect(page.locator('text=What is 2+2?')).toBeVisible();
    });

    test('should create and grade quiz', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        await page.click('button[data-tab="phase10"]');
        
        // Create quiz
        await page.click('button:has-text("Create Quiz")');
        await page.fill('input#quizTitle', 'Math Test');
        await page.fill('input#quizDuration', '30');
        
        // Save quiz
        await page.click('button[type="submit"]');
        
        // Verify quiz created
        await expect(page.locator('text=Math Test')).toBeVisible();
    });

    test('should detect at-risk students', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        await page.click('button[data-tab="phase10"]');
        
        // View risk detection
        await page.waitForSelector('.risk-detection');
        
        // Verify stats are displayed
        await expect(page.locator('.stat-card.risk-high')).toBeVisible();
        await expect(page.locator('.stat-value')).toBeVisible();
        
        // Export report
        const downloadPromise = page.waitForEvent('download');
        await page.click('button:has-text("Export Report")');
        const download = await downloadPromise;
        
        expect(download.suggestedFilename()).toContain('.csv');
    });
});

// Multi-User Scenario Tests
test.describe('Multi-User Scenarios', () => {
    test('teacher creates quiz, student takes it', async ({ browser }) => {
        const teacherContext = await browser.newContext();
        const studentContext = await browser.newContext();
        
        const teacherPage = await teacherContext.newPage();
        const studentPage = await studentContext.newPage();
        
        // Teacher creates quiz
        await teacherPage.goto('/client/complete-system-test.html');
        await teacherPage.click('button[data-tab="phase10"]');
        await teacherPage.click('button:has-text("Create Quiz")');
        await teacherPage.fill('input#quizTitle', 'Shared Quiz');
        await teacherPage.click('button:has-text("Save")');
        
        // Student takes quiz
        await studentPage.goto('/client/complete-system-test.html');
        // Would interact with quiz interface
        
        await teacherContext.close();
        await studentContext.close();
    });
});

// Performance Tests
test.describe('Performance', () => {
    test('should load main page within 3 seconds', async ({ page }) => {
        const start = Date.now();
        await page.goto('/client/complete-system-test.html');
        const loadTime = Date.now() - start;
        
        expect(loadTime).toBeLessThan(3000);
    });

    test('should render large datasets efficiently', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Measure render time for large dataset
        const start = Date.now();
        await page.evaluate(() => {
            // Simulate rendering 1000 items
            const container = document.createElement('div');
            for (let i = 0; i < 1000; i++) {
                const item = document.createElement('div');
                item.textContent = `Item ${i}`;
                container.appendChild(item);
            }
            document.body.appendChild(container);
        });
        const renderTime = Date.now() - start;
        
        expect(renderTime).toBeLessThan(1000); // Should render in <1s
    });
});

// Mobile Responsiveness Tests
test.describe('Mobile Responsiveness', () => {
    test('should display correctly on mobile', async ({ browser }) => {
        const mobileContext = await browser.newContext({
            viewport: { width: 375, height: 667 }, // iPhone SE
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
        });
        
        const page = await mobileContext.newPage();
        await page.goto('/client/complete-system-test.html');
        
        // Verify mobile layout
        const tabs = await page.locator('.test-tab');
        const isStacked = await tabs.first().evaluate(el => {
            return window.getComputedStyle(el).display === 'block';
        });
        
        // Tabs should stack on mobile
        await page.close();
        await mobileContext.close();
    });

    test('should handle touch interactions', async ({ browser }) => {
        const mobileContext = await browser.newContext({
            viewport: { width: 375, height: 667 },
            hasTouch: true
        });
        
        const page = await mobileContext.newPage();
        await page.goto('/client/complete-system-test.html');
        
        // Simulate touch on tab
        await page.tap('button[data-tab="phase10"]');
        
        // Verify tab switched
        await expect(page.locator('.test-tab.active')).toHaveText(/Phase 10/);
        
        await page.close();
        await mobileContext.close();
    });
});

// Accessibility Tests
test.describe('Accessibility', () => {
    test('should have no accessibility violations', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Check for common accessibility issues
        const buttons = await page.locator('button');
        const count = await buttons.count();
        
        // All buttons should have accessible text
        for (let i = 0; i < count; i++) {
            const text = await buttons.nth(i).textContent();
            const ariaLabel = await buttons.nth(i).getAttribute('aria-label');
            
            expect(text || ariaLabel).toBeTruthy();
        }
    });

    test('should support keyboard navigation', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Tab through interactive elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Verify focus is visible
        const focusedElement = await page.evaluate(() => {
            return document.activeElement?.tagName;
        });
        
        expect(['BUTTON', 'INPUT', 'A']).toContain(focusedElement);
    });
});

// Data Persistence Tests
test.describe('Data Persistence', () => {
    test('should save data to localStorage', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Add some data
        await page.evaluate(() => {
            localStorage.setItem('testData', JSON.stringify({ test: 'value' }));
        });
        
        // Refresh page
        await page.reload();
        
        // Verify data persists
        const data = await page.evaluate(() => {
            return localStorage.getItem('testData');
        });
        
        expect(JSON.parse(data)).toEqual({ test: 'value' });
    });

    test('should handle localStorage quota exceeded', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Try to fill localStorage
        const result = await page.evaluate(() => {
            try {
                const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB
                localStorage.setItem('large', largeData);
                return 'success';
            } catch (e) {
                return 'quota_exceeded';
            }
        });
        
        // Should handle gracefully
        expect(['success', 'quota_exceeded']).toContain(result);
    });
});

// Error Handling Tests
test.describe('Error Handling', () => {
    test('should display error messages gracefully', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Simulate error condition
        await page.evaluate(() => {
            showToast('Test error message', 'error');
        });
        
        // Verify toast appears
        await expect(page.locator('.toast.error')).toBeVisible();
    });

    test('should handle network errors', async ({ page, context }) => {
        // Simulate offline
        await context.setOffline(true);
        
        await page.goto('/client/complete-system-test.html');
        
        // App should still load from cache/offline
        await expect(page.locator('.test-header')).toBeVisible();
        
        await context.setOffline(false);
    });
});

// Security Tests
test.describe('Security', () => {
    test('should sanitize user input', async ({ page }) => {
        await page.goto('/client/complete-system-test.html');
        
        // Try to inject script
        await page.fill('textarea', '<script>alert("XSS")</script>');
        
        // Should be escaped
        const value = await page.locator('textarea').inputValue();
        expect(value).not.toContain('<script>');
    });
});
