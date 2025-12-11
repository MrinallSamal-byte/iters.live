"""
SOA Student Portal Scraper - Backend Package

This package contains the scraping utilities for the SOA Student Portal.
"""

from .captcha_solver import get_captcha_solver, CaptchaSolver
from .live_scraper import create_scraper, SOAPortalScraper, ScrapeResult

__all__ = [
    'get_captcha_solver',
    'CaptchaSolver',
    'create_scraper',
    'SOAPortalScraper',
    'ScrapeResult'
]
