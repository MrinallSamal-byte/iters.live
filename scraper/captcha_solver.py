"""
CAPTCHA Solver using Google Vision API
Handles CAPTCHA detection and solving for the student portal
"""
import base64
import requests
import re
from config import get_config

class CaptchaSolver:
    """
    CAPTCHA solver using Google Vision API for OCR
    """
    
    def __init__(self):
        self.config = get_config()
        self.api_key = self.config.GOOGLE_VISION_API_KEY
        self.api_endpoint = 'https://vision.googleapis.com/v1/images:annotate'
    
    def solve_captcha(self, image_data):
        """
        Solve CAPTCHA from image data using Google Vision API
        
        Args:
            image_data: Base64 encoded image data or raw bytes
            
        Returns:
            str: Extracted CAPTCHA text or None if failed
        """
        if not self.api_key:
            print('Warning: Google Vision API key not configured')
            return None
        
        try:
            # Ensure image data is base64 encoded
            if isinstance(image_data, bytes):
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            else:
                # Assume it's already base64 encoded string
                image_base64 = image_data
            
            # Prepare the request
            request_body = {
                'requests': [{
                    'image': {
                        'content': image_base64
                    },
                    'features': [{
                        'type': 'TEXT_DETECTION',
                        'maxResults': 1
                    }]
                }]
            }
            
            # Make API request
            response = requests.post(
                f'{self.api_endpoint}?key={self.api_key}',
                json=request_body,
                timeout=10
            )
            
            if response.status_code != 200:
                print(f'Vision API error: {response.status_code}')
                return None
            
            result = response.json()
            
            # Extract text from response
            if 'responses' in result and len(result['responses']) > 0:
                annotations = result['responses'][0].get('textAnnotations', [])
                if annotations:
                    # Get the full text description
                    captcha_text = annotations[0].get('description', '').strip()
                    # Clean up the text - remove newlines and extra spaces
                    captcha_text = self._clean_captcha_text(captcha_text)
                    return captcha_text
            
            return None
            
        except requests.exceptions.Timeout:
            print('Vision API timeout')
            return None
        except Exception as e:
            print(f'CAPTCHA solving error: {str(e)}')
            return None
    
    def _clean_captcha_text(self, text):
        """
        Clean and normalize CAPTCHA text
        
        Args:
            text: Raw extracted text
            
        Returns:
            str: Cleaned CAPTCHA text
        """
        if not text:
            return ''
        
        # Remove whitespace and newlines
        cleaned = re.sub(r'\s+', '', text)
        
        # Remove any non-alphanumeric characters that are unlikely in CAPTCHAs
        # Keep letters and numbers only
        cleaned = re.sub(r'[^a-zA-Z0-9]', '', cleaned)
        
        return cleaned.upper()  # Most CAPTCHAs are case-insensitive
    
    def solve_captcha_from_element(self, driver, element):
        """
        Solve CAPTCHA directly from a web element
        
        Args:
            driver: Selenium WebDriver instance
            element: WebElement containing the CAPTCHA image
            
        Returns:
            str: Extracted CAPTCHA text or None if failed
        """
        try:
            # Get screenshot of the element
            screenshot = element.screenshot_as_png
            return self.solve_captcha(screenshot)
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
                return None
            
            return self.solve_captcha(response.content)
            
        except Exception as e:
            print(f'Error downloading CAPTCHA image: {str(e)}')
            return None


# Factory function
def get_captcha_solver():
    """Get a CAPTCHA solver instance"""
    return CaptchaSolver()
