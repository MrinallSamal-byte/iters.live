"""
Live Scraper for SOA Student Portal

Uses Playwright (sync) to:
1. Navigate to the student portal
2. Handle CAPTCHA automatically via OCR
3. Login with user-provided credentials
4. Extract student data (personal info, attendance, results)

Security:
- Never logs, stores, or caches credentials
- Browser context closed after every request
- No credentials in any logs or outputs
"""

import re
import time
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass

try:
    from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    
from .captcha_solver import get_captcha_solver


@dataclass
class ScrapeResult:
    """Result of a scraping operation."""
    success: bool
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None
    attempt: int = 1
    

class SOAPortalScraper:
    """Live scraper for SOA Student Portal."""
    
    PORTAL_URL = "https://soaportals.com/StudentPortalSOA/#/"
    MAX_CAPTCHA_RETRIES = 2
    
    def __init__(self):
        """Initialize the scraper."""
        self.captcha_solver = get_captcha_solver()
        
    def scrape_portal(
        self, 
        registration_number: str, 
        password: str,
        attempt: int = 1
    ) -> ScrapeResult:
        """
        Scrape student data from the SOA portal.
        
        SECURITY: Credentials are only held in memory during this function.
        They are never logged, stored, or cached.
        
        Args:
            registration_number: Student's registration number
            password: Student's password (NOT logged or stored)
            attempt: Current attempt number (1-3)
            
        Returns:
            ScrapeResult with status and extracted data
        """
        if not PLAYWRIGHT_AVAILABLE:
            return ScrapeResult(
                success=False,
                status="SCRAPER_UNAVAILABLE",
                message="Playwright browser automation is not available. Please install playwright.",
                attempt=attempt
            )
            
        browser: Optional[Browser] = None
        context: Optional[BrowserContext] = None
        
        try:
            # Launch browser in headless mode
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                )
                
                context = browser.new_context(
                    viewport={'width': 1280, 'height': 720},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                
                page = context.new_page()
                
                # Navigate to portal
                try:
                    page.goto(self.PORTAL_URL, timeout=30000, wait_until='networkidle')
                except Exception:
                    return ScrapeResult(
                        success=False,
                        status="PORTAL_UNREACHABLE",
                        message="Unable to reach the SOA student portal. Please check your internet connection.",
                        attempt=attempt
                    )
                
                # Wait for login form to load
                time.sleep(2)
                
                # Handle CAPTCHA
                captcha_text, captcha_success = self._solve_captcha(page)
                if not captcha_success:
                    # Refresh CAPTCHA and retry
                    self._refresh_captcha(page)
                    time.sleep(1)
                    captcha_text, captcha_success = self._solve_captcha(page)
                    
                    if not captcha_success:
                        return ScrapeResult(
                            success=False,
                            status="CAPTCHA_FAILED",
                            message="Unable to solve CAPTCHA. Please try again.",
                            attempt=attempt
                        )
                
                # Fill login form (credentials held only during this operation)
                login_success = self._perform_login(
                    page, 
                    registration_number, 
                    password, 
                    captcha_text
                )
                
                # SECURITY: Clear password from memory immediately after login attempt
                # This prevents the password from persisting in local scope
                del password
                
                if not login_success:
                    return ScrapeResult(
                        success=False,
                        status="AUTH_FAILED",
                        message="Invalid credentials. Please check your registration number and password.",
                        attempt=attempt
                    )
                
                # Wait for dashboard to load
                time.sleep(3)
                
                # Extract student data
                student_data = self._extract_student_data(page)
                
                if not student_data:
                    return ScrapeResult(
                        success=False,
                        status="EXTRACTION_FAILED",
                        message="Login successful but could not extract student data.",
                        attempt=attempt
                    )
                
                # Add metadata
                student_data['fetchedAt'] = datetime.utcnow().isoformat()
                student_data['maskedRegNo'] = self._mask_reg_number(registration_number)
                
                return ScrapeResult(
                    success=True,
                    status="SUCCESS",
                    message="Live data fetched successfully using your credentials",
                    data=student_data,
                    attempt=attempt
                )
                
        except Exception as e:
            return ScrapeResult(
                success=False,
                status="SCRAPE_ERROR",
                message=f"An error occurred while scraping: {str(e)}",
                attempt=attempt
            )
            
        finally:
            # Always close browser context and browser
            if context:
                try:
                    context.close()
                except Exception:
                    pass
            if browser:
                try:
                    browser.close()
                except Exception:
                    pass
    
    def _solve_captcha(self, page: 'Page') -> Tuple[Optional[str], bool]:
        """
        Solve CAPTCHA from the login page.
        
        Args:
            page: Playwright page object
            
        Returns:
            Tuple of (captcha_text, success)
        """
        try:
            # Find CAPTCHA image element
            captcha_selectors = [
                'img[id*="captcha"]',
                'img[class*="captcha"]',
                'img[src*="captcha"]',
                '.captcha-image img',
                '#captchaImage',
                'img[alt*="captcha"]'
            ]
            
            captcha_element = None
            for selector in captcha_selectors:
                try:
                    element = page.query_selector(selector)
                    if element and element.is_visible():
                        captcha_element = element
                        break
                except Exception:
                    continue
            
            if not captcha_element:
                # CAPTCHA might not be present on this portal
                return "", True
            
            # Screenshot the CAPTCHA element
            captcha_bytes = captcha_element.screenshot()
            
            # Solve using OCR
            captcha_text, success, _ = self.captcha_solver.solve_with_retry(captcha_bytes)
            
            return captcha_text, success
            
        except Exception:
            return None, False
    
    def _refresh_captcha(self, page: 'Page') -> None:
        """
        Refresh the CAPTCHA image on the page.
        
        Args:
            page: Playwright page object
        """
        try:
            refresh_selectors = [
                'button[id*="refresh"]',
                'button[class*="refresh"]',
                'a[id*="refresh"]',
                '.captcha-refresh',
                '#refreshCaptcha',
                'img[id*="captcha"]'  # Clicking the captcha image might refresh it
            ]
            
            for selector in refresh_selectors:
                try:
                    element = page.query_selector(selector)
                    if element and element.is_visible():
                        element.click()
                        time.sleep(1)
                        return
                except Exception:
                    continue
                    
        except Exception:
            pass
    
    def _perform_login(
        self, 
        page: 'Page', 
        registration_number: str, 
        password: str, 
        captcha_text: Optional[str]
    ) -> bool:
        """
        Perform login on the portal.
        
        SECURITY: Password is used only here and not logged.
        
        Args:
            page: Playwright page object
            registration_number: Student's registration number
            password: Student's password
            captcha_text: Solved CAPTCHA text
            
        Returns:
            True if login was successful
        """
        try:
            # Find and fill registration number field
            reg_selectors = [
                'input[name*="reg"]',
                'input[id*="reg"]',
                'input[placeholder*="Registration"]',
                'input[placeholder*="registration"]',
                'input[type="text"]'
            ]
            
            for selector in reg_selectors:
                try:
                    element = page.query_selector(selector)
                    if element and element.is_visible():
                        element.fill(registration_number)
                        break
                except Exception:
                    continue
            
            # Find and fill password field
            pwd_selectors = [
                'input[type="password"]',
                'input[name*="password"]',
                'input[id*="password"]',
                'input[placeholder*="Password"]'
            ]
            
            for selector in pwd_selectors:
                try:
                    element = page.query_selector(selector)
                    if element and element.is_visible():
                        element.fill(password)
                        break
                except Exception:
                    continue
            
            # Fill CAPTCHA if present
            if captcha_text:
                captcha_input_selectors = [
                    'input[name*="captcha"]',
                    'input[id*="captcha"]',
                    'input[placeholder*="Captcha"]',
                    'input[placeholder*="CAPTCHA"]'
                ]
                
                for selector in captcha_input_selectors:
                    try:
                        element = page.query_selector(selector)
                        if element and element.is_visible():
                            element.fill(captcha_text)
                            break
                    except Exception:
                        continue
            
            # Click login button
            login_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button[id*="login"]',
                'button[class*="login"]',
                'button:has-text("Login")',
                'button:has-text("Sign In")',
                'button:has-text("Submit")'
            ]
            
            for selector in login_selectors:
                try:
                    element = page.query_selector(selector)
                    if element and element.is_visible():
                        element.click()
                        break
                except Exception:
                    continue
            
            # Wait for navigation/response
            time.sleep(3)
            
            # Check if login was successful
            # Look for error messages
            error_indicators = [
                'Invalid credentials',
                'Wrong password',
                'Login failed',
                'Authentication failed',
                'Invalid user',
                'Incorrect password'
            ]
            
            page_content = page.content().lower()
            for error in error_indicators:
                if error.lower() in page_content:
                    return False
            
            # Check if we're on a dashboard/home page
            success_indicators = [
                'dashboard',
                'welcome',
                'profile',
                'attendance',
                'result',
                'logout'
            ]
            
            for success in success_indicators:
                if success in page_content:
                    return True
            
            # If URL changed from login page, consider it success
            current_url = page.url.lower()
            if 'login' not in current_url and 'dashboard' in current_url:
                return True
            if 'home' in current_url or 'student' in current_url:
                return True
                
            return False
            
        except Exception:
            return False
    
    def _extract_student_data(self, page: 'Page') -> Optional[Dict[str, Any]]:
        """
        Extract student data from the dashboard.
        
        Args:
            page: Playwright page object
            
        Returns:
            Dictionary with student data or None
        """
        try:
            data = {
                'personalInfo': self._extract_personal_info(page),
                'attendance': self._extract_attendance(page),
                'results': self._extract_results(page)
            }
            
            # Ensure we got at least personal info
            if data['personalInfo'] and data['personalInfo'].get('name'):
                return data
                
            return None
            
        except Exception:
            return None
    
    def _extract_personal_info(self, page: 'Page') -> Dict[str, Any]:
        """Extract personal information from the page."""
        info = {
            'name': None,
            'enrollmentNo': None,
            'registrationNo': None,
            'branch': None,
            'semester': None,
            'dateOfBirth': None,
            'gender': None,
            'bloodGroup': None,
            'email': None,
            'phone': None,
            'photo': None
        }
        
        try:
            # Try to extract from various possible elements
            content = page.content()
            
            # Extract name
            name_patterns = [
                r'Name[:\s]*([A-Za-z\s]+)',
                r'Student Name[:\s]*([A-Za-z\s]+)'
            ]
            for pattern in name_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    info['name'] = match.group(1).strip()
                    break
            
            # Extract enrollment/registration number
            reg_patterns = [
                r'Registration[:\s]*No[:\s]*(\d+)',
                r'Enrollment[:\s]*No[:\s]*(\d+)',
                r'Reg[.\s]*No[:\s]*(\d+)',
                r'Roll[:\s]*No[:\s]*(\d+)'
            ]
            for pattern in reg_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    info['registrationNo'] = match.group(1)
                    info['enrollmentNo'] = match.group(1)
                    break
            
            # Extract branch/department
            branch_patterns = [
                r'Branch[:\s]*([A-Za-z\s&]+)',
                r'Department[:\s]*([A-Za-z\s&]+)',
                r'Course[:\s]*([A-Za-z\s&]+)'
            ]
            for pattern in branch_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    info['branch'] = match.group(1).strip()
                    break
            
            # Extract semester
            sem_patterns = [
                r'Semester[:\s]*(\d+)',
                r'Sem[:\s]*(\d+)',
                r'Current Semester[:\s]*(\d+)'
            ]
            for pattern in sem_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    info['semester'] = int(match.group(1))
                    break
            
            # Try to get profile photo
            try:
                photo_selectors = [
                    'img[class*="profile"]',
                    'img[id*="profile"]',
                    'img[alt*="profile"]',
                    '.profile-photo img',
                    '.student-photo img'
                ]
                for selector in photo_selectors:
                    element = page.query_selector(selector)
                    if element:
                        info['photo'] = element.get_attribute('src')
                        break
            except Exception:
                pass
                
        except Exception:
            pass
            
        return info
    
    def _extract_attendance(self, page: 'Page') -> list:
        """Extract attendance data from the page."""
        attendance = []
        
        try:
            # Look for attendance table
            table_selectors = [
                'table[class*="attendance"]',
                'table[id*="attendance"]',
                '#attendanceTable',
                '.attendance-table',
                'table'
            ]
            
            for selector in table_selectors:
                try:
                    table = page.query_selector(selector)
                    if not table:
                        continue
                        
                    rows = table.query_selector_all('tr')
                    for row in rows[1:]:  # Skip header
                        cells = row.query_selector_all('td')
                        if len(cells) >= 4:
                            try:
                                code = cells[0].inner_text().strip()
                                name = cells[1].inner_text().strip()
                                
                                # Try to parse attendance numbers
                                attended_total = cells[2].inner_text().strip()
                                percentage = cells[3].inner_text().strip()
                                
                                # Parse attended/total
                                match = re.search(r'(\d+)\s*/\s*(\d+)', attended_total)
                                if match:
                                    attended = int(match.group(1))
                                    total = int(match.group(2))
                                else:
                                    attended = 0
                                    total = 0
                                
                                attendance.append({
                                    'code': code,
                                    'name': name,
                                    'classesAttended': attended,
                                    'totalClasses': total,
                                    'percentage': percentage
                                })
                            except Exception:
                                continue
                    
                    if attendance:
                        break
                        
                except Exception:
                    continue
                    
        except Exception:
            pass
            
        return attendance
    
    def _extract_results(self, page: 'Page') -> Dict[str, Any]:
        """Extract academic results from the page."""
        results = {
            'sgpa': [],
            'cgpa': None,
            'totalCreditsEarned': None
        }
        
        try:
            content = page.content()
            
            # Extract CGPA
            cgpa_patterns = [
                r'CGPA[:\s]*(\d+\.?\d*)',
                r'Cumulative GPA[:\s]*(\d+\.?\d*)'
            ]
            for pattern in cgpa_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    results['cgpa'] = float(match.group(1))
                    break
            
            # Extract SGPA for each semester
            sgpa_patterns = [
                r'Sem(?:ester)?[\s-]*(\d+)[:\s]*(?:SGPA)?[:\s]*(\d+\.?\d*)',
                r'SGPA[:\s]*(\d+\.?\d*)'
            ]
            
            # Try to find semester-wise SGPA from tables or text
            try:
                result_table = page.query_selector('table[class*="result"], table[id*="result"], .result-table')
                if result_table:
                    rows = result_table.query_selector_all('tr')
                    for row in rows[1:]:
                        cells = row.query_selector_all('td')
                        if len(cells) >= 2:
                            try:
                                sem_text = cells[0].inner_text()
                                sem_match = re.search(r'(\d+)', sem_text)
                                if sem_match:
                                    semester = int(sem_match.group(1))
                                    sgpa_text = cells[1].inner_text()
                                    sgpa_match = re.search(r'(\d+\.?\d*)', sgpa_text)
                                    if sgpa_match:
                                        results['sgpa'].append({
                                            'semester': semester,
                                            'sgpa': float(sgpa_match.group(1))
                                        })
                            except Exception:
                                continue
            except Exception:
                pass
                
        except Exception:
            pass
            
        return results
    
    def _mask_reg_number(self, reg_number: str) -> str:
        """
        Mask registration number for display.
        
        Example: 2461XXXX
        
        Args:
            reg_number: Full registration number
            
        Returns:
            Masked registration number
        """
        if not reg_number or len(reg_number) < 4:
            return "XXXXXXXX"
        
        # Show first 4 characters, mask the rest
        prefix = reg_number[:4]
        suffix = 'X' * (len(reg_number) - 4)
        return f"{prefix}{suffix}"


# Factory function
def create_scraper() -> SOAPortalScraper:
    """Create a new scraper instance."""
    return SOAPortalScraper()
