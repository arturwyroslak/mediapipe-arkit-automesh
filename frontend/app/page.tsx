"use client";

import { useState } from "react";
import { Upload, FileUp, CheckCircle, Download, AlertCircle, Eye } from "lucide-react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import dynamic from "next/dynamic";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), { ssr: false });

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus("idle");
      setErrorMessage(null);
      setDownloadUrl(null);
      setShowPreview(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/gltf-binary': ['.glb']
    },
    maxFiles: 1
  });

  const handleProcess = async () => {
    if (!file) return;

    try {
      setStatus("uploading");
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await axios.post("http://localhost:8000/upload", formData);
      const { id } = uploadRes.data;
      setUploadId(id);

      setStatus("processing");
      const processRes = await axios.post(`http://localhost:8000/process/${id}`);
      
      setDownloadUrl(`http://localhost:8000${processRes.data.download_url}`);
      setStatus("completed");

    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.response?.data?.detail || err.message || "An unexpected error occurred");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-950 text-white selection:bg-blue-500/30">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-12">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-800 bg-gradient-to-b from-zinc-800 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-900 lg:p-4 lg:dark:bg-zinc-800/30">
          MediaPipe ARKit AutoMesh <span className="ml-2 text-blue-400">v1.0</span>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-black via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0 font-bold"
            href="https://github.com/arturwyroslak/mediapipe-arkit-automesh"
            target="_blank"
            rel="noopener noreferrer"
          >
            By SUPERAI
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* Upload Section */}
        <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl h-fit">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
              isDragActive ? "border-blue-500 bg-blue-500/10 scale-[1.02]" : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className={`w-12 h-12 mb-4 transition-colors ${isDragActive ? "text-blue-500" : "text-gray-500"}`} />
            {file ? (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <p className="font-semibold text-white text-lg">{file.name}</p>
                <p className="text-gray-400 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <p className="text-gray-400 text-center">Drag & drop a .glb file here,<br/>or click to select</p>
            )}
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg flex items-center gap-2 text-red-400 text-xs animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={!file || status === "uploading" || status === "processing"}
            className={`mt-6 w-full py-4 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
              !file || status === "uploading" || status === "processing"
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 hover:-translate-y-0.5"
            }`}
          >
            {status === "uploading" && <span className="animate-pulse">Uploading...</span>}
            {status === "processing" && <span className="animate-pulse">Processing in Blender...</span>}
            {status === "completed" && "Processing Complete!"}
            {status === "idle" || status === "error" ? (
              <>
                <FileUp className="w-5 h-5" /> Generate Blendshapes
              </>
            ) : null}
          </button>
        </div>

        {/* Results Section */}
        <div className="flex flex-col gap-4">
          {/* Status Cards */}
          {status === "processing" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px] animate-in fade-in">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <h3 className="text-xl font-bold mb-2">Analyzing Mesh Geometry</h3>
              <p className="text-gray-400 text-sm">Injecting 52 ARKit blendshapes via Blender backend...</p>
            </div>
          )}

          {status === "completed" && downloadUrl && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3 mb-6 text-green-400">
                <CheckCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">Success!</h3>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" /> {showPreview ? "Hide 3D Preview" : "Show 3D Preview"}
                </button>

                <a
                  href={downloadUrl}
                  download
                  className="block w-full py-3 px-4 rounded-lg font-bold text-center bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 hover:shadow-green-900/40 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Result
                </a>
              </div>
            </div>
          )}

          {/* 3D Viewer */}
          {showPreview && downloadUrl && (
            <div className="animate-in fade-in zoom-in duration-300">
              <ModelViewer url={downloadUrl} />
            </div>
          )}
          
          {/* Instructions / Placeholder when idle */}
          {status === "idle" && !file && (
             <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-8 h-full flex items-center justify-center text-gray-500 text-sm text-center">
               <p>Upload a model to see the processing pipeline in action.</p>
             </div>
          )}
        </div>
      </div>
    </main>
  );
}
