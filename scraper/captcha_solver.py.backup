"""
CAPTCHA Solver using OpenRouter API (primary) and Google Vision API (fallback)
Handles CAPTCHA detection and solving for the SOA Student Portal
"""
import base64
import requests
import re
import os
from config import get_config
from openrouter_captcha import OpenRouterCaptchaSolver

# Default Google Vision API Key for CAPTCHA solving (fallback)
DEFAULT_VISION_API_KEY = 'AIzaSyB5aszVVX1UQuv0MEJOt0QumbnSa4x5z5A'


class CaptchaSolver:
    """
    CAPTCHA solver using OpenRouter API (primary) with Google Vision API fallback
    """
    
    def __init__(self):
        self.config = get_config()
        
        # Initialize OpenRouter solver (primary)
        self.openrouter_solver = None
        openrouter_key = os.getenv('OPENROUTER_API_KEY', '')
        if openrouter_key:
            self.openrouter_solver = OpenRouterCaptchaSolver()
            print('✅ Using OpenRouter API for CAPTCHA solving (primary)')
        
        # Get Google Vision API key (fallback)
        self.api_key = (
            os.getenv('GOOGLE_VISION_API_KEY') or 
            getattr(self.config, 'GOOGLE_VISION_API_KEY', '') or 
            DEFAULT_VISION_API_KEY
        )
        self.api_endpoint = 'https://vision.googleapis.com/v1/images:annotate'
        self.max_retries = 2  # Retry OCR at least once if it fails
        
        if self.api_key:
            print('✅ Using Google Vision API for CAPTCHA solving (fallback)')
        
        if not self.openrouter_solver and not self.api_key:
            print('⚠️ No CAPTCHA solver API configured')
    
    def solve_captcha(self, image_data, retry_count=0):
        """
        Solve CAPTCHA from image data using OpenRouter API (primary) or Google Vision API (fallback)
        
        Args:
            image_data: Base64 encoded image data or raw bytes
            retry_count: Current retry attempt
            
        Returns:
            str: Extracted CAPTCHA text or None if failed
        """
        # Try OpenRouter first
        if self.openrouter_solver:
            try:
                result = self.openrouter_solver.solve_captcha(image_data, retry_count)
                if result:
                    return result
                print('OpenRouter failed, falling back to Google Vision')
            except Exception as e:
                print(f'OpenRouter error: {str(e)}, falling back to Google Vision')
        
        # Fallback to Google Vision API
        if not self.api_key:
            print('Warning: No CAPTCHA solver API configured')
            return None
        
        try:
            # Ensure image data is base64 encoded
            if isinstance(image_data, bytes):
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            else:
                # Assume it's already base64 encoded string
                image_base64 = image_data
            
            # Prepare the request body per Google Vision API spec
            request_body = {
                'requests': [
                    {
                        'image': {
                            'content': image_base64
                        },
                        'features': [
                            {
                                'type': 'TEXT_DETECTION'
                            }
                        ]
                    }
                ]
            }
            
            # Make API request with API key
            url = f'{self.api_endpoint}?key={self.api_key}'
            response = requests.post(
                url,
                json=request_body,
                headers={'Content-Type': 'application/json'},
                timeout=15
            )
            
            if response.status_code != 200:
                print(f'Vision API error: {response.status_code} - {response.text}')
                # Retry on failure
                if retry_count < self.max_retries:
                    print(f'Retrying OCR... attempt {retry_count + 2}')
                    return self.solve_captcha(image_data, retry_count + 1)
                return None
            
            result = response.json()
            
            # Check for errors in response
            if 'error' in result:
                print(f'Vision API error: {result["error"]}')
                return None
            
            # Extract text from response
            if 'responses' in result and len(result['responses']) > 0:
                response_data = result['responses'][0]
                
                # Check for error in individual response
                if 'error' in response_data:
                    print(f'Vision API response error: {response_data["error"]}')
                    return None
                
                annotations = response_data.get('textAnnotations', [])
                if annotations:
                    # Get the full text description (first annotation is the complete text)
                    captcha_text = annotations[0].get('description', '').strip()
                    # Clean up the text
                    captcha_text = self._clean_captcha_text(captcha_text)
                    print(f'OCR detected text: {captcha_text}')
                    return captcha_text
                else:
                    print('No text detected in CAPTCHA image')
            
            return None
            
        except requests.exceptions.Timeout:
            print('Vision API timeout')
            if retry_count < self.max_retries:
                print(f'Retrying OCR after timeout... attempt {retry_count + 2}')
                return self.solve_captcha(image_data, retry_count + 1)
            return None
        except requests.exceptions.RequestException as e:
            print(f'Vision API request error: {str(e)}')
            return None
        except Exception as e:
            print(f'CAPTCHA solving error: {str(e)}')
            return None
    
    def _clean_captcha_text(self, text):
        """
        Clean and normalize CAPTCHA text for SOA portal
        Portal CAPTCHA is typically 5-6 alphanumeric characters
        
        Args:
            text: Raw extracted text
            
        Returns:
            str: Cleaned CAPTCHA text
        """
        if not text:
            return ''
        
        # Remove whitespace, newlines, and special characters
        cleaned = re.sub(r'\s+', '', text)
        
        # Keep only alphanumeric characters
        cleaned = re.sub(r'[^a-zA-Z0-9]', '', cleaned)
        
        # SOA portal CAPTCHA is typically 5-6 characters
        # If we got more, take the first 6
        if len(cleaned) > 6:
            cleaned = cleaned[:6]
        
        # Convert to uppercase (most CAPTCHAs are case-insensitive)
        return cleaned.upper()
    
    def solve_captcha_from_element(self, driver, element, retry_count=0):
        """
        Solve CAPTCHA directly from a web element by taking screenshot
        
        Args:
            driver: Selenium WebDriver instance
            element: WebElement containing the CAPTCHA image
            retry_count: Current retry attempt for OCR
            
        Returns:
            str: Extracted CAPTCHA text or None if failed
        """
        try:
            # Get screenshot of the element
            screenshot = element.screenshot_as_png
            return self.solve_captcha(screenshot, retry_count)
        except Exception as e:
            print(f'Error capturing CAPTCHA element: {str(e)}')
            return None
    
    def solve_captcha_from_url(self, image_url, session=None):
        """
        Solve CAPTCHA from an image URL
        
        Args:
            image_url: URL of the CAPTCHA image
            session: Optional requests session for authenticated requests
            
        Returns:
            str: Extracted CAPTCHA text or None if failed
        """
        try:
            # Download the image
            if session:
                response = session.get(image_url, timeout=10)
            else:
                response = requests.get(image_url, timeout=10)
            
            if response.status_code != 200:
                print(f'Failed to download CAPTCHA image: {response.status_code}')
                return None
            
            return self.solve_captcha(response.content)
            
        except Exception as e:
            print(f'Error downloading CAPTCHA image: {str(e)}')
            return None
    
    def solve_captcha_from_base64_src(self, src_attribute):
        """
        Solve CAPTCHA from a base64 encoded data URL (data:image/png;base64,...)
        
        Args:
            src_attribute: The src attribute of an img element containing base64 data
            
        Returns:
            str: Extracted CAPTCHA text or None if failed
        """
        try:
            # Extract base64 data from data URL
            if src_attribute.startswith('data:'):
                # Format: data:image/png;base64,<base64data>
                parts = src_attribute.split(',')
                if len(parts) > 1:
                    base64_data = parts[1]
                    return self.solve_captcha(base64_data)
            
            return None
        except Exception as e:
            print(f'Error parsing base64 CAPTCHA: {str(e)}')
            return None


# Factory function
def get_captcha_solver():
    """Get a CAPTCHA solver instance"""
    return CaptchaSolver()
