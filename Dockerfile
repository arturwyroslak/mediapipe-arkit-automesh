# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
# Set API URL to localhost for static build or handle proxy in next config
# For a single container, we'll serve frontend static export or run next start
# Here we build for production
RUN npm run build

# Stage 2: Final Image (Python + Node + Blender)
FROM python:3.10-slim

# Install system dependencies including Node.js and Blender deps
# libgl1-mesa-glx is replaced by libgl1 in newer Debian
# libgconf-2-4 is deprecated and often not needed for headless blender or has alternatives
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    libxi6 \
    libfontconfig1 \
    libxrender1 \
    libgl1 \
    libgl1-mesa-dev \
    libsm6 \
    libxext6 \
    libxfixes3 \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs

# Install Blender
ENV BLENDER_VERSION=3.6.5
ENV BLENDER_URL=https://download.blender.org/release/Blender3.6/blender-3.6.5-linux-x64.tar.xz

RUN wget -q ${BLENDER_URL} -O blender.tar.xz \
    && tar -xf blender.tar.xz -C /usr/local/ \
    && mv /usr/local/blender-${BLENDER_VERSION}-linux-x64 /usr/local/blender \
    && rm blender.tar.xz

ENV PATH="/usr/local/blender:$PATH"

# Setup Workspace
WORKDIR /app

# Setup Backend
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# Setup Frontend (Copy built artifacts and node_modules)
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json ./frontend/package.json
# Copy config files if needed
COPY --from=frontend-builder /app/frontend/next.config.js ./frontend/next.config.js 

# Create startup script
RUN echo '#!/bin/bash\n\
# Start Backend in background\n\
cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &\n\
# Start Frontend\n\
cd /app/frontend && npm start -- -p 3000\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 8000

# Run both
CMD ["/app/start.sh"]
