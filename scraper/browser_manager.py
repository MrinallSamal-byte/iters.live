"""
Browser session manager with singleton pattern for handling WebDriver instances.
"""

import threading
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

from config import Config


class BrowserManager:
    """
    Singleton session manager for handling browser instances.
    Thread-safe implementation to ensure only one browser instance per session.
    """

    _instance = None
    _lock = threading.Lock()
    _driver = None

    def __new__(cls):
        """Ensure only one instance of BrowserManager exists."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def get_driver(self):
        """
        Get or create a WebDriver instance.

        Returns:
            WebDriver: Chrome WebDriver instance
        """
        if self._driver is None:
            self._driver = self._create_driver()
        return self._driver

    def _create_driver(self):
        """
        Create a new Chrome WebDriver with appropriate options.

        Returns:
            WebDriver: Configured Chrome WebDriver instance
        """
        chrome_options = Options()

        if Config.HEADLESS_MODE:
            chrome_options.add_argument('--headless=new')

        # Common options for stability and bot evasion
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        # Disable automation flags
        chrome_options.add_experimental_option('excludeSwitches', ['enable-automation'])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # Execute CDP commands to hide webdriver
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            '''
        })

        return driver

    def quit(self):
        """Quit the browser and clean up resources."""
        if self._driver is not None:
            try:
                self._driver.quit()
            except Exception:
                pass
            finally:
                self._driver = None

    def refresh_session(self):
        """Refresh the browser session by quitting and creating a new driver."""
        self.quit()
        return self.get_driver()
