/**
 * Advanced Particle System for ITER College Management System
 * Creates dynamic, interactive particle backgrounds
 * Memory-optimized with cleanup and lazy initialization
 */

class ParticleSystem {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn(`Canvas with id "${canvasId}" not found`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.animationId = null;
        this.isRunning = false;
        this.isVisible = true;
        
        // Bound event handlers for proper cleanup
        this._boundResize = this.resize.bind(this);
        this._boundMouseMove = this.handleMouseMove.bind(this);
        this._boundMouseLeave = this.handleMouseLeave.bind(this);
        this._boundVisibilityChange = this.handleVisibilityChange.bind(this);
        
        // Configuration - reduce particle count for better performance
        const isMobile = window.innerWidth < 768;
        const defaultParticleCount = isMobile ? 30 : 50; // Reduced from 80
        
        this.config = {
            particleCount: options.particleCount || defaultParticleCount,
            particleColor: options.particleColor || 'rgba(99, 102, 241, 0.5)',
            lineColor: options.lineColor || 'rgba(99, 102, 241, 0.2)',
            particleSize: options.particleSize || 2,
            maxDistance: options.maxDistance || 100, // Reduced from 120
            speed: options.speed || 0.5,
            interactive: options.interactive !== false,
            glow: options.glow !== false && !isMobile // Disable glow on mobile
        };
        
        this.init();
    }
    
    init() {
        // Set canvas size
        this.resize();
        
        // Create particles
        this.createParticles();
        
        // Event listeners with proper references for cleanup
        window.addEventListener('resize', this._boundResize, { passive: true });
        document.addEventListener('visibilitychange', this._boundVisibilityChange);
        
        if (this.config.interactive) {
            this.canvas.addEventListener('mousemove', this._boundMouseMove, { passive: true });
            this.canvas.addEventListener('mouseleave', this._boundMouseLeave, { passive: true });
        }
        
        // Start animation
        this.start();
    }
    
    /**
     * Handle visibility change to pause animation when tab is hidden
     */
    handleVisibilityChange() {
        if (document.hidden) {
            this.pause();
        } else {
            this.resume();
        }
    }
    
    /**
     * Start the animation
     */
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }
    
    /**
     * Pause the animation
     */
    pause() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    /**
     * Resume the animation
     */
    resume() {
        if (!this.isRunning && this.isVisible) {
            this.start();
        }
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(new Particle(this.canvas, this.config));
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
    }
    
    handleMouseLeave() {
        this.mouse.x = null;
        this.mouse.y = null;
    }
    
    connectParticles() {
        const len = this.particles.length;
        const maxDist = this.config.maxDistance;
        const maxDistSquared = maxDist * maxDist;
        
        for (let i = 0; i < len; i++) {
            for (let j = i + 1; j < len; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distanceSquared = dx * dx + dy * dy;
                
                // Use squared distance to avoid expensive sqrt
                if (distanceSquared < maxDistSquared) {
                    const distance = Math.sqrt(distanceSquared);
                    const opacity = (1 - (distance / maxDist)) * 0.2;
                    // Use RGBA directly for more robust color handling
                    this.ctx.strokeStyle = `rgba(99, 102, 241, ${opacity.toFixed(3)})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
    }
    
    animate() {
        if (!this.isRunning) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw particles
        const len = this.particles.length;
        for (let i = 0; i < len; i++) {
            this.particles[i].update(this.mouse);
            this.particles[i].draw(this.ctx, this.config);
        }
        
        // Connect nearby particles
        this.connectParticles();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    /**
     * Cleanup and destroy the particle system
     */
    destroy() {
        // Stop animation
        this.pause();
        
        // Remove event listeners
        window.removeEventListener('resize', this._boundResize);
        document.removeEventListener('visibilitychange', this._boundVisibilityChange);
        
        if (this.config.interactive && this.canvas) {
            this.canvas.removeEventListener('mousemove', this._boundMouseMove);
            this.canvas.removeEventListener('mouseleave', this._boundMouseLeave);
        }
        
        // Clear particles array
        this.particles = [];
        
        // Clear canvas
        if (this.canvas && this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        console.log('ParticleSystem destroyed');
    }
}

class Particle {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * config.speed;
        this.vy = (Math.random() - 0.5) * config.speed;
        this.size = config.particleSize + Math.random() * 2;
        this.baseSize = this.size;
    }
    
    update(mouse) {
        // Mouse interaction
        if (mouse.x !== null && mouse.y !== null) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                const angle = Math.atan2(dy, dx);
                this.vx += Math.cos(angle) * force * 0.5;
                this.vy += Math.sin(angle) * force * 0.5;
                this.size = this.baseSize * (1 + force * 2);
            } else {
                this.size = this.baseSize;
            }
        }
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Bounce off edges
        if (this.x < 0 || this.x > this.canvas.width) {
            this.vx = -this.vx;
            this.x = Math.max(0, Math.min(this.canvas.width, this.x));
        }
        if (this.y < 0 || this.y > this.canvas.height) {
            this.vy = -this.vy;
            this.y = Math.max(0, Math.min(this.canvas.height, this.y));
        }
        
        // Slow down
        this.vx *= 0.99;
        this.vy *= 0.99;
    }
    
    draw(ctx, config) {
        ctx.fillStyle = config.particleColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        if (config.glow) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = config.particleColor;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParticleSystem;
}
