"""
Flask Application for Student Portal Scraper Microservice
Exposes POST /api/scrape endpoint with proper error handling

TEMPORARILY DISABLED — DO NOT REMOVE
All scraping functionality has been temporarily suspended.
The /api/scrape endpoint will return a disabled response.
"""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
import time
from collections import defaultdict

from config import get_config

# TEMPORARILY DISABLED — DO NOT REMOVE
# Import scraper components only if needed (not used while disabled)
# from scraper import create_scraper, STATUS_SUCCESS, STATUS_AUTH_FAILED, STATUS_SCRAPE_ERROR, STATUS_PORTAL_UNREACHABLE

# Status constants
STATUS_SUCCESS = 'SUCCESS'
STATUS_AUTH_FAILED = 'AUTH_FAILED'
STATUS_SCRAPE_ERROR = 'SCRAPE_ERROR'
STATUS_PORTAL_UNREACHABLE = 'PORTAL_UNREACHABLE'
STATUS_PORTAL_DISABLED = 'PORTAL_DISABLED'

# TEMPORARILY DISABLED — DO NOT REMOVE
# Feature flag to control portal scraping
PORTAL_FEATURES_ENABLED = os.getenv('PORTAL_FEATURES_ENABLED', 'false').lower() == 'true'
PORTAL_DISABLED_MESSAGE = 'Portal data syncing is temporarily suspended. Please try again later.'

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for cross-origin requests from frontend
CORS(app, origins=['*'], supports_credentials=True)

# Load configuration
config = get_config()
app.config['DEBUG'] = config.FLASK_DEBUG
app.config['SECRET_KEY'] = config.SECRET_KEY

# Rate limiting storage (in-memory, consider Redis for production)
rate_limit_storage = defaultdict(list)


def rate_limit(f):
    """Rate limiting decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.remote_addr
        current_time = time.time()
        window = config.SCRAPE_RATE_WINDOW
        max_requests = config.SCRAPE_RATE_LIMIT
        
        # Clean old entries
        rate_limit_storage[client_ip] = [
            t for t in rate_limit_storage[client_ip] 
            if current_time - t < window
        ]
        
        if len(rate_limit_storage[client_ip]) >= max_requests:
            return jsonify({
                'status': 'RATE_LIMITED',
                'message': f'Too many requests. Please wait {window} seconds.'
            }), 429
        
        rate_limit_storage[client_ip].append(current_time)
        return f(*args, **kwargs)
    
    return decorated_function


def validate_scrape_request(data):
    """Validate the scrape request body"""
    if not data:
        return False, 'Request body is required'
    
    if 'reg_number' not in data:
        return False, 'reg_number is required'
    
    if 'password' not in data:
        return False, 'password is required'
    
    if not isinstance(data['reg_number'], str) or len(data['reg_number']) < 3:
        return False, 'Invalid registration number'
    
    if not isinstance(data['password'], str) or len(data['password']) < 3:
        return False, 'Invalid password'
    
    return True, None


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'student-portal-scraper',
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'version': '2.0.0'
    })


@app.route('/api/scrape', methods=['POST'])
@rate_limit
def scrape_portal():
    """
    Scrape student portal data
    
    TEMPORARILY DISABLED — DO NOT REMOVE
    This endpoint is disabled and will return a disabled response.
    
    Request body:
    {
        "reg_number": "string",
        "password": "string"
    }
    
    Response (when disabled):
    { "status": "PORTAL_DISABLED", "message": "..." }
    
    Response (when enabled):
    - Success: { "status": "SUCCESS", "data": {...} }
    - Auth Failed: { "status": "AUTH_FAILED", "message": "..." }
    - Scrape Error: { "status": "SCRAPE_ERROR", "message": "..." }
    """
    # TEMPORARILY DISABLED — DO NOT REMOVE
    # Return disabled response when portal features are suspended
    if not PORTAL_FEATURES_ENABLED:
        print('Portal scrape request received but feature is disabled')
        return jsonify({
            'status': STATUS_PORTAL_DISABLED,
            'message': PORTAL_DISABLED_MESSAGE,
            'portalEnabled': False
        }), 503
    
    # TEMPORARILY DISABLED — DO NOT REMOVE
    # The following code is disabled but preserved for future re-enablement
    # To re-enable: Set PORTAL_FEATURES_ENABLED=true in environment
    #
    # try:
    #     # Get JSON data
    #     data = request.get_json()
    #     
    #     # Validate request
    #     is_valid, error_message = validate_scrape_request(data)
    #     if not is_valid:
    #         return jsonify({
    #             'status': STATUS_SCRAPE_ERROR,
    #             'message': error_message
    #         }), 400
    #     
    #     reg_number = data['reg_number'].strip()
    #     password = data['password']  # Do NOT log this
    #     
    #     # Log the request (without password)
    #     print(f'Scrape request received for: {reg_number}')
    #     
    #     # Create scraper and run
    #     from scraper import create_scraper
    #     scraper = create_scraper()
    #     result = scraper.scrape(reg_number, password)
    #     
    #     # Return appropriate response based on status
    #     status = result.get('status', STATUS_SCRAPE_ERROR)
    #     
    #     if status == STATUS_SUCCESS:
    #         return jsonify(result), 200
    #     elif status == STATUS_AUTH_FAILED:
    #         return jsonify({
    #             'status': STATUS_AUTH_FAILED,
    #             'message': result.get('message', 'Invalid credentials')
    #         }), 401
    #     elif status == STATUS_PORTAL_UNREACHABLE:
    #         return jsonify({
    #             'status': STATUS_PORTAL_UNREACHABLE,
    #             'message': result.get('message', 'Student portal is currently unreachable')
    #         }), 503  # Service Unavailable
    #     else:
    #         # SCRAPE_ERROR or any other error
    #         return jsonify({
    #             'status': STATUS_SCRAPE_ERROR,
    #             'message': result.get('message', 'Failed to scrape portal data')
    #         }), 500
    #         
    # except Exception as e:
    #     # Log error without exposing sensitive details
    #     print(f'Scrape endpoint error: {type(e).__name__}: {str(e)}')
    #     return jsonify({
    #         'status': STATUS_SCRAPE_ERROR,
    #         'message': 'Internal server error'
    #     }), 500
    
    # This should not be reached, but return disabled message as fallback
    return jsonify({
        'status': STATUS_PORTAL_DISABLED,
        'message': PORTAL_DISABLED_MESSAGE,
        'portalEnabled': False
    }), 503


@app.route('/api/test-captcha', methods=['POST'])
def test_captcha():
    """
    Test CAPTCHA solving capability
    
    TEMPORARILY DISABLED — DO NOT REMOVE
    This endpoint is disabled when portal features are suspended.
    
    Request body (optional):
    {
        "image_url": "string" (URL of a CAPTCHA image to test)
    }
    
    Response:
    {
        "status": "ok",
        "api_key_configured": true/false,
        "captcha_text": "string" (if image provided)
    }
    """
    # TEMPORARILY DISABLED — DO NOT REMOVE
    # Return disabled response when portal features are suspended
    if not PORTAL_FEATURES_ENABLED:
        return jsonify({
            'status': STATUS_PORTAL_DISABLED,
            'message': PORTAL_DISABLED_MESSAGE,
            'portalEnabled': False
        }), 503
    
    # TEMPORARILY DISABLED — DO NOT REMOVE
    # The following code is disabled but preserved for future re-enablement
    #
    # try:
    #     from captcha_solver import get_captcha_solver
    #     
    #     solver = get_captcha_solver()
    #     api_key_configured = bool(solver.api_key)
    #     
    #     response = {
    #         'status': 'ok',
    #         'api_key_configured': api_key_configured,
    #         'api_key_length': len(solver.api_key) if solver.api_key else 0
    #     }
    #     
    #     data = request.get_json() or {}
    #     if 'image_url' in data:
    #         captcha_text = solver.solve_captcha_from_url(data['image_url'])
    #         response['captcha_text'] = captcha_text
    #     
    #     return jsonify(response), 200
    #     
    # except Exception as e:
    #     return jsonify({
    #         'status': 'error',
    #         'message': str(e)
    #     }), 500
    
    # This should not be reached, but return disabled message as fallback
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
    # Get port from environment or default
    port = int(os.getenv('FLASK_PORT', 5001))
    
    # Run the app
    # Debug mode is ALWAYS disabled for security - use gunicorn in production
    # For development, use: FLASK_ENV=development flask run --debug
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False  # Never enable debug in this entry point
    )
