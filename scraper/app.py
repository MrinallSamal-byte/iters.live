"""
Flask Application for Student Portal Scraper Microservice

===============================================================================
ALL CODE IN THIS FILE HAS BEEN COMMENTED OUT
===============================================================================
This service exposes endpoints to scrape data from external student portals.
All scraping functionality has been permanently disabled.
===============================================================================
"""

# Keep minimal imports for basic Flask app structure
import os
from flask import Flask, jsonify
from flask_cors import CORS

# Status constants - kept for compatibility
STATUS_SUCCESS = 'SUCCESS'
STATUS_AUTH_FAILED = 'AUTH_FAILED'
STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR'
STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE'
STATUS_PORTAL_DISABLED = 'PORTAL_DISABLED'

PORTAL_DISABLED_MESSAGE = 'Portal data scraping is permanently disabled.'

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=['*'], supports_credentials=True)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'disabled',
        'service': 'student-portal-scraper',
        'message': 'Scraping service is disabled',
        'version': '2.0.0-disabled'
    })

@app.route('/api/scrape', methods=['POST'])
def scrape_portal():
    """Scrape endpoint - DISABLED"""
    return jsonify({
        'status': STATUS_PORTAL_DISABLED,
        'message': PORTAL_DISABLED_MESSAGE,
        'portalEnabled': False
    }), 503

@app.route('/api/test-captcha', methods=['POST'])
def test_captcha():
    """Test CAPTCHA endpoint - DISABLED"""
    return jsonify({
        'status': STATUS_PORTAL_DISABLED,
        'message': PORTAL_DISABLED_MESSAGE,
        'portalEnabled': False
    }), 503

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(e):
    """Handle 500 errors"""
    return jsonify({
        'status': STATUS_SCRAPE_ERROR,
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False
    )

# ============================================================================
# ALL SCRAPING CODE BELOW HAS BEEN COMMENTED OUT - DO NOT USE
# ============================================================================
# [Original Flask scraper endpoints and logic removed]
# This file is kept for reference only.
