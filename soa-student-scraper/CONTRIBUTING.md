# Contributing to SOA Student Portal Scraper

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Security Guidelines](#security-guidelines)

---

## Code of Conduct

This project is built for SOA University students to access their own academic data securely. By participating, you agree to:

1. **Never** request, share, or use credentials that don't belong to you
2. **Never** store or log student credentials or personal data
3. Respect privacy and security at all times
4. Be respectful and constructive in all interactions
5. Report security vulnerabilities responsibly

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report:
- Check existing issues to avoid duplicates
- Test with the latest version
- Gather relevant information (error messages, logs, steps to reproduce)

Create a detailed bug report including:
- **Description:** Clear description of the bug
- **Steps to Reproduce:** Numbered steps to reproduce the issue
- **Expected Behavior:** What should happen
- **Actual Behavior:** What actually happens
- **Environment:** OS, Python/Node version, browser (if applicable)
- **Screenshots:** If applicable

### Suggesting Enhancements

Enhancement suggestions are welcome! Include:
- **Use Case:** Why is this enhancement needed?
- **Proposed Solution:** How would you implement it?
- **Alternatives:** What other approaches did you consider?
- **Impact:** How does this affect existing functionality?

### Pull Requests

Good pull requests are highly appreciated! Before submitting:

1. **Discuss first:** For major changes, open an issue first
2. **One feature per PR:** Keep pull requests focused
3. **Follow coding standards:** See [Coding Standards](#coding-standards)
4. **Test thoroughly:** Ensure all tests pass
5. **Update documentation:** If you change functionality

---

## Development Setup

### Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- Git
- Tesseract OCR
- Code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/updated_iters.live.git
   cd updated_iters.live/soa-student-scraper
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/updated_iters.live.git
   ```

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install dev dependencies
pip install pytest pytest-cov black flake8 mypy

# Install Playwright
playwright install chromium
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Install dev dependencies (usually included in package.json)
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

### Running Tests

**Backend:**
```bash
cd backend
source venv/bin/activate
pytest -v
pytest --cov=. --cov-report=html  # With coverage
```

**Frontend:**
```bash
cd frontend
npm run build  # Ensure build works
npm test       # If tests are configured
```

---

## Coding Standards

### Python (Backend)

**Style Guide:** Follow PEP 8

**Formatting:** Use Black
```bash
black --line-length 100 .
```

**Linting:** Use Flake8
```bash
flake8 --max-line-length=100 --exclude=venv .
```

**Type Hints:** Use type hints for function signatures
```python
def scrape_portal(reg_number: str, password: str) -> ScrapeResult:
    ...
```

**Documentation:** Use docstrings
```python
def function_name(param1: str) -> dict:
    """
    Brief description.
    
    Args:
        param1: Description of param1
        
    Returns:
        Description of return value
    """
```

**Imports:** Organize imports
```python
# Standard library
import os
from typing import Optional

# Third-party
from fastapi import FastAPI

# Local
from scraper import create_scraper
```

### JavaScript/React (Frontend)

**Style Guide:** Airbnb JavaScript Style Guide (loosely)

**Formatting:** Use Prettier
```bash
npx prettier --write "src/**/*.{js,jsx}"
```

**Components:** Use functional components with hooks
```jsx
const MyComponent = ({ prop1, prop2 }) => {
  const [state, setState] = useState(null);
  
  return <div>{/* ... */}</div>;
};
```

**Props:** Destructure props
```jsx
// Good
const Component = ({ name, age }) => { ... }

// Avoid
const Component = (props) => {
  const { name, age } = props;
  ...
}
```

**Naming:**
- Components: PascalCase (`MyComponent.jsx`)
- Functions: camelCase (`handleClick`)
- Constants: UPPER_SNAKE_CASE (`MAX_ATTEMPTS`)

### CSS

- Use CSS custom properties (variables)
- Follow BEM naming when applicable
- Keep selectors simple and specific
- Comment complex styles

### Git Commit Messages

Follow Conventional Commits:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(captcha): improve OCR accuracy with preprocessing

fix(api): handle timeout errors in portal scraping

docs(readme): add installation instructions for Windows

refactor(frontend): simplify state management in App.jsx
```

---

## Submitting Changes

### Before Submitting

1. **Update your fork:**
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   ```

2. **Create a branch:**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Make your changes:**
   - Write clean, documented code
   - Follow coding standards
   - Add tests if applicable

4. **Test thoroughly:**
   ```bash
   # Backend
   cd backend
   pytest
   
   # Frontend
   cd frontend
   npm run build
   ```

5. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat(scope): add new feature"
   ```

6. **Push to your fork:**
   ```bash
   git push origin feature/my-new-feature
   ```

### Creating a Pull Request

1. Go to the original repository on GitHub
2. Click "Pull Requests" → "New Pull Request"
3. Select your branch
4. Fill in the PR template:
   - **Title:** Clear, descriptive title
   - **Description:** What does this PR do?
   - **Related Issues:** Link related issues
   - **Testing:** How did you test this?
   - **Screenshots:** If applicable

5. Wait for review
6. Address feedback if requested
7. Once approved, it will be merged!

### PR Checklist

- [ ] Code follows project coding standards
- [ ] Tests pass (or are not applicable)
- [ ] Documentation updated (if needed)
- [ ] No security vulnerabilities introduced
- [ ] No credentials or sensitive data in code
- [ ] Commit messages are clear and follow conventions
- [ ] PR description is complete

---

## Security Guidelines

**CRITICAL:** This project handles student credentials. Security is paramount.

### Security Rules

1. **NEVER log passwords or credentials**
   ```python
   # BAD
   print(f"Login attempt: {username} / {password}")
   
   # GOOD
   print(f"Login attempt for user")
   ```

2. **NEVER store credentials**
   ```python
   # BAD
   with open('credentials.txt', 'w') as f:
       f.write(f"{username}:{password}")
   
   # GOOD - use in memory only
   scraper.login(username, password)
   del password  # Clear from memory
   ```

3. **Close browser contexts**
   ```python
   try:
       browser = playwright.chromium.launch()
       # ... use browser
   finally:
       browser.close()  # Always close
   ```

4. **Validate all inputs**
   ```python
   from pydantic import BaseModel, Field
   
   class Credentials(BaseModel):
       username: str = Field(min_length=6, max_length=20)
       password: str = Field(min_length=1)
   ```

5. **Use HTTPS in production**
   - Never send credentials over HTTP
   - Enforce HTTPS on frontend and backend

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email the maintainer directly
2. Provide detailed information
3. Wait for acknowledgment before disclosure

---

## What We're Looking For

### High Priority

- **CAPTCHA improvements:** Better OCR accuracy
- **Error handling:** More robust error messages
- **Testing:** Unit and integration tests
- **Documentation:** Clarifications and examples
- **Performance:** Faster scraping, better caching
- **UI/UX:** Improved frontend design

### Welcome Contributions

- Bug fixes
- Code refactoring for better maintainability
- Documentation improvements
- Test coverage improvements
- Accessibility enhancements
- Performance optimizations

### Not Accepting

- Features that compromise security
- Credential storage mechanisms
- Automated credential sharing
- Violations of SOA University policies

---

## Development Tips

### Backend Development

**Hot Reload:**
```bash
uvicorn main:app --reload
```

**Debug Mode:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Test CAPTCHA solver:**
```python
from scraper.captcha_solver import get_captcha_solver
solver = get_captcha_solver()
# Test with image
```

### Frontend Development

**React DevTools:**
- Install React Developer Tools browser extension
- Inspect component hierarchy and state

**Console Logging:**
```jsx
console.log('State:', state);
console.table(data);  // For arrays
```

**Vite Hot Module Replacement:**
- Changes auto-reload during `npm run dev`

---

## Questions?

- Check existing documentation
- Search closed issues
- Create a new issue with the "question" label
- Be patient and respectful

---

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to SOA Student Portal Scraper! 🙏

---

**Last Updated:** December 2024
