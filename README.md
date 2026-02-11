# MediaPipe ARKit AutoMesh

This application provides a web interface to automatically add ARKit-compatible blendshapes (morph targets) to a 3D face model (`.glb`). It utilizes **Blender** as a backend processing engine and adheres to the **MediaPipe Face Mesh** topology standard.

## Features
- **Drag-and-Drop Interface**: Easily upload your `.glb` face models.
- **Automated Processing**: A Blender backend script analyzes the mesh and injects 52 ARKit blendshapes.
- **3D Preview & Editor**: Interactive editor to visualize and fine-tune blendshapes in real-time.
- **Unified Docker Image**: Run both frontend and backend in a single container.

## Tech Stack
- **Frontend**: Next.js 14, Tailwind CSS, Lucide React, React Three Fiber
- **Backend**: FastAPI (Python), Blender 3.6+
- **Infrastructure**: Docker

## Getting Started

### Option 1: Docker Compose (Development)
This method runs frontend and backend as separate services, ideal for development.

```bash
make run
# OR
docker-compose up
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

### Option 2: Single Container (Production / Simplified)
This method builds a single image containing both the Next.js frontend and Python/Blender backend.

1. **Build the image**:
   ```bash
   docker build -t mediapipe-app .
   ```

2. **Run the container**:
   ```bash
   docker run -p 3000:3000 -p 8000:8000 mediapipe-app
   ```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

## How it Works
1. User uploads a GLB file via the frontend.
2. The file is sent to the FastAPI backend.
3. FastAPI triggers a headless Blender instance.
4. The Blender script (`backend/blender_script.py`) injects 52 ARKit blendshapes.
5. User can preview and edit these shapes in the browser using the "Advanced Editor".
6. Finally, the user exports the ready-to-rig model.

## Facial Rig Names
The application follows the standard ARKit naming convention found in `backend/core/facial_rig_names.py`:
- `eyeBlinkLeft`, `jawOpen`, `mouthSmileLeft`, etc.
