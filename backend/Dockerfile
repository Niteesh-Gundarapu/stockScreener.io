# Backend Dockerfile
FROM node:20-bullseye-slim

WORKDIR /app/backend

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (use npm install to avoid lockfile mismatch in build)
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy application code
COPY . .

# Generate Prisma client
RUN npm run prisma:generate

# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "start"]
