/**
 * Swipeable Card Component
 * Touch-based card interactions (swipe to dismiss, swipe actions)
 */

class SwipeableCard {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      threshold: 100, // pixels to swipe before action
      velocityThreshold: 0.3, // pixels per ms
      actions: {
        left: null,   // callback for left swipe
        right: null,  // callback for right swipe
      },
      showActions: true, // show action buttons on partial swipe
      maxSwipe: 200, // max pixels to swipe
      snapBack: true, // snap back if threshold not met
      ...options
    };

    this.startX = 0;
    this.currentX = 0;
    this.isDragging = false;
    this.startTime = 0;

    this.init();
  }

  init() {
    this.element.classList.add('swipeable-card');
    
    // Create action buttons if enabled
    if (this.options.showActions) {
      this.createActionButtons();
    }

    this.attachListeners();
  }

  createActionButtons() {
    const leftAction = document.createElement('div');
    leftAction.className = 'swipe-action swipe-action-left';
    leftAction.innerHTML = this.options.leftActionIcon || '<i class="fas fa-trash"></i>';
    
    const rightAction = document.createElement('div');
    rightAction.className = 'swipe-action swipe-action-right';
    rightAction.innerHTML = this.options.rightActionIcon || '<i class="fas fa-check"></i>';

    this.element.parentElement.style.position = 'relative';
    this.element.parentElement.insertBefore(leftAction, this.element);
    this.element.parentElement.appendChild(rightAction);
  }

  attachListeners() {
    // Touch events
    this.element.addEventListener('touchstart', this.handleStart.bind(this), { passive: true });
    this.element.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleEnd.bind(this));
    this.element.addEventListener('touchcancel', this.handleEnd.bind(this));

    // Mouse events (for desktop testing)
    this.element.addEventListener('mousedown', this.handleStart.bind(this));
    this.element.addEventListener('mousemove', this.handleMove.bind(this));
    this.element.addEventListener('mouseup', this.handleEnd.bind(this));
    this.element.addEventListener('mouseleave', this.handleEnd.bind(this));
  }

  handleStart(e) {
    const touch = e.touches ? e.touches[0] : e;
    this.startX = touch.clientX;
    this.currentX = touch.clientX;
    this.isDragging = true;
    this.startTime = Date.now();
    
    this.element.classList.add('swiping');
  }

  handleMove(e) {
    if (!this.isDragging) return;

    const touch = e.touches ? e.touches[0] : e;
    this.currentX = touch.clientX;
    const diff = this.currentX - this.startX;

    // Prevent default to avoid scrolling on horizontal swipe
    if (Math.abs(diff) > 10) {
      e.preventDefault();
    }

    // Apply resistance at boundaries
    let translateX = diff;
    if (Math.abs(diff) > this.options.maxSwipe) {
      const excess = Math.abs(diff) - this.options.maxSwipe;
      translateX = diff > 0 
        ? this.options.maxSwipe + excess * 0.2 
        : -this.options.maxSwipe - excess * 0.2;
    }

    this.element.style.transform = `translateX(${translateX}px)`;
    this.element.style.transition = 'none';

    // Show action hints
    if (this.options.showActions) {
      const opacity = Math.min(Math.abs(diff) / this.options.threshold, 1);
      if (diff < 0) {
        this.element.parentElement.querySelector('.swipe-action-left').style.opacity = opacity;
      } else {
        this.element.parentElement.querySelector('.swipe-action-right').style.opacity = opacity;
      }
    }
  }

  handleEnd(e) {
    if (!this.isDragging) return;

    this.isDragging = false;
    const diff = this.currentX - this.startX;
    const duration = Date.now() - this.startTime;
    const velocity = Math.abs(diff) / duration;

    this.element.classList.remove('swiping');

    // Determine if swipe threshold met
    const thresholdMet = Math.abs(diff) > this.options.threshold || velocity > this.options.velocityThreshold;

    if (thresholdMet) {
      if (diff < 0) {
        this.performAction('left', diff);
      } else {
        this.performAction('right', diff);
      }
    } else {
      this.snapBack();
    }
  }

  performAction(direction, distance) {
    const callback = this.options.actions[direction];
    
    if (callback) {
      // Animate out
      this.element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
      this.element.style.transform = `translateX(${distance > 0 ? '' : '-'}100vw)`;
      this.element.style.opacity = '0';

      setTimeout(() => {
        callback(this.element);
        this.reset();
      }, 300);
    } else {
      this.snapBack();
    }
  }

  snapBack() {
    this.element.style.transition = 'transform 0.3s ease-out';
    this.element.style.transform = 'translateX(0)';

    // Hide action hints
    if (this.options.showActions) {
      const actions = this.element.parentElement.querySelectorAll('.swipe-action');
      actions.forEach(action => action.style.opacity = '0');
    }
  }

  reset() {
    this.element.style.transform = '';
    this.element.style.transition = '';
    this.element.style.opacity = '';
  }

  destroy() {
    this.element.classList.remove('swipeable-card');
    // Remove event listeners
    const newElement = this.element.cloneNode(true);
    this.element.parentNode.replaceChild(newElement, this.element);
  }
}

/**
 * Swipeable Card Manager
 * Manages multiple swipeable cards
 */
class SwipeableCardManager {
  constructor() {
    this.cards = new Map();
  }

  /**
   * Initialize all swipeable cards
   */
  initAll(selector = '.card', options = {}) {
    document.querySelectorAll(selector).forEach(card => {
      this.init(card, options);
    });
  }

  /**
   * Initialize single card
   */
  init(element, options = {}) {
    if (this.cards.has(element)) return;

    const swipeableCard = new SwipeableCard(element, options);
    this.cards.set(element, swipeableCard);
    
    return swipeableCard;
  }

  /**
   * Get card instance
   */
  get(element) {
    return this.cards.get(element);
  }

  /**
   * Destroy card
   */
  destroy(element) {
    const card = this.cards.get(element);
    if (card) {
      card.destroy();
      this.cards.delete(element);
    }
  }

  /**
   * Destroy all cards
   */
  destroyAll() {
    this.cards.forEach((card, element) => {
      card.destroy();
    });
    this.cards.clear();
  }
}

// Export singleton
const swipeableCardManager = new SwipeableCardManager();
window.SwipeableCard = SwipeableCard;
window.swipeableCardManager = swipeableCardManager;

export { SwipeableCard, swipeableCardManager };
export default swipeableCardManager;
