# 🎨 Visual Component Reference Guide

## Quick Reference for All UI/UX Enhancements

---

## 🎭 Animation Classes

### Fade Animations
```html
<div class="fade-in">Fade in</div>
<div class="fade-in-up">Fade in from bottom</div>
<div class="fade-in-down">Fade in from top</div>
<div class="fade-in-left">Fade in from left</div>
<div class="fade-in-right">Fade in from right</div>
```

### Slide Animations
```html
<div class="slide-in-right">Slide from right</div>
<div class="slide-in-left">Slide from left</div>
<div class="slide-up-bounce">Slide up with bounce</div>
```

### Scale & Zoom
```html
<div class="scale-in">Scale in</div>
<div class="zoom-in">Zoom in</div>
<div class="flip-in">Flip in</div>
```

### Micro-Interactions
```html
<button class="wiggle">Wiggle</button>
<button class="shake">Shake</button>
<button class="heartbeat">Heartbeat</button>
<button class="rubber">Rubber</button>
<button class="pulse">Pulse</button>
<button class="bounce">Bounce</button>
```

### Hover Effects
```html
<div class="hover-scale">Scale on hover</div>
<div class="hover-lift">Lift on hover</div>
<div class="hover-glow">Glow on hover</div>
<div class="hover-bounce">Bounce on hover</div>
<div class="hover-tilt">Tilt on hover</div>
```

### Delays
```html
<div class="fade-in delay-1">Delay 0.1s</div>
<div class="fade-in delay-2">Delay 0.2s</div>
<div class="fade-in delay-3">Delay 0.3s</div>
<div class="fade-in stagger-1">Stagger 0.1s</div>
```

---

## 🎴 Card Components

### Glass Card Enhanced
```html
<div class="glass-card-enhanced hover-lift">
    <h3>Title</h3>
    <p>Beautiful glassmorphism effect</p>
</div>
```

### Depth Cards
```html
<div class="card-depth-1">Subtle shadow</div>
<div class="card-depth-2">Light shadow</div>
<div class="card-depth-3">Medium shadow</div>
<div class="card-depth-4">Deep shadow</div>
<div class="card-depth-5">Maximum shadow</div>
```

### Gradient Card
```html
<div class="gradient-card">
    <h3>Gradient Background</h3>
    <p>Animated gradient effect</p>
</div>
```

### Neumorphism Card
```html
<div class="neuro-card">
    <h3>Soft UI Design</h3>
    <p>Neumorphic shadows</p>
</div>
```

### Stat Card
```html
<div class="stat-card hover-lift">
    <div class="stat-card-icon">📊</div>
    <div class="stat-card-value">1,234</div>
    <div class="stat-card-label">Total Users</div>
    <span class="stat-card-change positive">↑ 12%</span>
</div>
```

---

## 🔘 Button Components

### Modern Buttons
```html
<!-- Primary Button -->
<button class="btn-modern btn-modern-primary btn-press">
    <span>Primary Action</span>
</button>

<!-- Secondary Button -->
<button class="btn-modern btn-modern-secondary btn-press">
    <span>Secondary Action</span>
</button>

<!-- Ghost Button -->
<button class="btn-modern btn-modern-ghost btn-press">
    <span>Ghost Action</span>
</button>
```

### Button with Icons
```html
<button class="btn-modern btn-modern-primary btn-press">
    <span>➕</span>
    <span>Add Item</span>
</button>
```

---

## 📝 Form Components

### Modern Input
```html
<input type="text" class="input-modern" placeholder="Enter text">
```

### Input Group with Floating Label
```html
<div class="input-group">
    <input type="text" class="input-modern" placeholder=" ">
    <label class="input-label">Username</label>
</div>
```

### Progress Bar
```html
<div class="progress-bar-modern">
    <div class="progress-bar-fill" style="width: 75%"></div>
</div>
```

---

## 🏷️ Badge Components

```html
<span class="badge-modern badge-success">Success</span>
<span class="badge-modern badge-error">Error</span>
<span class="badge-modern badge-warning">Warning</span>
<span class="badge-modern badge-info">Info</span>
```

---

## 👤 Avatar Components

### Single Avatar
```html
<div class="avatar">
    <img src="avatar.jpg" alt="User">
</div>
```

### Avatar Group
```html
<div class="avatar-group">
    <div class="avatar"><img src="user1.jpg" alt="User 1"></div>
    <div class="avatar"><img src="user2.jpg" alt="User 2"></div>
    <div class="avatar"><img src="user3.jpg" alt="User 3"></div>
</div>
```

---

## 📋 Dropdown Components

```html
<div class="dropdown-modern">
    <button class="btn-modern btn-modern-primary">
        Menu ▼
    </button>
    <div class="dropdown-menu">
        <div class="dropdown-item">Option 1</div>
        <div class="dropdown-item">Option 2</div>
        <div class="dropdown-item">Option 3</div>
    </div>
</div>
```

---

## 🎯 Floating Action Button

```html
<button class="fab fab-pulse">
    <span>+</span>
</button>
```

---

## 💬 Modal Components

```html
<div class="modal-overlay">
    <div class="modal-content-modern">
        <div class="modal-header">
            <h3 class="modal-title">Modal Title</h3>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <p>Modal content goes here...</p>
        </div>
        <div class="modal-footer">
            <button class="btn-modern btn-modern-secondary">Cancel</button>
            <button class="btn-modern btn-modern-primary">Confirm</button>
        </div>
    </div>
</div>
```

---

## 💡 Tooltip Components

```html
<div class="tooltip">
    Hover me
    <span class="tooltip-text">Tooltip text</span>
</div>
```

---

## 📱 Loading Skeletons

```html
<!-- Text Skeleton -->
<div class="skeleton skeleton-text"></div>

<!-- Title Skeleton -->
<div class="skeleton skeleton-title"></div>

<!-- Card Skeleton -->
<div class="skeleton skeleton-card"></div>

<!-- Circle Skeleton -->
<div class="skeleton skeleton-circle"></div>

<!-- Avatar Skeleton -->
<div class="skeleton skeleton-avatar"></div>

<!-- Button Skeleton -->
<div class="skeleton skeleton-button"></div>

<!-- Input Skeleton -->
<div class="skeleton skeleton-input"></div>
```

---

## 🎪 Flip Card

```html
<div class="flip-card">
    <div class="flip-card-inner">
        <div class="flip-card-front">
            <h3>Front Side</h3>
        </div>
        <div class="flip-card-back">
            <h3>Back Side</h3>
        </div>
    </div>
</div>
```

---

## 📜 Scroll Reveal

```html
<section class="scroll-reveal">
    This content reveals on scroll
</section>
```

---

## 🎨 Utility Classes

### Transitions
```html
<div class="transition-all">All properties</div>
<div class="transition-fast">Fast transition</div>
<div class="transition-slow">Slow transition</div>
```

### Performance
```html
<div class="will-change-transform">Optimized transform</div>
<div class="will-change-opacity">Optimized opacity</div>
<div class="gpu-accelerated">Hardware accelerated</div>
```

---

## 🎭 JavaScript API

### Toast Notifications
```javascript
// Simple usage
Toast.success('Success message');
Toast.error('Error message');
Toast.warning('Warning message');
Toast.info('Info message');

// Advanced usage
Toast.show({
    type: 'success',
    title: 'Title',
    message: 'Message',
    duration: 5000,
    closable: true,
    showProgress: true
});

// Clear all toasts
Toast.clearAll();
```

### Particle System
```javascript
// Initialize
const particles = new ParticleSystem('canvasId', {
    particleCount: 60,
    particleColor: 'rgba(99, 102, 241, 0.5)',
    lineColor: 'rgba(99, 102, 241, 0.15)',
    speed: 0.3
});

// Destroy
particles.destroy();
```

### Page Transitions
```javascript
// Fade in
pageTransitions.fadeIn('.element');

// Stagger animation
pageTransitions.staggerIn('.card', {
    stagger: 0.1,
    y: 30
});

// Section transition
pageTransitions.transitionSection(oldSection, newSection);

// Scale in
pageTransitions.scaleIn(element);

// Slide in
pageTransitions.slideIn(element, 'left'); // left, right, up, down

// Setup scroll reveal
pageTransitions.setupScrollReveal('.scroll-reveal');
```

---

## 🎨 Color Variables

```css
:root {
    /* Primary Colors */
    --primary: #667eea;
    --secondary: #764ba2;
    
    /* Status Colors */
    --success: #10b981;
    --error: #ef4444;
    --warning: #f59e0b;
    --info: #3b82f6;
    
    /* Neutral Colors */
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-300: #d1d5db;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-800: #1f2937;
    --gray-900: #111827;
}
```

---

## 📐 Spacing Scale

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;
```

---

## 🎯 Border Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-full: 9999px;
```

---

## 🌊 Shadows

```css
/* Card Shadows */
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);   /* depth-1 */
box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);   /* depth-2 */
box-shadow: 0 8px 16px rgba(0, 0, 0, 0.16);  /* depth-3 */
box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);  /* depth-4 */
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25); /* depth-5 */
```

---

## ⚡ Quick Combinations

### Animated Card
```html
<div class="glass-card-enhanced hover-lift fade-in-up delay-1">
    <h3>Animated Glass Card</h3>
    <p>With hover and entrance animation</p>
</div>
```

### Stat Dashboard
```html
<div class="stats-grid">
    <div class="stat-card hover-lift fade-in-up stagger-1">
        <div class="stat-card-icon">📊</div>
        <div class="stat-card-value">1,234</div>
        <div class="stat-card-label">Users</div>
    </div>
    <!-- More stat cards... -->
</div>
```

### Form with Animation
```html
<form class="fade-in-up">
    <div class="input-group">
        <input type="email" class="input-modern" placeholder=" ">
        <label class="input-label">Email</label>
    </div>
    <button class="btn-modern btn-modern-primary btn-press">
        Submit
    </button>
</form>
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

---

## ♿ Accessibility

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
    /* Animations automatically simplified */
}
```

### ARIA Labels
```html
<button aria-label="Close" class="btn-modern">
    ×
</button>
```

---

## 💡 Pro Tips

1. **Combine Classes**: Mix animation and hover classes for rich effects
2. **Use Delays**: Stagger animations for better visual flow
3. **Performance**: Use will-change on animated elements
4. **Accessibility**: Always respect reduced-motion preferences
5. **Mobile**: Test animations on actual devices
6. **Subtle**: Less is more - don't overdo animations

---

## 🎓 Common Patterns

### Card Grid with Stagger
```html
<div class="grid">
    <div class="stat-card fade-in-up stagger-1 hover-lift">Card 1</div>
    <div class="stat-card fade-in-up stagger-2 hover-lift">Card 2</div>
    <div class="stat-card fade-in-up stagger-3 hover-lift">Card 3</div>
</div>
```

### Hero Section
```html
<section class="hero fade-in">
    <h1 class="fade-in-up delay-1">Welcome</h1>
    <p class="fade-in-up delay-2">Subtitle</p>
    <button class="btn-modern btn-modern-primary fade-in-up delay-3">
        Get Started
    </button>
</section>
```

### Loading State
```html
<div class="card">
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-button"></div>
</div>
```

---

**Quick Reference Complete!** 🎉

Use this guide to quickly implement any UI component or animation in your project.
