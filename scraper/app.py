"""
Flask application for Student Portal Scraper API.
Provides REST API endpoints for scraping student data.
"""

import time
from flask import Flask, jsonify, request

from config import Config
from scraper import StudentPortalScraper

app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'Student Portal Scraper',
        'captcha_solver': 'Google Cloud Vision'
    })


@app.route('/api/scrape', methods=['POST'])
def scrape_student_data():
    """
    Scrape student data from the portal.

    Request Body (optional):
    {
        "user_id": "student_id",
        "password": "student_password"
    }

    If credentials are not provided, uses environment variables.

    Returns:
        JSON response with student data or error
    """
    start_time = time.time()

    # Validate configuration
    config_errors = Config.validate()
    if config_errors:
        # Check if credentials provided in request
        request_data = request.get_json() or {}
        user_id = request_data.get('user_id')
        password = request_data.get('password')

        if not user_id and 'PORTAL_USER_ID is not set' in config_errors:
            return jsonify({
                'status': 'error',
                'error': 'Missing portal user ID',
                'error_type': 'config_error'
            }), 400

        if not password and 'PORTAL_PASSWORD is not set' in config_errors:
            return jsonify({
                'status': 'error',
                'error': 'Missing portal password',
                'error_type': 'config_error'
            }), 400

        if 'GOOGLE_VISION_API_KEY is not set' in config_errors:
            return jsonify({
                'status': 'error',
                'error': 'Google Vision API key is not configured',
                'error_type': 'config_error'
            }), 500
    else:
        request_data = request.get_json() or {}
        user_id = request_data.get('user_id')
        password = request_data.get('password')

    try:
        # Create scraper instance
        scraper = StudentPortalScraper()

        # Run scraping
        result = scraper.scrape(user_id=user_id, password=password)

        # Handle result
        if result['status'] == 'success':
            return jsonify(result), 200
        else:
            error_type = result.get('error_type', 'unknown')

            if error_type == 'auth_failed':
                return jsonify(result), 401
            elif error_type == 'config_error':
                return jsonify(result), 500
            else:
                return jsonify(result), 500

    except Exception as e:
        execution_time = round(time.time() - start_time, 1)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'error_type': 'internal_error',
            'metadata': {
                'execution_time': f"{execution_time}s"
            }
        }), 500


@app.route('/api/validate-config', methods=['GET'])
def validate_config():
    """
    Validate the current configuration.

    Returns:
        JSON response indicating if configuration is valid
    """
    errors = Config.validate()

    if errors:
        return jsonify({
            'status': 'invalid',
            'errors': errors
        }), 400

    return jsonify({
        'status': 'valid',
        'config': {
            'portal_url': Config.PORTAL_URL,
            'headless_mode': Config.HEADLESS_MODE,
            'has_api_key': bool(Config.GOOGLE_VISION_API_KEY),
            'has_credentials': bool(Config.PORTAL_USER_ID and Config.PORTAL_PASSWORD)
        }
    })


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'status': 'error',
        'error': 'Endpoint not found',
        'error_type': 'not_found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({
        'status': 'error',
        'error': 'Internal server error',
        'error_type': 'internal_error'
    }), 500


if __name__ == '__main__':
    # Validate config on startup
    config_errors = Config.validate()
    if config_errors:
        print("Warning: Configuration issues detected:")
        for error in config_errors:
            print(f"  - {error}")
        print("You can still start the server, but scraping will fail without valid config.")

    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )
