"""
Student Portal Scraper
Uses Selenium with human-like behavior to scrape student data
"""
import time
import random
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException

from browser_manager import get_browser_manager
from captcha_solver import get_captcha_solver
from config import get_config

# Status constants - DO NOT log passwords
STATUS_SUCCESS = 'SUCCESS'
STATUS_AUTH_FAILED = 'AUTH_FAILED'
STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR'


class StudentPortalScraper:
    """
    Scraper for the SOA Student Portal
    Implements human-like behavior to avoid detection
    """
    
    def __init__(self):
        self.config = get_config()
        self.browser_manager = get_browser_manager()
        self.captcha_solver = get_captcha_solver()
        self.driver = None
    
    def _human_type(self, element, text):
        """
        Type text with human-like delays between keystrokes
        """
        for char in text:
            element.send_keys(char)
            # Random delay between keystrokes (50-150ms)
            time.sleep(random.uniform(0.05, 0.15))
    
    def _human_move_to_element(self, element):
        """
        Move mouse to element with human-like movement
        """
        try:
            actions = ActionChains(self.driver)
            # Add slight random offset
            x_offset = random.randint(-5, 5)
            y_offset = random.randint(-5, 5)
            actions.move_to_element_with_offset(element, x_offset, y_offset)
            actions.perform()
            # Small pause after movement
            time.sleep(random.uniform(0.1, 0.3))
        except Exception:
            pass
    
    def _human_click(self, element):
        """
        Click element with human-like behavior
        """
        self._human_move_to_element(element)
        time.sleep(random.uniform(0.1, 0.3))
        element.click()
        time.sleep(random.uniform(0.2, 0.5))
    
    def _random_delay(self, min_sec=0.5, max_sec=2.0):
        """Add random delay to simulate human behavior"""
        time.sleep(random.uniform(min_sec, max_sec))
    
    def _solve_captcha_if_present(self):
        """
        Detect and solve CAPTCHA if present on the page
        """
        try:
            # Common CAPTCHA selectors - adjust based on actual portal structure
            captcha_selectors = [
                '#captchaImage',
                '.captcha-image',
                'img[alt*="captcha"]',
                'img[src*="captcha"]',
                '#captcha',
            ]
            
            for selector in captcha_selectors:
                try:
                    captcha_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if captcha_element.is_displayed():
                        # Found CAPTCHA, attempt to solve
                        captcha_text = self.captcha_solver.solve_captcha_from_element(
                            self.driver, 
                            captcha_element
                        )
                        
                        if captcha_text:
                            # Find CAPTCHA input field
                            captcha_input_selectors = [
                                '#captchaInput',
                                'input[name*="captcha"]',
                                'input[placeholder*="captcha"]',
                                '.captcha-input'
                            ]
                            
                            for input_selector in captcha_input_selectors:
                                try:
                                    captcha_input = self.driver.find_element(
                                        By.CSS_SELECTOR, 
                                        input_selector
                                    )
                                    if captcha_input.is_displayed():
                                        self._human_click(captcha_input)
                                        captcha_input.clear()
                                        self._human_type(captcha_input, captcha_text)
                                        return True
                                except NoSuchElementException:
                                    continue
                        
                        return False
                except NoSuchElementException:
                    continue
            
            # No CAPTCHA found
            return True
            
        except Exception as e:
            print(f'CAPTCHA handling error: {str(e)}')
            return False
    
    def _attempt_login(self, reg_number, password):
        """
        Attempt to login with credentials
        Returns: (success: bool, error_message: str or None)
        """
        try:
            # Navigate to portal
            self.driver.get(self.config.PORTAL_URL)
            self._random_delay(2, 4)
            
            # Wait for page to load
            WebDriverWait(self.driver, self.config.BROWSER_TIMEOUT).until(
                EC.presence_of_element_located((By.TAG_NAME, 'body'))
            )
            
            # Find login form elements - adjust selectors based on actual portal
            # These are common patterns, actual selectors may need to be updated
            login_selectors = {
                'username': [
                    '#username',
                    '#regNo',
                    '#registrationNumber',
                    'input[name="username"]',
                    'input[name="regNo"]',
                    'input[type="text"]',
                ],
                'password': [
                    '#password',
                    'input[name="password"]',
                    'input[type="password"]',
                ],
                'submit': [
                    '#loginBtn',
                    'button[type="submit"]',
                    'input[type="submit"]',
                    '.login-button',
                    '.btn-login',
                ]
            }
            
            username_field = None
            for selector in login_selectors['username']:
                try:
                    username_field = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                    if username_field.is_displayed():
                        break
                except (TimeoutException, NoSuchElementException):
                    continue
            
            if not username_field:
                return False, 'Could not find username field'
            
            # Find password field
            password_field = None
            for selector in login_selectors['password']:
                try:
                    password_field = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if password_field.is_displayed():
                        break
                except NoSuchElementException:
                    continue
            
            if not password_field:
                return False, 'Could not find password field'
            
            # Clear and fill username
            self._human_click(username_field)
            username_field.clear()
            self._random_delay(0.3, 0.7)
            self._human_type(username_field, reg_number)
            self._random_delay(0.5, 1.0)
            
            # Clear and fill password
            self._human_click(password_field)
            password_field.clear()
            self._random_delay(0.3, 0.7)
            self._human_type(password_field, password)
            self._random_delay(0.5, 1.0)
            
            # Solve CAPTCHA if present
            if not self._solve_captcha_if_present():
                return False, 'Failed to solve CAPTCHA'
            
            # Find and click submit button
            submit_button = None
            for selector in login_selectors['submit']:
                try:
                    submit_button = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if submit_button.is_displayed():
                        break
                except NoSuchElementException:
                    continue
            
            if not submit_button:
                # Try pressing Enter as fallback
                password_field.send_keys(Keys.RETURN)
            else:
                self._human_click(submit_button)
            
            # Wait for navigation/response
            self._random_delay(3, 5)
            
            # Check for login success - look for dashboard elements or error messages
            error_selectors = [
                '.error-message',
                '.alert-danger',
                '.login-error',
                '#errorMsg',
                '.invalid-credentials',
            ]
            
            for selector in error_selectors:
                try:
                    error_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if error_element.is_displayed():
                        error_text = error_element.text.lower()
                        if 'invalid' in error_text or 'incorrect' in error_text or 'wrong' in error_text:
                            return False, 'AUTH_FAILED'
                except NoSuchElementException:
                    continue
            
            # Check for successful login indicators
            success_indicators = [
                '.dashboard',
                '.student-dashboard',
                '.profile',
                '#logout',
                '.logout-btn',
                '.welcome-message',
            ]
            
            for selector in success_indicators:
                try:
                    element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if element.is_displayed():
                        return True, None
                except NoSuchElementException:
                    continue
            
            # Check URL change as fallback
            current_url = self.driver.current_url.lower()
            if 'dashboard' in current_url or 'profile' in current_url or 'home' in current_url:
                return True, None
            
            return False, 'Could not verify login success'
            
        except TimeoutException:
            return False, 'Page load timeout'
        except WebDriverException as e:
            return False, f'Browser error: {str(e)}'
        except Exception as e:
            return False, f'Login error: {str(e)}'
    
    def _scrape_profile(self):
        """
        Scrape student profile information
        """
        profile = {}
        
        try:
            # Common profile field patterns
            profile_fields = {
                'name': ['#studentName', '.student-name', '[data-field="name"]'],
                'email': ['#email', '.student-email', '[data-field="email"]'],
                'department': ['#department', '.department', '[data-field="department"]'],
                'year': ['#year', '.year', '[data-field="year"]'],
                'section': ['#section', '.section', '[data-field="section"]'],
                'semester': ['#semester', '.semester', '[data-field="semester"]'],
                'phone': ['#phone', '.phone', '[data-field="phone"]'],
            }
            
            for field_name, selectors in profile_fields.items():
                for selector in selectors:
                    try:
                        element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        if element.is_displayed():
                            profile[field_name] = element.text.strip()
                            break
                    except NoSuchElementException:
                        continue
            
        except Exception as e:
            print(f'Profile scraping error: {str(e)}')
        
        return profile
    
    def _scrape_marks(self):
        """
        Scrape student marks/grades
        """
        marks = []
        
        try:
            # Navigate to marks page if needed
            marks_links = ['#marksLink', '.marks-link', 'a[href*="marks"]', 'a[href*="grades"]']
            
            for selector in marks_links:
                try:
                    link = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if link.is_displayed():
                        self._human_click(link)
                        self._random_delay(2, 3)
                        break
                except NoSuchElementException:
                    continue
            
            # Scrape marks table
            table_selectors = ['#marksTable', '.marks-table', 'table.grades', 'table']
            
            for selector in table_selectors:
                try:
                    table = self.driver.find_element(By.CSS_SELECTOR, selector)
                    rows = table.find_elements(By.CSS_SELECTOR, 'tbody tr')
                    
                    for row in rows:
                        cells = row.find_elements(By.TAG_NAME, 'td')
                        if len(cells) >= 2:
                            mark_entry = {
                                'subject': cells[0].text.strip() if len(cells) > 0 else '',
                                'marks': cells[1].text.strip() if len(cells) > 1 else '',
                                'grade': cells[2].text.strip() if len(cells) > 2 else '',
                            }
                            marks.append(mark_entry)
                    
                    if marks:
                        break
                except NoSuchElementException:
                    continue
                    
        except Exception as e:
            print(f'Marks scraping error: {str(e)}')
        
        return marks
    
    def _scrape_attendance(self):
        """
        Scrape student attendance data
        """
        attendance = []
        
        try:
            # Navigate to attendance page if needed
            attendance_links = ['#attendanceLink', '.attendance-link', 'a[href*="attendance"]']
            
            for selector in attendance_links:
                try:
                    link = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if link.is_displayed():
                        self._human_click(link)
                        self._random_delay(2, 3)
                        break
                except NoSuchElementException:
                    continue
            
            # Scrape attendance table
            table_selectors = ['#attendanceTable', '.attendance-table', 'table.attendance', 'table']
            
            for selector in table_selectors:
                try:
                    table = self.driver.find_element(By.CSS_SELECTOR, selector)
                    rows = table.find_elements(By.CSS_SELECTOR, 'tbody tr')
                    
                    for row in rows:
                        cells = row.find_elements(By.TAG_NAME, 'td')
                        if len(cells) >= 2:
                            attendance_entry = {
                                'subject': cells[0].text.strip() if len(cells) > 0 else '',
                                'attended': cells[1].text.strip() if len(cells) > 1 else '',
                                'total': cells[2].text.strip() if len(cells) > 2 else '',
                                'percentage': cells[3].text.strip() if len(cells) > 3 else '',
                            }
                            attendance.append(attendance_entry)
                    
                    if attendance:
                        break
                except NoSuchElementException:
                    continue
                    
        except Exception as e:
            print(f'Attendance scraping error: {str(e)}')
        
        return attendance
    
    def scrape(self, reg_number, password):
        """
        Main scraping method
        
        Args:
            reg_number: Student registration number
            password: Student password (NOT LOGGED)
            
        Returns:
            dict: Response with status and data
        """
        # Log action without password
        print(f'Starting scrape for registration: {reg_number}')
        
        try:
            # Create a fresh driver for this session
            self.driver = self.browser_manager.create_fresh_driver()
            
            # Attempt login
            success, error = self._attempt_login(reg_number, password)
            
            if not success:
                self.browser_manager.quit_driver(self.driver)
                self.driver = None
                
                if error == 'AUTH_FAILED':
                    return {
                        'status': STATUS_AUTH_FAILED
                    }
                else:
                    return {
                        'status': STATUS_SCRAPE_ERROR
                    }
            
            # Login successful, scrape data
            self._random_delay(1, 2)
            
            profile = self._scrape_profile()
            marks = self._scrape_marks()
            attendance = self._scrape_attendance()
            
            # Cleanup
            self.browser_manager.quit_driver(self.driver)
            self.driver = None
            
            return {
                'status': STATUS_SUCCESS,
                'data': {
                    'profile': profile,
                    'marks': marks,
                    'attendance': attendance
                }
            }
            
        except Exception as e:
            print(f'Scrape error: {str(e)}')
            
            if self.driver:
                self.browser_manager.quit_driver(self.driver)
                self.driver = None
            
            return {
                'status': STATUS_SCRAPE_ERROR
            }


# Factory function
def create_scraper():
    """Create a new scraper instance"""
    return StudentPortalScraper()
