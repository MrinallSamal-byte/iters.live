"""
CAPTCHA solver using Google Cloud Vision API.
Handles CAPTCHA image extraction and OCR processing.
"""

import base64
import re
import requests
import cv2
import numpy as np
from selenium.webdriver.common.by import By


def preprocess_captcha_image(image_bytes):
    """
    Preprocess CAPTCHA image using OpenCV for better OCR accuracy.

    Args:
        image_bytes: Raw image bytes

    Returns:
        bytes: Processed image bytes
    """
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return image_bytes

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply thresholding to make text clearer
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Denoise
    denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)

    # Encode back to bytes
    _, buffer = cv2.imencode('.png', denoised)
    return buffer.tobytes()


def solve_captcha_google(driver, api_key):
    """
    Solve CAPTCHA using Google Cloud Vision API.

    Args:
        driver: Selenium WebDriver instance
        api_key: Google Cloud Vision API key

    Returns:
        str: Extracted CAPTCHA text (alphanumeric only) or None if failed
    """
    try:
        # Locate the CAPTCHA image element
        # Common selectors for CAPTCHA images - adjust based on actual page structure
        captcha_selectors = [
            "img[alt*='captcha' i]",
            "img[id*='captcha' i]",
            "img[class*='captcha' i]",
            ".captcha img",
            "#captcha img",
            "img[src*='captcha']",
            "canvas[id*='captcha' i]"
        ]

        captcha_element = None
        for selector in captcha_selectors:
            try:
                captcha_element = driver.find_element(By.CSS_SELECTOR, selector)
                if captcha_element:
                    break
            except Exception:
                continue

        if captcha_element is None:
            # Try to find any image that might be the CAPTCHA
            images = driver.find_elements(By.TAG_NAME, "img")
            for img in images:
                src = img.get_attribute('src') or ''
                alt = img.get_attribute('alt') or ''
                if 'captcha' in src.lower() or 'captcha' in alt.lower():
                    captcha_element = img
                    break

        if captcha_element is None:
            print("CAPTCHA element not found")
            return None

        # Take a screenshot of the CAPTCHA element
        captcha_screenshot = captcha_element.screenshot_as_png

        if not captcha_screenshot:
            print("Failed to capture CAPTCHA screenshot")
            return None

        # Preprocess the image
        processed_image = preprocess_captcha_image(captcha_screenshot)

        # Convert to Base64
        base64_image = base64.b64encode(processed_image).decode('utf-8')

        # Call Google Vision API
        captcha_text = call_google_vision_api(base64_image, api_key)

        return captcha_text

    except Exception as e:
        print(f"Error solving CAPTCHA: {str(e)}")
        return None


def call_google_vision_api(base64_image, api_key):
    """
    Call Google Cloud Vision REST API for text detection.

    Args:
        base64_image: Base64 encoded image string
        api_key: Google Cloud Vision API key

    Returns:
        str: Extracted text (alphanumeric only) or None if failed
    """
    endpoint = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"

    payload = {
        "requests": [
            {
                "image": {
                    "content": base64_image
                },
                "features": [
                    {
                        "type": "TEXT_DETECTION"
                    }
                ]
            }
        ]
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
        response.raise_for_status()

        result = response.json()

        # Extract text from response
        if 'responses' in result and len(result['responses']) > 0:
            response_data = result['responses'][0]

            if 'fullTextAnnotation' in response_data:
                raw_text = response_data['fullTextAnnotation']['text']
            elif 'textAnnotations' in response_data and len(response_data['textAnnotations']) > 0:
                raw_text = response_data['textAnnotations'][0]['description']
            else:
                print("No text detected in CAPTCHA image")
                return None

            # Clean up: Keep only alphanumeric characters
            cleaned_text = re.sub(r'[^a-zA-Z0-9]', '', raw_text.strip())

            return cleaned_text if cleaned_text else None

        return None

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 400:
            print(f"Google Vision API error: Invalid request - {e.response.text}")
        elif e.response.status_code == 403:
            print("Google Vision API error: API key invalid or quota exceeded")
        else:
            print(f"Google Vision API HTTP error: {str(e)}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Google Vision API request error: {str(e)}")
        return None
    except Exception as e:
        print(f"Error calling Google Vision API: {str(e)}")
        return None


def refresh_captcha(driver):
    """
    Attempt to refresh the CAPTCHA image.

    Args:
        driver: Selenium WebDriver instance

    Returns:
        bool: True if refresh was successful, False otherwise
    """
    try:
        # Common refresh button selectors
        refresh_selectors = [
            "button[onclick*='captcha' i]",
            "a[onclick*='captcha' i]",
            ".refresh-captcha",
            "#refresh-captcha",
            "button[title*='refresh' i]",
            "img[onclick*='captcha' i]"
        ]

        for selector in refresh_selectors:
            try:
                refresh_btn = driver.find_element(By.CSS_SELECTOR, selector)
                if refresh_btn:
                    refresh_btn.click()
                    return True
            except Exception:
                continue

        # If no refresh button found, try clicking the CAPTCHA image itself
        captcha_selectors = [
            "img[alt*='captcha' i]",
            "img[id*='captcha' i]",
            "img[class*='captcha' i]"
        ]

        for selector in captcha_selectors:
            try:
                captcha_img = driver.find_element(By.CSS_SELECTOR, selector)
                if captcha_img:
                    captcha_img.click()
                    return True
            except Exception:
                continue

        return False

    except Exception as e:
        print(f"Error refreshing CAPTCHA: {str(e)}")
        return False
