"""
CAPTCHA Solver using pytesseract + PIL (OCR)

Implements automatic CAPTCHA solving with image preprocessing:
- Grayscale conversion
- Thresholding for better contrast
- PSM 8 + alphanumeric whitelist for optimal recognition
"""

import io
import re
from typing import Optional, Tuple
from PIL import Image, ImageFilter, ImageOps

try:
    import pytesseract
except ImportError:
    pytesseract = None


class CaptchaSolver:
    """CAPTCHA solver using OCR with image preprocessing."""
    
    def __init__(self):
        """Initialize CAPTCHA solver."""
        self.tesseract_available = pytesseract is not None
        
    def preprocess_image(self, image_bytes: bytes) -> Image.Image:
        """
        Preprocess CAPTCHA image for better OCR accuracy.
        
        Steps:
        1. Convert to grayscale
        2. Apply contrast enhancement
        3. Apply threshold for binarization
        4. Remove noise with median filter
        
        Args:
            image_bytes: Raw image bytes
            
        Returns:
            Preprocessed PIL Image
        """
        # Load image from bytes
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to grayscale
        gray = ImageOps.grayscale(image)
        
        # Increase contrast
        gray = ImageOps.autocontrast(gray, cutoff=2)
        
        # Apply threshold (binarization)
        threshold = 128
        binary = gray.point(lambda x: 255 if x > threshold else 0, mode='1')
        
        # Convert back to L mode for tesseract
        binary = binary.convert('L')
        
        # Apply slight blur then sharpen to reduce noise
        binary = binary.filter(ImageFilter.MedianFilter(size=3))
        
        return binary
    
    def solve_captcha(self, image_bytes: bytes) -> Tuple[Optional[str], bool]:
        """
        Solve CAPTCHA from image bytes using OCR.
        
        Args:
            image_bytes: Raw CAPTCHA image bytes
            
        Returns:
            Tuple of (solved_text, success_flag)
            - solved_text: Extracted text or None if failed
            - success_flag: True if extraction was successful
        """
        if not self.tesseract_available:
            return None, False
            
        try:
            # Preprocess the image
            processed_image = self.preprocess_image(image_bytes)
            
            # Configure tesseract for CAPTCHA recognition
            # PSM 8: Treat the image as a single word
            # OEM 3: Default OCR Engine Mode
            # Whitelist: Only alphanumeric characters
            custom_config = r'--psm 8 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            
            # Extract text
            text = pytesseract.image_to_string(
                processed_image,
                config=custom_config
            ).strip()
            
            # Clean up extracted text
            text = self._clean_text(text)
            
            # Validate extracted text
            if self._is_valid_captcha(text):
                return text, True
            else:
                return text, False
                
        except Exception:
            return None, False
    
    def _clean_text(self, text: str) -> str:
        """
        Clean extracted text by removing unwanted characters.
        
        Args:
            text: Raw extracted text
            
        Returns:
            Cleaned text with only alphanumeric characters
        """
        # Remove all non-alphanumeric characters
        cleaned = re.sub(r'[^A-Za-z0-9]', '', text)
        return cleaned
    
    def _is_valid_captcha(self, text: str) -> bool:
        """
        Validate if extracted text looks like a valid CAPTCHA.
        
        Args:
            text: Cleaned extracted text
            
        Returns:
            True if text appears to be a valid CAPTCHA
        """
        # CAPTCHA typically has 4-8 characters
        if not text or len(text) < 4 or len(text) > 8:
            return False
        return True
    
    def solve_with_retry(self, image_bytes: bytes, max_attempts: int = 2) -> Tuple[Optional[str], bool, int]:
        """
        Attempt to solve CAPTCHA with different preprocessing settings.
        
        Args:
            image_bytes: Raw CAPTCHA image bytes
            max_attempts: Maximum preprocessing variations to try
            
        Returns:
            Tuple of (solved_text, success_flag, attempts_used)
        """
        if not self.tesseract_available:
            return None, False, 0
            
        for attempt in range(1, max_attempts + 1):
            text, success = self.solve_captcha(image_bytes)
            if success:
                return text, True, attempt
                
            # Try with different threshold on subsequent attempts
            if attempt < max_attempts:
                try:
                    image = Image.open(io.BytesIO(image_bytes))
                    gray = ImageOps.grayscale(image)
                    
                    # Try with different threshold
                    threshold = 100 if attempt == 1 else 150
                    binary = gray.point(lambda x: 255 if x > threshold else 0, mode='1')
                    binary = binary.convert('L')
                    
                    custom_config = r'--psm 8 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
                    text = pytesseract.image_to_string(binary, config=custom_config).strip()
                    text = self._clean_text(text)
                    
                    if self._is_valid_captcha(text):
                        return text, True, attempt
                except Exception:
                    continue
                    
        return text if text else None, False, max_attempts


# Singleton instance
_solver_instance = None


def get_captcha_solver() -> CaptchaSolver:
    """Get or create the CAPTCHA solver singleton instance."""
    global _solver_instance
    if _solver_instance is None:
        _solver_instance = CaptchaSolver()
    return _solver_instance
