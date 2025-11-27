"""
Student Portal Scraper for SOA Portal (https://soaportals.com/StudentPortalSOA/#/)
Uses Selenium with human-like behavior and Google Vision API for CAPTCHA solving
"""
import time
import random
import re
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    TimeoutException, 
    NoSuchElementException, 
    WebDriverException,
    StaleElementReferenceException,
    ElementNotInteractableException
)

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
    
    Portal URL: https://soaportals.com/StudentPortalSOA/#/
    
    Login form structure:
    - USER ID field: input for registration number
    - CAPTCHA image: img element with captcha
    - CAPTCHA input: text input for captcha answer
    - Login button: disabled until CAPTCHA is entered
    """
    
    def __init__(self):
        self.config = get_config()
        self.browser_manager = get_browser_manager()
        self.captcha_solver = get_captcha_solver()
        self.driver = None
        self.max_captcha_retries = 3  # Try CAPTCHA solving up to 3 times
    
    def _human_type(self, element, text):
        """
        Type text with human-like delays between keystrokes
        """
        for char in text:
            element.send_keys(char)
            # Random delay between keystrokes (30-100ms)
            time.sleep(random.uniform(0.03, 0.1))
    
    def _human_move_to_element(self, element):
        """
        Move mouse to element with human-like movement
        """
        try:
            actions = ActionChains(self.driver)
            # Add slight random offset
            x_offset = random.randint(-3, 3)
            y_offset = random.randint(-3, 3)
            actions.move_to_element_with_offset(element, x_offset, y_offset)
            actions.perform()
            # Small pause after movement
            time.sleep(random.uniform(0.1, 0.2))
        except Exception:
            pass
    
    def _human_click(self, element):
        """
        Click element with human-like behavior
        """
        self._human_move_to_element(element)
        time.sleep(random.uniform(0.05, 0.15))
        try:
            element.click()
        except ElementNotInteractableException:
            # Try JavaScript click as fallback
            self.driver.execute_script("arguments[0].click();", element)
        time.sleep(random.uniform(0.1, 0.3))
    
    def _random_delay(self, min_sec=0.5, max_sec=1.5):
        """Add random delay to simulate human behavior"""
        time.sleep(random.uniform(min_sec, max_sec))
    
    def _wait_for_page_load(self, timeout=10):
        """Wait for page to fully load"""
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: d.execute_script('return document.readyState') == 'complete'
            )
            self._random_delay(0.5, 1.0)
        except TimeoutException:
            print('Warning: Page load timeout, continuing anyway')
    
    def _find_element_with_fallback(self, selectors, timeout=10, description='element'):
        """
        Find element using multiple selector strategies
        
        Args:
            selectors: List of (By, selector) tuples to try
            timeout: Maximum wait time
            description: Human-readable description for logging
            
        Returns:
            WebElement or None
        """
        for by_type, selector in selectors:
            try:
                element = WebDriverWait(self.driver, timeout).until(
                    EC.presence_of_element_located((by_type, selector))
                )
                if element.is_displayed():
                    return element
            except (TimeoutException, NoSuchElementException, StaleElementReferenceException):
                continue
        
        print(f'Could not find {description} with any selector')
        return None
    
    def _find_user_id_field(self):
        """Find the USER ID input field on the login form"""
        selectors = [
            # Common ID-based selectors
            (By.ID, 'userId'),
            (By.ID, 'username'),
            (By.ID, 'regNo'),
            (By.ID, 'registrationNumber'),
            (By.ID, 'txtUserId'),
            (By.ID, 'txtUsername'),
            # Name-based selectors
            (By.NAME, 'userId'),
            (By.NAME, 'username'),
            (By.NAME, 'regNo'),
            (By.NAME, 'registrationNumber'),
            # CSS selectors for common patterns
            (By.CSS_SELECTOR, 'input[type="text"][placeholder*="User"]'),
            (By.CSS_SELECTOR, 'input[type="text"][placeholder*="user"]'),
            (By.CSS_SELECTOR, 'input[type="text"][placeholder*="ID"]'),
            (By.CSS_SELECTOR, 'input[type="text"][placeholder*="Registration"]'),
            (By.CSS_SELECTOR, 'input[type="text"][placeholder*="Reg"]'),
            (By.CSS_SELECTOR, 'input[ng-model*="user"]'),
            (By.CSS_SELECTOR, 'input[ng-model*="User"]'),
            (By.CSS_SELECTOR, 'input[formcontrolname*="user"]'),
            # XPath selectors
            (By.XPATH, '//input[@type="text" and contains(@placeholder, "User")]'),
            (By.XPATH, '//input[@type="text" and contains(@placeholder, "ID")]'),
            (By.XPATH, '//label[contains(text(),"User")]/following::input[1]'),
            (By.XPATH, '//label[contains(text(),"USER")]/following::input[1]'),
            # Generic fallbacks - first text input
            (By.CSS_SELECTOR, 'form input[type="text"]:first-of-type'),
            (By.XPATH, '(//form//input[@type="text"])[1]'),
        ]
        return self._find_element_with_fallback(selectors, timeout=10, description='USER ID field')
    
    def _find_password_field(self):
        """Find the password input field on the login form"""
        selectors = [
            (By.ID, 'password'),
            (By.ID, 'txtPassword'),
            (By.ID, 'pwd'),
            (By.NAME, 'password'),
            (By.NAME, 'pwd'),
            (By.CSS_SELECTOR, 'input[type="password"]'),
            (By.XPATH, '//input[@type="password"]'),
        ]
        return self._find_element_with_fallback(selectors, timeout=5, description='password field')
    
    def _find_captcha_image(self):
        """Find the CAPTCHA image element"""
        selectors = [
            # SOA portal specific selectors
            (By.CSS_SELECTOR, 'img[src*="captcha"]'),
            (By.CSS_SELECTOR, 'img[src*="Captcha"]'),
            (By.CSS_SELECTOR, 'img[src*="CAPTCHA"]'),
            (By.CSS_SELECTOR, 'img[alt*="captcha"]'),
            (By.CSS_SELECTOR, 'img[alt*="Captcha"]'),
            (By.CSS_SELECTOR, 'img[alt*="CAPTCHA"]'),
            # ID-based selectors
            (By.ID, 'captchaImage'),
            (By.ID, 'captcha'),
            (By.ID, 'imgCaptcha'),
            (By.ID, 'captchaImg'),
            # Class-based selectors
            (By.CSS_SELECTOR, '.captcha-image'),
            (By.CSS_SELECTOR, '.captcha-img'),
            (By.CSS_SELECTOR, '.captcha img'),
            (By.CSS_SELECTOR, '[class*="captcha"] img'),
            # Generic image in captcha container
            (By.XPATH, '//*[contains(@class,"captcha")]//img'),
            (By.XPATH, '//img[contains(@src,"captcha")]'),
            (By.XPATH, '//img[contains(@id,"captcha")]'),
        ]
        return self._find_element_with_fallback(selectors, timeout=10, description='CAPTCHA image')
    
    def _find_captcha_input(self):
        """Find the CAPTCHA input field"""
        selectors = [
            # Common CAPTCHA input selectors
            (By.ID, 'captchaInput'),
            (By.ID, 'txtCaptcha'),
            (By.ID, 'captcha'),
            (By.ID, 'captchaText'),
            (By.NAME, 'captcha'),
            (By.NAME, 'captchaInput'),
            (By.NAME, 'captchaText'),
            # CSS selectors
            (By.CSS_SELECTOR, 'input[placeholder*="Captcha"]'),
            (By.CSS_SELECTOR, 'input[placeholder*="captcha"]'),
            (By.CSS_SELECTOR, 'input[placeholder*="CAPTCHA"]'),
            (By.CSS_SELECTOR, 'input[placeholder*="Enter"]'),
            (By.CSS_SELECTOR, 'input[ng-model*="captcha"]'),
            (By.CSS_SELECTOR, 'input[formcontrolname*="captcha"]'),
            (By.CSS_SELECTOR, '.captcha-input'),
            (By.CSS_SELECTOR, '[class*="captcha"] input[type="text"]'),
            # XPath selectors
            (By.XPATH, '//input[contains(@placeholder,"aptcha")]'),
            (By.XPATH, '//label[contains(text(),"Captcha")]/following::input[1]'),
            (By.XPATH, '//*[contains(@class,"captcha")]//input[@type="text"]'),
        ]
        return self._find_element_with_fallback(selectors, timeout=5, description='CAPTCHA input')
    
    def _find_login_button(self):
        """Find the login/submit button"""
        selectors = [
            # Button-based selectors
            (By.ID, 'loginBtn'),
            (By.ID, 'btnLogin'),
            (By.ID, 'btnSubmit'),
            (By.ID, 'submit'),
            (By.NAME, 'login'),
            (By.NAME, 'submit'),
            # CSS selectors
            (By.CSS_SELECTOR, 'button[type="submit"]'),
            (By.CSS_SELECTOR, 'input[type="submit"]'),
            (By.CSS_SELECTOR, 'button.login-btn'),
            (By.CSS_SELECTOR, 'button.btn-login'),
            (By.CSS_SELECTOR, '.login-button'),
            (By.CSS_SELECTOR, 'button[ng-click*="login"]'),
            (By.CSS_SELECTOR, 'button[ng-click*="Login"]'),
            # XPath for button with login text
            (By.XPATH, '//button[contains(text(),"Login")]'),
            (By.XPATH, '//button[contains(text(),"login")]'),
            (By.XPATH, '//button[contains(text(),"Sign")]'),
            (By.XPATH, '//button[contains(text(),"Submit")]'),
            (By.XPATH, '//input[@type="submit"]'),
            (By.XPATH, '//button[@type="submit"]'),
        ]
        return self._find_element_with_fallback(selectors, timeout=5, description='login button')
    
    def _solve_captcha_with_retry(self):
        """
        Solve CAPTCHA with retry logic
        
        Returns:
            tuple: (success: bool, captcha_text: str or None, error_message: str or None)
        """
        for attempt in range(self.max_captcha_retries):
            print(f'CAPTCHA solve attempt {attempt + 1}/{self.max_captcha_retries}')
            
            # Find CAPTCHA image
            captcha_img = self._find_captcha_image()
            if not captcha_img:
                print('CAPTCHA image not found')
                return False, None, 'CAPTCHA image not found'
            
            # Try to get CAPTCHA text
            captcha_text = None
            
            # Method 1: Screenshot the element directly
            try:
                captcha_text = self.captcha_solver.solve_captcha_from_element(
                    self.driver,
                    captcha_img
                )
            except Exception as e:
                print(f'Direct screenshot failed: {str(e)}')
            
            # Method 2: Try getting from src attribute if it's base64
            if not captcha_text:
                try:
                    src = captcha_img.get_attribute('src')
                    if src and src.startswith('data:'):
                        captcha_text = self.captcha_solver.solve_captcha_from_base64_src(src)
                except Exception as e:
                    print(f'Base64 src extraction failed: {str(e)}')
            
            # Method 3: Download from URL if src is a URL
            if not captcha_text:
                try:
                    src = captcha_img.get_attribute('src')
                    if src and src.startswith('http'):
                        captcha_text = self.captcha_solver.solve_captcha_from_url(src)
                except Exception as e:
                    print(f'URL download failed: {str(e)}')
            
            if captcha_text and len(captcha_text) >= 4:
                print(f'CAPTCHA solved: {captcha_text}')
                return True, captcha_text, None
            
            print(f'CAPTCHA attempt {attempt + 1} failed, text: "{captcha_text}"')
            
            # Try to refresh CAPTCHA if possible (for next attempt)
            if attempt < self.max_captcha_retries - 1:
                try:
                    # Look for refresh button
                    refresh_selectors = [
                        (By.CSS_SELECTOR, 'button[onclick*="captcha"]'),
                        (By.CSS_SELECTOR, '[class*="refresh"]'),
                        (By.CSS_SELECTOR, '.captcha-refresh'),
                        (By.XPATH, '//*[contains(@class,"captcha")]//*[contains(@class,"refresh")]'),
                    ]
                    for by_type, selector in refresh_selectors:
                        try:
                            refresh_btn = self.driver.find_element(by_type, selector)
                            if refresh_btn.is_displayed():
                                self._human_click(refresh_btn)
                                self._random_delay(1, 2)
                                break
                        except NoSuchElementException:
                            continue
                except Exception:
                    pass
        
        return False, None, 'Failed to solve CAPTCHA after multiple attempts'
    
    def _check_login_success(self):
        """
        Check if login was successful
        
        Returns:
            tuple: (success: bool, error_type: str or None)
        """
        self._random_delay(1, 2)
        
        # Check for error messages first
        error_selectors = [
            (By.CSS_SELECTOR, '.error-message'),
            (By.CSS_SELECTOR, '.alert-danger'),
            (By.CSS_SELECTOR, '.login-error'),
            (By.CSS_SELECTOR, '.error'),
            (By.CSS_SELECTOR, '[class*="error"]'),
            (By.ID, 'errorMsg'),
            (By.ID, 'error'),
            (By.XPATH, '//*[contains(@class,"error")]'),
            (By.XPATH, '//*[contains(@class,"alert-danger")]'),
        ]
        
        for by_type, selector in error_selectors:
            try:
                elements = self.driver.find_elements(by_type, selector)
                for element in elements:
                    if element.is_displayed():
                        error_text = element.text.lower()
                        if any(word in error_text for word in ['invalid', 'incorrect', 'wrong', 'failed', 'error']):
                            if 'captcha' in error_text:
                                return False, 'Invalid CAPTCHA'
                            if any(word in error_text for word in ['credential', 'password', 'user', 'id']):
                                return False, 'AUTH_FAILED'
                            return False, 'AUTH_FAILED'
            except (NoSuchElementException, StaleElementReferenceException):
                continue
        
        # Check for successful login indicators
        success_indicators = [
            (By.CSS_SELECTOR, '.dashboard'),
            (By.CSS_SELECTOR, '.student-dashboard'),
            (By.CSS_SELECTOR, '.profile'),
            (By.CSS_SELECTOR, '.welcome'),
            (By.CSS_SELECTOR, '#logout'),
            (By.CSS_SELECTOR, '.logout'),
            (By.CSS_SELECTOR, '[class*="dashboard"]'),
            (By.CSS_SELECTOR, '[class*="profile"]'),
            (By.CSS_SELECTOR, 'a[href*="logout"]'),
            (By.XPATH, '//*[contains(@class,"dashboard")]'),
            (By.XPATH, '//*[contains(text(),"Welcome")]'),
            (By.XPATH, '//*[contains(text(),"Logout")]'),
        ]
        
        for by_type, selector in success_indicators:
            try:
                element = self.driver.find_element(by_type, selector)
                if element.is_displayed():
                    print(f'Login success indicator found: {selector}')
                    return True, None
            except (NoSuchElementException, StaleElementReferenceException):
                continue
        
        # Check URL for success indicators
        current_url = self.driver.current_url.lower()
        if any(word in current_url for word in ['dashboard', 'home', 'profile', 'student', 'main']):
            if 'login' not in current_url:
                print(f'Login successful based on URL: {current_url}')
                return True, None
        
        # If we're still on login page, assume failure
        if 'login' in current_url or '#/' in current_url:
            return False, 'AUTH_FAILED'
        
        return False, 'AUTH_FAILED'
    
    def _attempt_login(self, reg_number, password):
        """
        Attempt to login with credentials
        
        Args:
            reg_number: Student registration number
            password: Student password (NOT LOGGED)
            
        Returns:
            tuple: (success: bool, error_type: str or None)
        """
        try:
            # Navigate to portal
            print(f'Navigating to portal: {self.config.PORTAL_URL}')
            self.driver.get(self.config.PORTAL_URL)
            self._wait_for_page_load()
            self._random_delay(2, 3)
            
            # Wait for Angular/React to initialize (SOA portal uses Angular)
            try:
                WebDriverWait(self.driver, 15).until(
                    lambda d: d.execute_script('return typeof angular !== "undefined" || typeof React !== "undefined" || document.readyState === "complete"')
                )
            except TimeoutException:
                print('Warning: Framework detection timeout, continuing anyway')
            
            self._random_delay(1, 2)
            
            # Find USER ID field
            user_id_field = self._find_user_id_field()
            if not user_id_field:
                return False, 'Could not find USER ID field'
            
            # Clear and fill USER ID
            self._human_click(user_id_field)
            user_id_field.clear()
            self._random_delay(0.2, 0.5)
            self._human_type(user_id_field, reg_number)
            self._random_delay(0.5, 1.0)
            
            # Check if there's a password field (some portals use single-step login)
            password_field = self._find_password_field()
            if password_field:
                self._human_click(password_field)
                password_field.clear()
                self._random_delay(0.2, 0.5)
                self._human_type(password_field, password)
                self._random_delay(0.5, 1.0)
            
            # Solve CAPTCHA
            success, captcha_text, error = self._solve_captcha_with_retry()
            if not success:
                return False, 'CAPTCHA_FAILED'
            
            # Find and fill CAPTCHA input
            captcha_input = self._find_captcha_input()
            if not captcha_input:
                return False, 'CAPTCHA input field not found'
            
            self._human_click(captcha_input)
            captcha_input.clear()
            self._random_delay(0.2, 0.5)
            self._human_type(captcha_input, captcha_text)
            self._random_delay(0.5, 1.0)
            
            # Find and click login button
            login_button = self._find_login_button()
            if login_button:
                # Wait for button to be enabled
                try:
                    WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, '//button[@type="submit"]'))
                    )
                except TimeoutException:
                    pass
                
                self._random_delay(0.3, 0.7)
                self._human_click(login_button)
            else:
                # Try pressing Enter as fallback
                captcha_input.send_keys(Keys.RETURN)
            
            # Wait for response
            self._random_delay(3, 5)
            self._wait_for_page_load()
            
            # Check login result
            return self._check_login_success()
            
        except TimeoutException:
            return False, 'Page load timeout'
        except WebDriverException as e:
            return False, f'Browser error: {str(e)}'
        except Exception as e:
            print(f'Login error: {str(e)}')
            return False, f'Login error: {str(e)}'
    
    def _scrape_profile(self):
        """
        Scrape student profile information from the dashboard
        """
        profile = {}
        
        try:
            self._random_delay(0.5, 1.0)
            
            # Common profile field patterns
            profile_fields = {
                'name': [
                    '#studentName', '.student-name', '[data-field="name"]', '.name',
                    '//*[contains(@class,"name")]', '//span[contains(@id,"name")]'
                ],
                'registration_number': [
                    '#regNo', '.reg-no', '#registrationNumber', '.registration-number',
                    '[data-field="regNo"]', '//*[contains(@class,"reg")]'
                ],
                'email': [
                    '#email', '.email', '[data-field="email"]', 'a[href^="mailto:"]'
                ],
                'department': [
                    '#department', '.department', '#branch', '.branch',
                    '[data-field="department"]', '[data-field="branch"]'
                ],
                'year': [
                    '#year', '.year', '[data-field="year"]'
                ],
                'section': [
                    '#section', '.section', '[data-field="section"]'
                ],
                'semester': [
                    '#semester', '.semester', '[data-field="semester"]'
                ],
                'phone': [
                    '#phone', '.phone', '#mobile', '.mobile', '[data-field="phone"]'
                ],
                'father_name': [
                    '#fatherName', '.father-name', '[data-field="fatherName"]'
                ],
                'dob': [
                    '#dob', '.dob', '#dateOfBirth', '[data-field="dob"]'
                ]
            }
            
            for field_name, selectors in profile_fields.items():
                for selector in selectors:
                    try:
                        if selector.startswith('//'):
                            element = self.driver.find_element(By.XPATH, selector)
                        else:
                            element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        
                        if element.is_displayed():
                            text = element.text.strip()
                            if text:
                                profile[field_name] = text
                                break
                    except (NoSuchElementException, StaleElementReferenceException):
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
            # Navigate to marks/results page if needed
            marks_links = [
                'a[href*="marks"]', 'a[href*="result"]', 'a[href*="grade"]',
                '#marksLink', '.marks-link', '//*[contains(text(),"Marks")]',
                '//*[contains(text(),"Result")]', '//*[contains(text(),"Grade")]'
            ]
            
            for selector in marks_links:
                try:
                    if selector.startswith('//'):
                        link = self.driver.find_element(By.XPATH, selector)
                    else:
                        link = self.driver.find_element(By.CSS_SELECTOR, selector)
                    
                    if link.is_displayed():
                        self._human_click(link)
                        self._random_delay(1, 2)
                        self._wait_for_page_load()
                        break
                except (NoSuchElementException, StaleElementReferenceException):
                    continue
            
            # Scrape marks table
            table_selectors = ['table', '#marksTable', '.marks-table', 'table.grades']
            
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
                            if mark_entry['subject']:  # Only add if subject exists
                                marks.append(mark_entry)
                    
                    if marks:
                        break
                except (NoSuchElementException, StaleElementReferenceException):
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
            attendance_links = [
                'a[href*="attendance"]', '#attendanceLink', '.attendance-link',
                '//*[contains(text(),"Attendance")]'
            ]
            
            for selector in attendance_links:
                try:
                    if selector.startswith('//'):
                        link = self.driver.find_element(By.XPATH, selector)
                    else:
                        link = self.driver.find_element(By.CSS_SELECTOR, selector)
                    
                    if link.is_displayed():
                        self._human_click(link)
                        self._random_delay(1, 2)
                        self._wait_for_page_load()
                        break
                except (NoSuchElementException, StaleElementReferenceException):
                    continue
            
            # Scrape attendance table
            table_selectors = ['table', '#attendanceTable', '.attendance-table']
            
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
                            if attendance_entry['subject']:  # Only add if subject exists
                                attendance.append(attendance_entry)
                    
                    if attendance:
                        break
                except (NoSuchElementException, StaleElementReferenceException):
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
                
                # Return appropriate status based on error type
                if error == 'AUTH_FAILED' or error == 'Invalid credentials':
                    return {
                        'status': STATUS_AUTH_FAILED,
                        'message': 'Invalid registration number or password'
                    }
                elif 'captcha' in (error or '').lower():
                    return {
                        'status': STATUS_SCRAPE_ERROR,
                        'message': 'Failed to solve CAPTCHA'
                    }
                else:
                    return {
                        'status': STATUS_SCRAPE_ERROR,
                        'message': error or 'Login failed'
                    }
            
            # Login successful, scrape data
            print('Login successful, scraping data...')
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
                'status': STATUS_SCRAPE_ERROR,
                'message': str(e)
            }


# Factory function
def create_scraper():
    """Create a new scraper instance"""
    return StudentPortalScraper()
