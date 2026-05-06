# Multi-stage build for React app
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY client/package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY client/ ./
COPY server/ ./server/

# Build the React app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built React app to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy server files for API proxy
COPY --from=build /app/server /usr/share/nginx/server

# Install Node.js in nginx container for API server
RUN apk add --no-cache nodejs npm

# Install server dependencies
WORKDIR /usr/share/nginx/server
RUN npm install --omit=dev

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'cd /usr/share/nginx/server' >> /start.sh && \
    echo 'export PORT=3001' >> /start.sh && \
    echo 'export CLIENT_URL=http://localhost:8080' >> /start.sh && \
    echo 'export ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000' >> /start.sh && \
    echo 'export GCS_BUCKET=gen-media-demo-assets' >> /start.sh && \
    echo 'export ASSET_PUBLIC=public' >> /start.sh && \
    echo 'node src/index.js &' >> /start.sh && \
    echo 'sleep 3' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

# Expose port
EXPOSE 8080

# Start both nginx and API server
CMD ["/start.sh"]
