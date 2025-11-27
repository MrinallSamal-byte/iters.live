"""
Singleton WebDriver Manager for Selenium
Manages browser instances with configurable headless mode
"""
import threading
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from config import get_config

class BrowserManager:
    """
    Singleton WebDriver manager for handling browser instances
    Thread-safe implementation for concurrent requests
    """
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.config = get_config()
        self._driver = None
        self._driver_lock = threading.Lock()
        self._initialized = True
    
    def _create_driver(self):
        """Create a new WebDriver instance with configured options"""
        chrome_options = Options()
        
        # Headless mode configuration
        if self.config.BROWSER_HEADLESS:
            chrome_options.add_argument('--headless=new')
        
        # Common options for stability
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        
        # User agent to appear more human-like
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # Disable automation flags
        chrome_options.add_experimental_option('excludeSwitches', ['enable-automation'])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Create driver
        driver = webdriver.Chrome(options=chrome_options)
        
        # Set timeouts
        driver.set_page_load_timeout(self.config.BROWSER_TIMEOUT)
        driver.implicitly_wait(self.config.BROWSER_TIMEOUT)
        
        # Execute CDP commands to hide automation indicators
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            '''
        })
        
        return driver
    
    def get_driver(self):
        """
        Get a WebDriver instance.
        Creates a new one if none exists or if the existing one is invalid.
        """
        with self._driver_lock:
            if self._driver is None:
                self._driver = self._create_driver()
            else:
                # Check if driver is still valid
                try:
                    _ = self._driver.current_url
                except Exception:
                    # Driver is invalid, create a new one
                    self._cleanup_driver()
                    self._driver = self._create_driver()
            
            return self._driver
    
    def _cleanup_driver(self):
        """Clean up the current driver instance"""
        if self._driver is not None:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None
    
    def release_driver(self):
        """Release the current driver (for reuse or cleanup)"""
        with self._driver_lock:
            self._cleanup_driver()
    
    def create_fresh_driver(self):
        """
        Create a fresh driver for a new scraping session.
        Returns a new driver instance without caching.
        """
        return self._create_driver()
    
    def quit_driver(self, driver):
        """Quit a specific driver instance"""
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
    
    def __del__(self):
        """Destructor to clean up driver on object destruction"""
        self._cleanup_driver()


# Factory function for creating browser manager
def get_browser_manager():
    """Get the singleton browser manager instance"""
    return BrowserManager()
