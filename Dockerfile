# Stage 1: Build Frontend
FROM node:18-slim AS frontend-builder
WORKDIR /app/frontend

# Copy package files first for caching
COPY frontend/package*.json ./
RUN npm install

# Copy source code
COPY frontend/ .

# Reduce memory usage during build
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Build with standalone output
RUN npm run build

# Stage 2: Final Image
FROM python:3.10-slim

# Install system dependencies
# libgl1 is sufficient for headless blender usually
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    libxi6 \
    libfontconfig1 \
    libxrender1 \
    libgl1 \
    libsm6 \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18 (required to run the Next.js standalone server)
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
# Check if requirements.txt exists and install, otherwise skip or fail gracefully
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# Setup Frontend (Copy Standalone Output)
# The standalone build puts everything needed in .next/standalone
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Create startup script
# We run the standalone node server which is optimized for production
RUN echo '#!/bin/bash\n\
# Start Backend in background\n\
cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &\n\
# Start Frontend (Standalone)\n\
cd /app/frontend && node server.js\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 8000

# Run both
CMD ["/app/start.sh"]
