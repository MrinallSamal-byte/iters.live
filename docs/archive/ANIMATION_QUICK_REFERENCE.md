# 🚀 ITER EduHub - Animation Quick Reference

## ⚡ Quick Start (Copy-Paste Ready)

### 1. Counter Animation

```html
<!-- In your HTML -->
<div class="counter" data-target="85" data-suffix="%">0</div>
<div class="counter" data-target="1250">0</div>
<div class="counter" data-target="8.5" data-decimals="1">0</div>
```

**That's it! Animates automatically on scroll into view.**

---

### 2. Loading Skeleton

```javascript
// Show skeleton while loading
LoadingManager.showSkeleton('myContent', 'card');

// When data arrives
LoadingManager.hideSkeleton('myContent', '<div>Real content</div>');
```

**Types:** `'card'`, `'list'`, `'table'`, `'text'`, `'stats'`, `'chart'`

---

### 3. Progress Bar

```javascript
// Show progress bar
LoadingManager.showProgress('uploadProgress', 0, 'Uploading...');

// Update progress
LoadingManager.showProgress('uploadProgress', 45);
LoadingManager.showProgress('uploadProgress', 100);
```

---

### 4. Button Loading

```javascript
const btn = document.getElementById('submitBtn');

// Show loading
LoadingManager.showInlineLoader(btn);

// Hide loading
LoadingManager.hideInlineLoader(btn);
```

---

### 5. Toast Notifications

```javascript
Toast.success('Operation successful!');
Toast.error('Something went wrong');
Toast.warning('Please check your input');
Toast.info('New message received');

// With custom duration
Toast.show('Custom message', 'info', 5000);

// Loading toast
const loader = Toast.loading('Processing...');
// Later...
loader.success('Done!');
// or
loader.error('Failed!');
// or
loader.hide();
```

---

### 6. Scroll Animations

```html
<!-- Fade in on scroll -->
<div class="scroll-reveal">Content</div>

<!-- Stagger children -->
<div class="stagger-animation">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<!-- Scale in -->
<div class="scale-in">Scales from 0.8 to 1</div>

<!-- Slide in -->
<div class="slide-in-left">From left</div>
<div class="slide-in-right">From right</div>
```

---

### 7. Hover Effects

```html
<!-- Lift on hover -->
<div class="hover-lift">Lifts up</div>

<!-- Glow on hover -->
<button class="hover-glow">Glows</button>

<!-- 3D tilt -->
<div class="hover-tilt">3D effect</div>

<!-- Floating animation -->
<div class="float-animation">🎈</div>
```

---

### 8. Click Effects

```html
<!-- Ripple effect (already on all .btn) -->
<button class="btn ripple-effect">Click me</button>

<!-- Manual ripple -->
<div class="ripple-effect">Any element</div>
```

---

### 9. Error/Success Animations

```javascript
// Shake on error
AdvancedAnimations.shake(element);

// Success checkmark
AdvancedAnimations.successCheck(element);

// Pulse
AdvancedAnimations.pulse(element);
```

---

### 10. Full Page Loading

```javascript
// Show overlay
LoadingManager.showOverlay('Processing your request...');

// Hide overlay
LoadingManager.hideOverlay();
```

---

## 🎨 Complete Example: Form Submission

```javascript
async function handleSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  
  // Show button loading
  LoadingManager.showInlineLoader(submitBtn);
  
  try {
    // Submit form
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: new FormData(form)
    });
    
    const data = await response.json();
    
    // Hide button loading
    LoadingManager.hideInlineLoader(submitBtn);
    
    if (data.success) {
      // Success animation
      AdvancedAnimations.successCheck(submitBtn);
      Toast.success('Form submitted successfully!');
      form.reset();
    } else {
      // Error animation
      AdvancedAnimations.shake(form);
      Toast.error(data.message || 'Submission failed');
    }
    
  } catch (error) {
    LoadingManager.hideInlineLoader(submitBtn);
    AdvancedAnimations.shake(form);
    Toast.error('Network error. Please try again.');
  }
}
```

---

## 🎯 Complete Example: Data Loading

```javascript
async function loadDashboardData() {
  // Show skeletons
  LoadingManager.showSkeleton('statsSection', 'stats');
  LoadingManager.showSkeleton('attendanceSection', 'list', 5);
  LoadingManager.showSkeleton('marksSection', 'table', 10);
  
  try {
    // Fetch all data
    const [stats, attendance, marks] = await Promise.all([
      API.get('/stats'),
      API.get('/attendance'),
      API.get('/marks')
    ]);
    
    // Render stats with counters
    const statsHTML = `
      <div class="stats-grid stagger-animation">
        <div class="stat-card hover-lift">
          <div class="stat-value counter" data-target="${stats.attendance}">0</div>
          <div class="stat-label">Attendance %</div>
        </div>
        <div class="stat-card hover-lift">
          <div class="stat-value counter" data-target="${stats.sgpa}" data-decimals="1">0</div>
          <div class="stat-label">SGPA</div>
        </div>
      </div>
    `;
    
    // Render attendance list
    const attendanceHTML = attendance.map(item => `
      <div class="attendance-item hover-lift scroll-reveal">
        <span>${item.subject}</span>
        <span class="counter" data-target="${item.percentage}">0</span>%
      </div>
    `).join('');
    
    // Render marks table
    const marksHTML = `
      <table class="marks-table">
        ${marks.map(item => `
          <tr class="hover-lift">
            <td>${item.subject}</td>
            <td class="counter" data-target="${item.marks}">0</td>
          </tr>
        `).join('')}
      </table>
    `;
    
    // Update UI
    LoadingManager.hideSkeleton('statsSection', statsHTML);
    LoadingManager.hideSkeleton('attendanceSection', attendanceHTML);
    LoadingManager.hideSkeleton('marksSection', marksHTML);
    
    // Re-initialize animations for new elements
    window.advancedAnimations.initCounters();
    
  } catch (error) {
    LoadingManager.clear('statsSection');
    LoadingManager.clear('attendanceSection');
    LoadingManager.clear('marksSection');
    Toast.error('Failed to load dashboard data');
  }
}
```

---

## 📱 Complete Example: File Upload with Progress

```javascript
async function uploadFile(file) {
  const progressId = 'fileUploadProgress';
  
  // Create progress container
  document.getElementById('uploadContainer').innerHTML = `
    <div id="${progressId}"></div>
  `;
  
  // Show initial progress
  LoadingManager.showProgress(progressId, 0, 'Preparing upload...');
  
  const formData = new FormData();
  formData.append('file', file);
  
  const xhr = new XMLHttpRequest();
  
  // Track upload progress
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percentage = Math.round((e.loaded / e.total) * 100);
      LoadingManager.showProgress(progressId, percentage, 'Uploading...');
    }
  });
  
  // Handle completion
  xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
      LoadingManager.showProgress(progressId, 100, 'Upload complete!');
      setTimeout(() => {
        LoadingManager.clear(progressId);
        Toast.success('File uploaded successfully!');
      }, 1500);
    } else {
      LoadingManager.clear(progressId);
      Toast.error('Upload failed');
    }
  });
  
  // Handle errors
  xhr.addEventListener('error', () => {
    LoadingManager.clear(progressId);
    Toast.error('Upload failed');
  });
  
  // Send request
  xhr.open('POST', '/api/upload');
  xhr.send(formData);
}
```

---

## 🎨 Animation Class Reference

### Apply to HTML Elements

```html
<!-- Scroll Animations -->
<div class="scroll-reveal">...</div>
<div class="stagger-animation">...</div>
<div class="scale-in">...</div>
<div class="slide-in-left">...</div>
<div class="slide-in-right">...</div>

<!-- Hover Effects -->
<div class="hover-lift">...</div>
<div class="hover-glow">...</div>
<div class="hover-tilt">...</div>

<!-- Continuous Animations -->
<div class="float-animation">...</div>

<!-- Interactive -->
<button class="ripple-effect">...</button>

<!-- Special -->
<h1 class="parallax-text">...</h1>
```

---

## 📦 LoadingManager.showSkeleton() Types

```javascript
'card'   // Single card skeleton
'list'   // Multiple list items (specify count)
'table'  // Table rows (specify count)
'text'   // Text paragraphs
'stats'  // 4 stat cards grid
'chart'  // Chart/graph skeleton
```

---

## 🎯 Toast Types & Methods

```javascript
// Types
Toast.success('Success message')
Toast.error('Error message')
Toast.warning('Warning message')
Toast.info('Info message')

// Custom
Toast.show('Message', 'type', duration)

// Loading
const loader = Toast.loading('Loading...')
loader.update('New message')
loader.success('Done!')
loader.error('Failed!')
loader.hide()

// Confirmation
Toast.confirm(
  'Are you sure?',
  () => console.log('Confirmed'),
  () => console.log('Cancelled')
)

// Clear all
Toast.clearAll()
```

---

## ⚡ Performance Tips

1. **Use skeletons** instead of spinners for better UX
2. **Batch DOM updates** to avoid reflows
3. **Use counters** for numbers instead of instant display
4. **Add scroll-reveal** to sections for smooth entry
5. **Use hover-lift** on cards for interactivity

---

## 🐛 Common Mistakes

### ❌ Wrong:
```javascript
// Don't forget to clear loaders
LoadingManager.showSkeleton('content', 'card');
// Fetch data...
// Forgot to clear!
```

### ✅ Correct:
```javascript
LoadingManager.showSkeleton('content', 'card');
const data = await fetchData();
LoadingManager.hideSkeleton('content', renderData(data));
```

---

### ❌ Wrong:
```html
<!-- Counter without data-target -->
<div class="counter">85</div>
```

### ✅ Correct:
```html
<div class="counter" data-target="85">0</div>
```

---

### ❌ Wrong:
```javascript
// Button loader without storing reference
LoadingManager.showInlineLoader(btn);
// Later... can't hide it properly
```

### ✅ Correct:
```javascript
const btn = document.getElementById('submitBtn');
LoadingManager.showInlineLoader(btn);
// Later...
LoadingManager.hideInlineLoader(btn);
```

---

## 🎨 CSS Variables You Can Customize

```css
:root {
  /* Colors */
  --primary: #6366f1;
  --secondary: #ec4899;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  
  /* Timings */
  --fast: 150ms;
  --base: 250ms;
  --slow: 350ms;
  
  /* Easings */
  --ease-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 📚 Need More Help?

Check:
- `ANIMATION_ENHANCEMENT_COMPLETE.md` - Full documentation
- `client/js/advanced-animations.js` - Source code with comments
- `client/js/loading-states.js` - Loading states source
- `client/css/animations.css` - All animation styles

---

**🎨 Happy Coding! Make it beautiful! ✨**
