# MediaPipe ARKit AutoMesh

This application provides a web interface to automatically add ARKit-compatible blendshapes (morph targets) to a 3D face model (`.glb`). It utilizes **Blender** as a backend processing engine and adheres to the **MediaPipe Face Mesh** topology standard.

## Features
- **Drag-and-Drop Interface**: Easily upload your `.glb` face models.
- **Automated Processing**: A Blender backend script analyzes the mesh and injects 52 ARKit blendshapes.
  - *Note*: Currently adds empty shape keys with correct naming conventions. This prepares the mesh for rigging or transfer tools.
- **Dockerized**: Run the entire stack with a single command.

## Tech Stack
- **Frontend**: Next.js 14, Tailwind CSS, Lucide React
- **Backend**: FastAPI (Python), Blender 3.6+
- **Infrastructure**: Docker, Docker Compose

## Getting Started

### Prerequisites
- Docker & Docker Compose

### Running the Application

1. Clone the repository:
   ```bash
   git clone https://github.com/arturwyroslak/mediapipe-arkit-automesh.git
   cd mediapipe-arkit-automesh
   ```

2. Start the services:
   ```bash
   docker-compose up --build
   ```

3. Open your browser:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## How it Works
1. User uploads a GLB file via the frontend.
2. The file is sent to the FastAPI backend.
3. FastAPI triggers a headless Blender instance.
4. The Blender script (`backend/blender_script.py`):
   - Imports the GLB.
   - Checks for existing shape keys.
   - Adds missing shape keys based on the standard 52 ARKit names (e.g., `eyeBlinkLeft`, `jawOpen`).
   - Exports the modified mesh.
5. User downloads the processed GLB.

## Facial Rig Names
The application follows the standard ARKit naming convention found in `backend/core/facial_rig_names.py`:
- `eyeBlinkLeft`, `eyeLookDownLeft`, `eyeLookInLeft`, ...
- `jawOpen`, `mouthSmileLeft`, `tongueOut`, ...

## Future Improvements
- Implement automatic weight painting transfer from a template mesh.
- Integrate MediaPipe Python solution to detect landmarks on textures for better alignment.
- Add a 3D viewer in the frontend to preview blendshapes.
