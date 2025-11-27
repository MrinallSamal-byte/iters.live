"""
Singleton WebDriver Manager for Selenium
Manages browser instances with configurable headless mode
Includes undetected Chrome settings to avoid bot detection
"""
import threading
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from config import get_config


class BrowserManager:
    """
    Singleton WebDriver manager for handling browser instances
    Thread-safe implementation for concurrent requests
    Uses undetected settings to avoid bot detection
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
        """Create a new WebDriver instance with undetected Chrome settings"""
        chrome_options = Options()
        
        # Headless mode configuration (use new headless mode)
        if self.config.BROWSER_HEADLESS:
            chrome_options.add_argument('--headless=new')
        
        # Common stability options
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        # Undetected Chrome settings to avoid bot detection
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-infobars')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-popup-blocking')
        chrome_options.add_argument('--ignore-certificate-errors')
        chrome_options.add_argument('--ignore-ssl-errors')
        
        # User agent to appear more human-like
        chrome_options.add_argument(
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # Disable automation flags
        chrome_options.add_experimental_option('excludeSwitches', ['enable-automation', 'enable-logging'])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Additional preferences to avoid detection
        prefs = {
            'credentials_enable_service': False,
            'profile.password_manager_enabled': False,
            'profile.default_content_setting_values.notifications': 2,
            'download.prompt_for_download': False,
            'download.default_directory': '/tmp',
            'safebrowsing.enabled': False
        }
        chrome_options.add_experimental_option('prefs', prefs)
        
        # Create driver using webdriver-manager for automatic ChromeDriver management
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Set timeouts
        driver.set_page_load_timeout(self.config.BROWSER_TIMEOUT)
        driver.implicitly_wait(10)  # 10 seconds implicit wait
        
        # Execute CDP commands to hide automation indicators
        try:
            driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                'source': '''
                    // Overwrite navigator.webdriver
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    
                    // Overwrite chrome.runtime to remove automation detection
                    window.chrome = {
                        runtime: {}
                    };
                    
                    // Overwrite navigator.plugins to appear more human
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5]
                    });
                    
                    // Overwrite navigator.languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en']
                    });
                '''
            })
            
            # Disable webdriver detection
            driver.execute_cdp_cmd('Network.setUserAgentOverride', {
                'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            })
        except Exception as e:
            print(f'Warning: Could not execute CDP commands: {str(e)}')
        
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
