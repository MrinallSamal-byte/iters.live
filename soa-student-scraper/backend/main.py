"""
SOA Student Portal Scraper - FastAPI Backend

A secure, real-time web application that allows SOA University students 
to fetch their own live academic data from the official portal.

SECURITY NOTES:
- Credentials are NEVER logged, stored, or cached
- Passwords exist only in memory during scraping
- Browser context is closed after every request
- No credentials in logs, database, or cache

Endpoints:
- POST /api/scrape-portal - Scrape live data with user credentials
- GET /api/dummy-data - Get generic sample student profile
- GET /health - Health check endpoint
"""

import json
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Import scraper modules
from scraper import create_scraper, ScrapeResult

# Load dummy data
DUMMY_DATA_PATH = os.path.join(os.path.dirname(__file__), 'scraper', 'dummy_data.json')
with open(DUMMY_DATA_PATH, 'r') as f:
    DUMMY_DATA = json.load(f)


# Request/Response Models
class ScrapeRequest(BaseModel):
    """Request model for portal scraping."""
    registration_number: str = Field(
        ...,
        description="Student's registration number",
        min_length=6,
        max_length=20
    )
    password: str = Field(
        ...,
        description="Student's password (NOT logged or stored)",
        min_length=1
    )


class ScrapeResponse(BaseModel):
    """Response model for portal scraping."""
    success: bool
    status: str
    message: str
    attempt: int
    attemptsRemaining: int
    data: Optional[dict] = None
    isDemo: bool = False


class DummyDataResponse(BaseModel):
    """Response model for dummy data."""
    success: bool
    status: str
    message: str
    data: dict
    isDemo: bool = True


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    service: str
    version: str
    timestamp: str


# Create FastAPI app
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("🚀 SOA Student Portal Scraper starting...")
    yield
    # Shutdown
    print("👋 SOA Student Portal Scraper shutting down...")


app = FastAPI(
    title="SOA Student Portal Scraper",
    description="Secure, real-time academic data fetching for SOA University students",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
# NOTE: In production, replace "*" with specific trusted domains like:
# ["https://your-frontend.vercel.app", "https://yourdomain.com"]
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Request attempt tracking (in-memory, resets per session)
# Note: This does NOT store credentials, only attempt counts by IP
attempt_tracker: dict = {}


def get_client_key(request: Request) -> str:
    """Get a unique key for tracking attempts (IP-based, no credentials)."""
    client_ip = request.client.host if request.client else "unknown"
    return f"attempts:{client_ip}"


def reset_attempt_count(key: str) -> None:
    """Reset attempt count for a client."""
    if key in attempt_tracker:
        del attempt_tracker[key]


def get_attempt_count(key: str) -> int:
    """Get current attempt count for a client."""
    return attempt_tracker.get(key, 0)


def increment_attempt_count(key: str) -> int:
    """Increment and return attempt count for a client."""
    current = attempt_tracker.get(key, 0) + 1
    attempt_tracker[key] = current
    return current


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    
    Returns service status and version information.
    """
    return HealthResponse(
        status="healthy",
        service="soa-student-scraper",
        version="1.0.0",
        timestamp=datetime.utcnow().isoformat()
    )


@app.get("/api/dummy-data", response_model=DummyDataResponse)
async def get_dummy_data():
    """
    Get generic sample student profile.
    
    Returns a fully anonymized, fictional student profile for demo purposes.
    This endpoint does NOT attempt any login.
    
    Returns:
        DummyDataResponse with sample student data
    """
    response_data = DUMMY_DATA.copy()
    response_data['fetchedAt'] = datetime.utcnow().isoformat()
    
    return DummyDataResponse(
        success=True,
        status="DEMO_LOADED",
        message="Demo Mode Active — Sample Data",
        data=response_data['data'],
        isDemo=True
    )


@app.post("/api/scrape-portal", response_model=ScrapeResponse)
async def scrape_portal(request: Request, scrape_request: ScrapeRequest):
    """
    Scrape live student data from the SOA portal.
    
    SECURITY:
    - Credentials are ONLY held in memory during this request
    - Password is NEVER logged, stored, or cached
    - Browser context is closed after every request
    
    3-Attempt Retry Logic:
    - Attempts 1-2: Return error with remaining attempts
    - Attempt 3: If fails, suggest dummy data
    
    Args:
        scrape_request: Contains registration_number and password
        
    Returns:
        ScrapeResponse with scraped data or error
    """
    client_key = get_client_key(request)
    current_attempt = increment_attempt_count(client_key)
    max_attempts = 3
    attempts_remaining = max(0, max_attempts - current_attempt)
    
    # Create scraper instance
    scraper = create_scraper()
    
    # Perform scraping (credentials only in memory during this call)
    # NOTE: We intentionally do NOT log the registration_number or password
    result: ScrapeResult = scraper.scrape_portal(
        registration_number=scrape_request.registration_number,
        password=scrape_request.password,
        attempt=current_attempt
    )
    
    # SECURITY: Clear password from memory immediately after API call
    # Using del to explicitly remove the password from the request object
    try:
        del scrape_request.password
    except AttributeError:
        pass  # Already cleared
    
    if result.success:
        # Reset attempt count on success
        reset_attempt_count(client_key)
        
        return ScrapeResponse(
            success=True,
            status=result.status,
            message=result.message,
            attempt=current_attempt,
            attemptsRemaining=attempts_remaining,
            data=result.data,
            isDemo=False
        )
    
    # Handle failure
    if current_attempt >= max_attempts:
        # After max attempts, suggest dummy data
        reset_attempt_count(client_key)
        
        return ScrapeResponse(
            success=False,
            status=result.status,
            message=f"{result.message} All {max_attempts} attempts exhausted. Try 'Load Dummy Data' for a demo.",
            attempt=current_attempt,
            attemptsRemaining=0,
            data=None,
            isDemo=False
        )
    
    # Return error with remaining attempts
    return ScrapeResponse(
        success=False,
        status=result.status,
        message=f"Attempt {current_attempt}/{max_attempts}: {result.message}",
        attempt=current_attempt,
        attemptsRemaining=attempts_remaining,
        data=None,
        isDemo=False
    )


@app.post("/api/scrape")
async def scrape_portal_legacy(request: Request, body: dict):
    """
    Legacy endpoint for compatibility with existing Node.js controller.
    
    This endpoint matches the API contract expected by the Node.js backend
    at server/controllers/portal.controller.js
    
    Expected request:
    {
      "reg_number": "string",
      "password": "string"
    }
    
    Response format:
    {
      "status": "SUCCESS" | "AUTH_FAILED" | "SCRAPE_ERROR" | "PORTAL_UNREACHABLE",
      "data": { ... } | null,
      "message": "string"
    }
    """
    try:
        # Map request fields to our format
        reg_number = body.get('reg_number') or body.get('registration_number')
        password = body.get('password')
        
        if not reg_number or not password:
            return {
                "status": "SCRAPE_ERROR",
                "data": None,
                "message": "Registration number and password are required"
            }
        
        # Create scraper and perform scraping
        scraper = create_scraper()
        result: ScrapeResult = scraper.scrape_portal(
            registration_number=reg_number,
            password=password,
            attempt=1
        )
        
        # SECURITY: Clear password from memory
        del password
        
        # Map our response to legacy format
        if result.success:
            return {
                "status": result.status,
                "data": result.data,
                "message": result.message or "Portal login successful"
            }
        else:
            return {
                "status": result.status,
                "data": None,
                "message": result.message or "Failed to fetch portal data"
            }
            
    except Exception as e:
        print(f"Legacy scrape error: {str(e)}")
        return {
            "status": "SCRAPE_ERROR",
            "data": None,
            "message": f"Internal error: {str(e)}"
        }



@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions."""
    # Log error without any credential information
    print(f"Error: {type(exc).__name__}: {str(exc)}")
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "status": "INTERNAL_ERROR",
            "message": "An internal error occurred. Please try again.",
            "attempt": 0,
            "attemptsRemaining": 3,
            "data": None,
            "isDemo": False
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
