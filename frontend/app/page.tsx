"use client";

import { useState } from "react";
import { Upload, FileUp, CheckCircle, Download, AlertCircle, Eye, Settings2 } from "lucide-react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import dynamic from "next/dynamic";

const MeshEditor = dynamic(() => import("@/components/Editor/MeshEditor"), { ssr: false });

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus("idle");
      setErrorMessage(null);
      setDownloadUrl(null);
      setShowEditor(false);
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

      const uploadRes = await axios.post("/api/upload", formData);
      const { id } = uploadRes.data;
      setUploadId(id);

      setStatus("processing");
      const processRes = await axios.post(`/api/process/${id}`);
      
      const rawUrl = processRes.data.download_url; 
      // Add timestamp to force fresh load in 3D viewer
      setDownloadUrl(`/api${rawUrl}?t=${Date.now()}`);
      setStatus("completed");
      setShowEditor(true);

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.response?.data?.detail || err.message || "An unexpected error occurred");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 lg:p-24 bg-gray-950 text-white selection:bg-blue-500/30">
      <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-800 bg-gradient-to-b from-zinc-800 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-900 lg:p-4 lg:dark:bg-zinc-800/30">
          MediaPipe ARKit AutoMesh <span className="ml-2 text-blue-400">v2.0</span>
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

      {/* Main Content Area */}
      <div className={`w-full max-w-7xl transition-all duration-500 ${showEditor ? "grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8" : "flex flex-col items-center"}`}>
        
        {/* Upload Column */}
        <div className={`w-full ${showEditor ? "" : "max-w-2xl"} flex flex-col gap-6`}>
           <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl">
              <h2 className="text-lg font-bold mb-4 text-gray-300">Input Source</h2>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  isDragActive ? "border-blue-500 bg-blue-500/10 scale-[1.02]" : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className={`w-10 h-10 mb-3 transition-colors ${isDragActive ? "text-blue-500" : "text-gray-500"}`} />
                {file ? (
                  <div className="text-center animate-in fade-in zoom-in duration-300">
                    <p className="font-semibold text-white truncate max-w-[200px]">{file.name}</p>
                    <p className="text-gray-400 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center text-sm">Drag & drop .glb file</p>
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
                className={`mt-4 w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                  !file || status === "uploading" || status === "processing"
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
                }`}
              >
                {status === "uploading" && "Uploading..."}
                {status === "processing" && "Processing..."}
                {status === "completed" && "Re-Process"}
                {status === "idle" || status === "error" ? "Generate Blendshapes" : null}
              </button>
           </div>
           
           {status === "processing" && !showEditor && (
             <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center text-center animate-in fade-in">
               <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
               <h3 className="text-lg font-bold mb-1">Analyzing Mesh</h3>
               <p className="text-gray-400 text-xs">Injecting 52 ARKit blendshapes...</p>
             </div>
           )}
        </div>

        {/* Editor Column */}
        {showEditor && downloadUrl && (
          <div className="w-full flex flex-col gap-4 animate-in slide-in-from-right-8 fade-in duration-500">
             <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-blue-500" /> 
                  Advanced Editor
                </h2>
                <div className="flex gap-2">
                   <a
                    href={downloadUrl}
                    download
                    className="py-2 px-4 rounded-lg text-sm font-bold bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download Original
                  </a>
                </div>
             </div>
             
             {/* The Editor */}
             <MeshEditor url={downloadUrl} />
             
             <p className="text-xs text-gray-500 mt-2 text-center">
               Tip: Enter "Edit Vertex Mode", select a blendshape from the list, then click & drag vertices on the mesh to sculpt that expression. 
               Export when done.
             </p>
          </div>
        )}
        
      </div>
    </main>
  );
}
