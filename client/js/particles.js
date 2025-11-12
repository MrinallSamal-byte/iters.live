/**
 * Advanced Particle System for ITER College Management System
 * Creates dynamic, interactive particle backgrounds
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
        
        // Configuration
        this.config = {
            particleCount: options.particleCount || 80,
            particleColor: options.particleColor || 'rgba(99, 102, 241, 0.5)',
            lineColor: options.lineColor || 'rgba(99, 102, 241, 0.2)',
            particleSize: options.particleSize || 2,
            maxDistance: options.maxDistance || 120,
            speed: options.speed || 0.5,
            interactive: options.interactive !== false,
            glow: options.glow !== false
        };
        
        this.init();
    }
    
    init() {
        // Set canvas size
        this.resize();
        
        // Create particles
        this.createParticles();
        
        // Event listeners
        window.addEventListener('resize', () => this.resize());
        
        if (this.config.interactive) {
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        }
        
        // Start animation
        this.animate();
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
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.config.maxDistance) {
                    const opacity = 1 - (distance / this.config.maxDistance);
                    this.ctx.strokeStyle = this.config.lineColor.replace('0.2', opacity * 0.2);
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw particles
        this.particles.forEach(particle => {
            particle.update(this.mouse);
            particle.draw(this.ctx, this.config);
        });
        
        // Connect nearby particles
        this.connectParticles();
        
        requestAnimationFrame(() => this.animate());
    }
    
    destroy() {
        this.particles = [];
        if (this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
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
