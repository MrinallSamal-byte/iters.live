"""
Configuration settings for the Flask Scraper Microservice
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Default Google Vision API Key (can be overridden by environment)
DEFAULT_GOOGLE_VISION_API_KEY = 'AIzaSyB5aszVVX1UQuv0MEJOt0QumbnSa4x5z5A'


class Config:
    """Base configuration"""
    # Flask settings
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    SECRET_KEY = os.getenv('SECRET_KEY', 'change-this-in-production')
    
    # Portal URL
    PORTAL_URL = os.getenv('PORTAL_URL', 'https://soaportals.com/StudentPortalSOA/#/')
    
    # Browser settings
    BROWSER_HEADLESS = os.getenv('BROWSER_HEADLESS', 'True').lower() == 'true'
    BROWSER_TIMEOUT = int(os.getenv('BROWSER_TIMEOUT', '30'))
    
    # Google Vision API (for CAPTCHA solving)
    # API key-based authentication (preferred for simplicity)
    GOOGLE_VISION_API_KEY = os.getenv('GOOGLE_VISION_API_KEY', DEFAULT_GOOGLE_VISION_API_KEY)
    # Service account-based authentication (alternative)
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', '')
    
    # Rate limiting
    SCRAPE_RATE_LIMIT = int(os.getenv('SCRAPE_RATE_LIMIT', '10'))
    SCRAPE_RATE_WINDOW = int(os.getenv('SCRAPE_RATE_WINDOW', '60'))
    
    # Retry settings
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))
    RETRY_DELAY = int(os.getenv('RETRY_DELAY', '2'))
    
    # CAPTCHA settings
    MAX_CAPTCHA_RETRIES = int(os.getenv('MAX_CAPTCHA_RETRIES', '3'))


class DevelopmentConfig(Config):
    """Development configuration"""
    FLASK_DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    FLASK_DEBUG = False


# Get config based on environment
def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    if env == 'production':
        return ProductionConfig
    return DevelopmentConfig
