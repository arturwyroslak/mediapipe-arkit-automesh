# Stage 1: Build Frontend
FROM node:18-slim AS frontend-builder
WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./
COPY frontend/tsconfig.json ./ 
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
# Added libxfixes3, libxkbcommon0, libxcursor1, libxinerama1, libxi6 which are common Blender requirements
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    libxi6 \
    libfontconfig1 \
    libxrender1 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxcursor1 \
    libxinerama1 \
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

# Setup Frontend (Copy Standalone Output)
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Function to handle shutdown\n\
cleanup() {\n\
  echo "[SHUTDOWN] Stopping services..."\n\
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true\n\
  exit 0\n\
}\n\
\n\
trap cleanup SIGTERM SIGINT\n\
\n\
# Start Backend in background\n\
echo "[STARTUP] Starting backend on port 8000..."\n\
cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &\n\
BACKEND_PID=$!\n\
echo "[STARTUP] Backend PID: $BACKEND_PID"\n\
\n\
# Determine frontend port (Render sets PORT env var)\n\
PORT="${PORT:-10000}"\n\
echo "[STARTUP] Starting frontend on port $PORT with hostname 0.0.0.0..."\n\
\n\
# Start Frontend in background with explicit hostname\n\
cd /app/frontend && HOSTNAME=0.0.0.0 PORT=$PORT node server.js &\n\
FRONTEND_PID=$!\n\
echo "[STARTUP] Frontend PID: $FRONTEND_PID"\n\
\n\
echo "[STARTUP] Both services started. Waiting for processes..."\n\
\n\
# Wait for both processes\n\
wait $FRONTEND_PID $BACKEND_PID\n\
' > /app/start.sh && chmod +x /app/start.sh

# Run startup script
CMD ["/app/start.sh"]
