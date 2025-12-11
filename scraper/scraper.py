"""
Student Portal Scraper for SOA Portal
Uses Selenium with human-like behavior and Google Vision API for CAPTCHA solving

Supports multiple portal URLs with fallback:
1. Primary URL from PORTAL_URL environment variable
2. Alternative URLs for backup

===============================================================================
ALL CODE IN THIS FILE HAS BEEN COMMENTED OUT
===============================================================================
This scraper pulls data from external websites and has been disabled.
All functionality is preserved below in comments for reference only.
===============================================================================
"""

# Status constants - kept for compatibility
STATUS_SUCCESS = 'SUCCESS'
STATUS_AUTH_FAILED = 'AUTH_FAILED'
STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR'
STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE'

# Factory function - returns None to indicate scraper is disabled
def create_scraper():
    """Create a new scraper instance - DISABLED"""
    return None

# ============================================================================
# ALL CODE BELOW HAS BEEN COMMENTED OUT - DO NOT USE
# ============================================================================

# import time
# import random
# import re
# import requests
# from selenium.webdriver.common.by import By
# from selenium.webdriver.common.keys import Keys
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC
# from selenium.webdriver.common.action_chains import ActionChains
# from selenium.common.exceptions import (
#     TimeoutException, 
#     NoSuchElementException, 
#     WebDriverException,
#     StaleElementReferenceException,
#     ElementNotInteractableException
# )
# 
# from browser_manager import get_browser_manager
# from captcha_solver import get_captcha_solver
# from config import get_config
#
# # Scraping configuration
# MAX_NOTIFICATIONS_TO_SCRAPE = 10
#
# [REST OF FILE COMMENTED OUT - Scraping functionality disabled]
# The original scraping code has been removed to prevent data pulling from external websites.
# This file is kept for reference only.
