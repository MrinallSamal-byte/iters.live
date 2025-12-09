"""
OpenRouter CAPTCHA Solver
Uses OpenRouter API with vision models to solve CAPTCHAs
Supports multiple free models with automatic fallback
"""
import base64
import requests
import re
import os
from config import get_config


class OpenRouterCaptchaSolver:
    """
    CAPTCHA solver using OpenRouter API with vision models
    """
    
    def __init__(self):
        self.config = get_config()
        # Get API key from environment variable
        self.api_key = os.getenv('OPENROUTER_API_KEY', '')
        self.api_endpoint = 'https://openrouter.ai/api/v1/chat/completions'
        
        # Models for CAPTCHA solving (vision + text understanding)
        self.models = [
            'amazon/nova-2-lite-v1:free',
            'nvidia/nemotron-nano-12b-v2-vl:free',
            'mistralai/mistral-small-3.1-24b-instruct:free',
            'google/gemma-3-4b-it:free',
            'google/gemma-3-12b-it:free'
        ]
        
        self.max_retries = 2  # Retry with different models
    
    def solve_captcha(self, image_data, retry_count=0):
        """
        Solve CAPTCHA from image data using OpenRouter API
        
        Args:
            image_data: Base64 encoded image data or raw bytes
            retry_count: Current retry attempt
            
        Returns:
            str: Extracted CAPTCHA text or None if failed
        """
        if not self.api_key:
            print('Warning: OpenRouter API key not configured')
            return None
        
        try:
            # Ensure image data is base64 encoded
            if isinstance(image_data, bytes):
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            else:
                # Assume it's already base64 encoded string
                image_base64 = image_data
            
            # Try each model in sequence
            for model in self.models:
                try:
                    print(f'Trying OpenRouter model: {model}')
                    result = self._solve_with_model(model, image_base64)
                    if result:
                        print(f'✅ Success with model: {model}')
                        return result
                except Exception as model_error:
                    print(f'❌ Failed with model {model}: {str(model_error)}')
                    continue
            
            # All models failed
            print('All OpenRouter models failed')
            return None
            
        except Exception as e:
            print(f'CAPTCHA solving error: {str(e)}')
            return None
    
    def _solve_with_model(self, model, image_base64):
        """
        Attempt to solve CAPTCHA with a specific model
        
        Args:
            model: Model identifier
            image_base64: Base64 encoded image
            
        Returns:
            str: Extracted text or None
        """
        # Prepare the request body
        request_body = {
            'model': model,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': 'Extract the text from this CAPTCHA image. Return ONLY the text you see, nothing else. The text is typically 5-6 alphanumeric characters.'
                        },
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:image/png;base64,{image_base64}'
                            }
                        }
                    ]
                }
            ],
            'temperature': 0.1,
            'max_tokens': 50
        }
        
        # Make API request
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://iter.edu',
            'X-Title': 'ITER EduHub Portal Scraper'
        }
        
        response = requests.post(
            self.api_endpoint,
            json=request_body,
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f'API error: {response.status_code} - {response.text}')
        
        result = response.json()
        
        # Extract text from response
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0].get('message', {}).get('content', '')
            if content:
                # Clean up the text
                captcha_text = self._clean_captcha_text(content)
                if captcha_text:
                    print(f'OpenRouter detected text: {captcha_text}')
                    return captcha_text
        
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
def get_openrouter_captcha_solver():
    """Get an OpenRouter CAPTCHA solver instance"""
    return OpenRouterCaptchaSolver()
