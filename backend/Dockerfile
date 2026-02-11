FROM python:3.10-slim

# Install system dependencies and Blender dependencies
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    libxi6 \
    libgconf-2-4 \
    libfontconfig1 \
    libxrender1 \
    libgl1-mesa-glx \
    libgl1-mesa-dev \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install Blender
ENV BLENDER_VERSION=3.6.5
ENV BLENDER_URL=https://download.blender.org/release/Blender3.6/blender-3.6.5-linux-x64.tar.xz

RUN wget -q ${BLENDER_URL} -O blender.tar.xz \
    && tar -xf blender.tar.xz -C /usr/local/ \
    && mv /usr/local/blender-${BLENDER_VERSION}-linux-x64 /usr/local/blender \
    && rm blender.tar.xz

# Add Blender to PATH
ENV PATH="/usr/local/blender:$PATH"

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
