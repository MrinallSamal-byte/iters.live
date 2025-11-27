"""
Main automation workflow for Student Portal scraping.
Handles login, navigation, and data extraction.
"""

import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

from config import Config
from browser_manager import BrowserManager
from human_interaction import human_type, human_click, random_delay
from captcha_solver import solve_captcha_google, refresh_captcha


class StudentPortalScraper:
    """Main scraper class for the Student Portal."""

    def __init__(self, api_key=None):
        """
        Initialize the scraper.

        Args:
            api_key: Optional Google Vision API key (uses config if not provided)
        """
        self.browser_manager = BrowserManager()
        self.driver = None
        self.api_key = api_key or Config.GOOGLE_VISION_API_KEY
        self.max_captcha_retries = 2

    def start(self):
        """Start the browser session."""
        self.driver = self.browser_manager.get_driver()

    def stop(self):
        """Stop the browser session."""
        self.browser_manager.quit()
        self.driver = None

    def navigate_to_portal(self):
        """Navigate to the student portal."""
        self.driver.get(Config.PORTAL_URL)

    def wait_for_login_form(self, timeout=30):
        """
        Wait for the login form to appear.

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            bool: True if login form appeared, False otherwise
        """
        try:
            # Common selectors for login form elements
            selectors = [
                "input[type='text']",
                "input[name='username']",
                "input[id*='user' i]",
                "input[placeholder*='user' i]",
                "input[placeholder*='id' i]"
            ]

            for selector in selectors:
                try:
                    WebDriverWait(self.driver, timeout).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                    return True
                except TimeoutException:
                    continue

            return False
        except Exception as e:
            print(f"Error waiting for login form: {str(e)}")
            return False

    def fill_login_form(self, user_id=None, password=None):
        """
        Fill the login form with credentials.

        Args:
            user_id: Optional user ID (uses config if not provided)
            password: Optional password (uses config if not provided)

        Returns:
            bool: True if form was filled successfully, False otherwise
        """
        try:
            user_id = user_id or Config.PORTAL_USER_ID
            password = password or Config.PORTAL_PASSWORD

            # Find username field
            username_selectors = [
                "input[name='username']",
                "input[id*='user' i]",
                "input[placeholder*='user' i]",
                "input[placeholder*='id' i]",
                "input[type='text']:first-of-type"
            ]

            username_field = None
            for selector in username_selectors:
                try:
                    username_field = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if username_field:
                        break
                except NoSuchElementException:
                    continue

            if username_field is None:
                print("Username field not found")
                return False

            # Find password field
            password_field = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")

            if password_field is None:
                print("Password field not found")
                return False

            # Human-like typing
            random_delay(0.3, 0.7)
            human_type(username_field, user_id)

            random_delay(0.3, 0.7)
            human_type(password_field, password)

            return True

        except Exception as e:
            print(f"Error filling login form: {str(e)}")
            return False

    def solve_and_enter_captcha(self):
        """
        Solve the CAPTCHA and enter it.

        Returns:
            bool: True if CAPTCHA was solved and entered, False otherwise
        """
        for attempt in range(self.max_captcha_retries):
            try:
                # Wait a bit for CAPTCHA to load
                random_delay(0.5, 1.0)

                # Solve CAPTCHA using Google Vision
                captcha_text = solve_captcha_google(self.driver, self.api_key)

                if captcha_text:
                    # Find CAPTCHA input field
                    captcha_input_selectors = [
                        "input[name*='captcha' i]",
                        "input[id*='captcha' i]",
                        "input[placeholder*='captcha' i]",
                        "input[placeholder*='code' i]"
                    ]

                    captcha_input = None
                    for selector in captcha_input_selectors:
                        try:
                            captcha_input = self.driver.find_element(By.CSS_SELECTOR, selector)
                            if captcha_input:
                                break
                        except NoSuchElementException:
                            continue

                    if captcha_input:
                        random_delay(0.2, 0.5)
                        human_type(captcha_input, captcha_text)
                        return True
                    else:
                        print("CAPTCHA input field not found")

                # If we reach here, try to refresh and retry
                if attempt < self.max_captcha_retries - 1:
                    print(f"CAPTCHA attempt {attempt + 1} failed, refreshing...")
                    refresh_captcha(self.driver)
                    random_delay(1.0, 2.0)

            except Exception as e:
                print(f"Error in CAPTCHA solving attempt {attempt + 1}: {str(e)}")
                if attempt < self.max_captcha_retries - 1:
                    refresh_captcha(self.driver)
                    random_delay(1.0, 2.0)

        return False

    def click_login(self):
        """
        Click the login button.

        Returns:
            bool: True if login button was clicked, False otherwise
        """
        try:
            login_selectors = [
                "button[type='submit']",
                "input[type='submit']",
                "button[id*='login' i]",
                "button[class*='login' i]",
                "button:contains('Login')",
                "button:contains('Sign In')"
            ]

            login_btn = None
            for selector in login_selectors:
                try:
                    login_btn = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if login_btn:
                        break
                except NoSuchElementException:
                    continue

            if login_btn is None:
                # Try XPath for text-based search
                try:
                    login_btn = self.driver.find_element(
                        By.XPATH,
                        "//button[contains(translate(text(),'LOGIN','login'),'login')]"
                    )
                except NoSuchElementException:
                    pass

            if login_btn:
                human_click(self.driver, login_btn)
                return True

            print("Login button not found")
            return False

        except Exception as e:
            print(f"Error clicking login: {str(e)}")
            return False

    def verify_login(self, timeout=10):
        """
        Verify if login was successful.

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            tuple: (success: bool, error_message: str or None)
        """
        try:
            # Wait a bit for page to process
            random_delay(1.0, 2.0)

            # Check for error messages
            error_selectors = [
                ".error",
                ".alert-danger",
                "[class*='error' i]",
                "[class*='wrong' i]"
            ]

            for selector in error_selectors:
                try:
                    error_elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if error_elem and error_elem.is_displayed():
                        error_text = error_elem.text.lower()
                        if 'captcha' in error_text:
                            return (False, 'wrong_captcha')
                        elif 'password' in error_text or 'credential' in error_text or 'invalid' in error_text:
                            return (False, 'invalid_credentials')
                        return (False, error_text)
                except NoSuchElementException:
                    continue

            # Check if URL changed (indication of successful login)
            current_url = self.driver.current_url
            if 'dashboard' in current_url.lower() or 'home' in current_url.lower():
                return (True, None)

            # Check for dashboard elements
            dashboard_selectors = [
                ".dashboard",
                "#dashboard",
                "[class*='dashboard' i]",
                ".welcome",
                ".student-info"
            ]

            for selector in dashboard_selectors:
                try:
                    WebDriverWait(self.driver, timeout).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                    return (True, None)
                except TimeoutException:
                    continue

            return (True, None)  # Assume success if no errors found

        except Exception as e:
            print(f"Error verifying login: {str(e)}")
            return (False, str(e))

    def scrape_student_data(self):
        """
        Scrape student data from the portal.

        Returns:
            dict: Student data including name, attendance, timetable
        """
        data = {
            'name': None,
            'attendance': [],
            'timetable': []
        }

        try:
            # Scrape student name
            data['name'] = self._scrape_student_name()

            # Scrape attendance
            data['attendance'] = self._scrape_attendance()

            # Scrape timetable
            data['timetable'] = self._scrape_timetable()

        except Exception as e:
            print(f"Error scraping student data: {str(e)}")

        return data

    def _scrape_student_name(self):
        """Scrape student name from dashboard."""
        try:
            name_selectors = [
                ".student-name",
                ".user-name",
                ".welcome-name",
                "[class*='student-name' i]",
                "h1.name",
                "h2.name"
            ]

            for selector in name_selectors:
                try:
                    name_elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if name_elem:
                        return name_elem.text.strip()
                except NoSuchElementException:
                    continue

            return None
        except Exception:
            return None

    def _scrape_attendance(self):
        """Scrape attendance data."""
        attendance_data = []

        try:
            # Try navigating to attendance page
            self._navigate_to_route('/attendance')
            random_delay(1.0, 2.0)

            # Find attendance table
            tables = self.driver.find_elements(By.TAG_NAME, 'table')

            for table in tables:
                table_data = self._parse_html_table(table)
                if table_data:
                    attendance_data.extend(table_data)

        except Exception as e:
            print(f"Error scraping attendance: {str(e)}")

        return attendance_data

    def _scrape_timetable(self):
        """Scrape timetable data."""
        timetable_data = []

        try:
            # Try navigating to timetable page
            self._navigate_to_route('/timetable')
            random_delay(1.0, 2.0)

            # Find timetable table
            tables = self.driver.find_elements(By.TAG_NAME, 'table')

            for table in tables:
                table_data = self._parse_html_table(table)
                if table_data:
                    timetable_data.extend(table_data)

        except Exception as e:
            print(f"Error scraping timetable: {str(e)}")

        return timetable_data

    def _navigate_to_route(self, route):
        """
        Navigate to a specific route within the portal.

        Args:
            route: Route path (e.g., '/attendance')
        """
        try:
            # Look for navigation links
            nav_selectors = [
                f"a[href*='{route}']",
                f"[onclick*='{route}']",
                f"button[data-route='{route}']"
            ]

            for selector in nav_selectors:
                try:
                    nav_elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if nav_elem:
                        human_click(self.driver, nav_elem)
                        return
                except NoSuchElementException:
                    continue

            # Try direct URL navigation
            base_url = self.driver.current_url.split('#')[0]
            self.driver.get(f"{base_url}#{route}")

        except Exception as e:
            print(f"Error navigating to {route}: {str(e)}")

    def _parse_html_table(self, table_element):
        """
        Parse an HTML table into a list of dictionaries.

        Args:
            table_element: Selenium WebElement for the table

        Returns:
            list: List of dictionaries representing table rows
        """
        try:
            rows = table_element.find_elements(By.TAG_NAME, 'tr')

            if not rows:
                return []

            # Get headers
            headers = []
            header_row = rows[0]
            th_elements = header_row.find_elements(By.TAG_NAME, 'th')

            if th_elements:
                headers = [th.text.strip() for th in th_elements]
            else:
                # Use first row as headers if no th elements
                td_elements = header_row.find_elements(By.TAG_NAME, 'td')
                headers = [td.text.strip() for td in td_elements]
                rows = rows[1:]  # Skip first row as it's headers

            # Parse data rows
            data = []
            for row in rows[1:]:
                cells = row.find_elements(By.TAG_NAME, 'td')
                if cells and len(cells) == len(headers):
                    row_dict = {}
                    for i, cell in enumerate(cells):
                        row_dict[headers[i]] = cell.text.strip()
                    data.append(row_dict)

            return data

        except Exception as e:
            print(f"Error parsing table: {str(e)}")
            return []

    def login(self, user_id=None, password=None):
        """
        Complete login workflow.

        Args:
            user_id: Optional user ID
            password: Optional password

        Returns:
            tuple: (success: bool, error_message: str or None)
        """
        try:
            # Navigate to portal
            self.navigate_to_portal()

            # Wait for login form
            if not self.wait_for_login_form():
                return (False, 'Login form not found')

            # Fill login form
            if not self.fill_login_form(user_id, password):
                return (False, 'Failed to fill login form')

            # Solve CAPTCHA
            if not self.solve_and_enter_captcha():
                return (False, 'Failed to solve CAPTCHA')

            # Click login
            if not self.click_login():
                return (False, 'Failed to click login button')

            # Verify login
            return self.verify_login()

        except Exception as e:
            return (False, str(e))

    def scrape(self, user_id=None, password=None):
        """
        Complete scraping workflow.

        Args:
            user_id: Optional user ID
            password: Optional password

        Returns:
            dict: Result containing status, data, and metadata
        """
        start_time = time.time()

        try:
            self.start()

            # Login
            success, error = self.login(user_id, password)

            if not success:
                if error == 'wrong_captcha':
                    # Retry once with new CAPTCHA
                    random_delay(1.0, 2.0)
                    success, error = self.login(user_id, password)

                if not success:
                    return {
                        'status': 'error',
                        'error': error,
                        'error_type': 'auth_failed' if 'credential' in str(error).lower() else 'scrape_failed'
                    }

            # Scrape data
            student_data = self.scrape_student_data()

            execution_time = round(time.time() - start_time, 1)

            return {
                'status': 'success',
                'student_data': student_data,
                'metadata': {
                    'captcha_solver': 'Google Cloud Vision',
                    'execution_time': f"{execution_time}s"
                }
            }

        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
                'error_type': 'scrape_failed'
            }

        finally:
            self.stop()
