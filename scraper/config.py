"""
Configuration module for Student Portal Scraper.
Loads environment variables from .env file.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Configuration class for environment variables."""

    # Portal credentials
    PORTAL_USER_ID = os.getenv('PORTAL_USER_ID', '')
    PORTAL_PASSWORD = os.getenv('PORTAL_PASSWORD', '')

    # Google Vision API
    GOOGLE_VISION_API_KEY = os.getenv('GOOGLE_VISION_API_KEY', '')

    # Browser settings
    HEADLESS_MODE = os.getenv('HEADLESS_MODE', 'True').lower() == 'true'

    # Target URL
    PORTAL_URL = 'https://soaportals.com/StudentPortalSOA/#/'

    @classmethod
    def validate(cls):
        """Validate that all required configuration is present."""
        errors = []

        if not cls.PORTAL_USER_ID:
            errors.append('PORTAL_USER_ID is not set')
        if not cls.PORTAL_PASSWORD:
            errors.append('PORTAL_PASSWORD is not set')
        if not cls.GOOGLE_VISION_API_KEY:
            errors.append('GOOGLE_VISION_API_KEY is not set')

        return errors
