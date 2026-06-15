# Multi-stage build for React app
FROM node:18-alpine AS build

# Firebase config — baked in at build time (these are public client-side values)
ARG REACT_APP_FIREBASE_API_KEY
ARG REACT_APP_FIREBASE_AUTH_DOMAIN
ARG REACT_APP_FIREBASE_PROJECT_ID
ARG REACT_APP_FIREBASE_STORAGE_BUCKET
ARG REACT_APP_FIREBASE_MESSAGING_SENDER_ID
ARG REACT_APP_FIREBASE_APP_ID
ARG REACT_APP_FIREBASE_MEASUREMENT_ID

ENV REACT_APP_FIREBASE_API_KEY=$REACT_APP_FIREBASE_API_KEY
ENV REACT_APP_FIREBASE_AUTH_DOMAIN=$REACT_APP_FIREBASE_AUTH_DOMAIN
ENV REACT_APP_FIREBASE_PROJECT_ID=$REACT_APP_FIREBASE_PROJECT_ID
ENV REACT_APP_FIREBASE_STORAGE_BUCKET=$REACT_APP_FIREBASE_STORAGE_BUCKET
ENV REACT_APP_FIREBASE_MESSAGING_SENDER_ID=$REACT_APP_FIREBASE_MESSAGING_SENDER_ID
ENV REACT_APP_FIREBASE_APP_ID=$REACT_APP_FIREBASE_APP_ID
ENV REACT_APP_FIREBASE_MEASUREMENT_ID=$REACT_APP_FIREBASE_MEASUREMENT_ID

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
    echo 'export ASSET_PUBLIC=public' >> /start.sh && \
    echo 'node src/index.js &' >> /start.sh && \
    echo 'sleep 3' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

# Expose port
EXPOSE 8080

# Start both nginx and API server
CMD ["/start.sh"]
