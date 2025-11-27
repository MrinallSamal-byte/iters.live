"""
Human-like interaction utilities for browser automation.
Implements human typing and random mouse movements to evade bot detection.
"""

import random
import time
from selenium.webdriver.common.action_chains import ActionChains


def human_type(element, text):
    """
    Type text character by character with random delays to simulate human typing.

    Args:
        element: Selenium WebElement to type into
        text: String text to type
    """
    element.clear()
    for char in text:
        element.send_keys(char)
        # Random delay between 0.05 and 0.2 seconds per character
        time.sleep(random.uniform(0.05, 0.2))


def random_mouse_movement(driver, element=None):
    """
    Perform random mouse movements to simulate human behavior.

    Args:
        driver: Selenium WebDriver instance
        element: Optional target element to move towards
    """
    actions = ActionChains(driver)

    if element:
        # Move to element with random offset
        offset_x = random.randint(-5, 5)
        offset_y = random.randint(-5, 5)
        actions.move_to_element_with_offset(element, offset_x, offset_y)
    else:
        # Random movement across the page
        for _ in range(random.randint(2, 4)):
            x_offset = random.randint(-50, 50)
            y_offset = random.randint(-50, 50)
            actions.move_by_offset(x_offset, y_offset)
            actions.pause(random.uniform(0.1, 0.3))

    actions.perform()


def human_click(driver, element):
    """
    Click an element with human-like behavior (random delay and movement).

    Args:
        driver: Selenium WebDriver instance
        element: Selenium WebElement to click
    """
    # Small random delay before clicking
    time.sleep(random.uniform(0.1, 0.3))

    # Move to element with slight random offset
    random_mouse_movement(driver, element)

    # Another small delay before actual click
    time.sleep(random.uniform(0.05, 0.15))

    element.click()


def random_delay(min_seconds=0.5, max_seconds=1.5):
    """
    Add a random delay to simulate human behavior.

    Args:
        min_seconds: Minimum delay in seconds
        max_seconds: Maximum delay in seconds
    """
    time.sleep(random.uniform(min_seconds, max_seconds))
