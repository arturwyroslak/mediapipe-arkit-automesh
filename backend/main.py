from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import subprocess
import uuid

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
PROCESSED_DIR = "processed"
BLENDER_PATH = os.getenv("BLENDER_PATH", "blender")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "backend"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith('.glb'):
        raise HTTPException(status_code=400, detail="Only .glb files are supported")
    
    unique_id = str(uuid.uuid4())
    input_filename = f"{unique_id}_{file.filename}"
    input_path = os.path.join(UPLOAD_DIR, input_filename)
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"id": unique_id, "filename": input_filename}

@app.post("/process/{file_id}")
async def process_file(file_id: str):
    files = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(file_id)]
    if not files:
        raise HTTPException(status_code=404, detail="File not found")
    
    input_filename = files[0]
    input_path = os.path.join(UPLOAD_DIR, input_filename)
    output_filename = f"processed_{input_filename}"
    output_path = os.path.join(PROCESSED_DIR, output_filename)
    
    try:
        script_path = os.path.join(os.path.dirname(__file__), "blender_script.py")
        
        cmd = [
            BLENDER_PATH,
            "-b",
            "-P", script_path,
            "--",
            input_path,
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Blender Error: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"Processing failed: {result.stderr}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"status": "success", "output_file": output_filename, "download_url": f"/download/{output_filename}"}

@app.get("/download/{filename}")
async def download_file(filename: str):
    path = os.path.join(PROCESSED_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
