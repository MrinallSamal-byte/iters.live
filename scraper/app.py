"""
Flask Application for Student Portal Scraper Microservice
Exposes POST /api/scrape endpoint
"""
import os
from flask import Flask, request, jsonify
from functools import wraps
import time
from collections import defaultdict

from config import get_config
from scraper import create_scraper

# Initialize Flask app
app = Flask(__name__)

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
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    })


@app.route('/api/scrape', methods=['POST'])
@rate_limit
def scrape_portal():
    """
    Scrape student portal data
    
    Request body:
    {
        "reg_number": "string",
        "password": "string"
    }
    
    Response:
    - Success: { "status": "SUCCESS", "data": {...} }
    - Auth Failed: { "status": "AUTH_FAILED" }
    - Error: { "status": "SCRAPE_ERROR" }
    """
    try:
        # Get JSON data
        data = request.get_json()
        
        # Validate request
        is_valid, error_message = validate_scrape_request(data)
        if not is_valid:
            return jsonify({
                'status': 'SCRAPE_ERROR',
                'message': error_message
            }), 400
        
        reg_number = data['reg_number'].strip()
        password = data['password']  # Do NOT log this
        
        # Log the request (without password)
        print(f'Scrape request received for: {reg_number}')
        
        # Create scraper and run
        scraper = create_scraper()
        result = scraper.scrape(reg_number, password)
        
        # Return appropriate response
        if result['status'] == 'SUCCESS':
            return jsonify(result), 200
        elif result['status'] == 'AUTH_FAILED':
            return jsonify(result), 401
        else:
            return jsonify(result), 500
            
    except Exception as e:
        # Log error without exposing sensitive details
        print(f'Scrape endpoint error: {type(e).__name__}')
        return jsonify({
            'status': 'SCRAPE_ERROR'
        }), 500


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
        'status': 'SCRAPE_ERROR',
        'message': 'Internal server error'
    }), 500


if __name__ == '__main__':
    # Get port from environment or default
    port = int(os.getenv('FLASK_PORT', 5001))
    
    # Run the app
    # Debug mode is controlled by config.FLASK_DEBUG (default False)
    app.run(
        host='0.0.0.0',
        port=port,
        debug=config.FLASK_DEBUG
    )
