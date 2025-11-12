FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads backups logs

# Expose port (Render uses PORT env var, default 10000)
EXPOSE 10000

# Health check (uses PORT env var)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "const port = process.env.PORT || 10000; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]
