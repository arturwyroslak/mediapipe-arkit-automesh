"use client";

import { useState } from "react";
import { Upload, FileUp, CheckCircle, Download, AlertCircle } from "lucide-react";
import axios from "axios";
import { useDropzone } from "react-dropzone";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus("idle");
      setErrorMessage(null);
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

      // Upload
      const uploadRes = await axios.post("http://localhost:8000/upload", formData);
      const { id } = uploadRes.data;
      setUploadId(id);

      // Process
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
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-950 text-white">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex mb-12">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-800 bg-gradient-to-b from-zinc-800 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-900 lg:p-4 lg:dark:bg-zinc-800/30">
          MediaPipe ARKit AutoMesh
        </p>
      </div>

      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragActive ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-600"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className={`w-12 h-12 mb-4 ${isDragActive ? "text-blue-500" : "text-gray-500"}`} />
          {file ? (
            <div className="text-center">
              <p className="font-semibold text-white">{file.name}</p>
              <p className="text-gray-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <p className="text-gray-400 text-center">Drag & drop a .glb file here, or click to select</p>
          )}
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4" />
            {errorMessage}
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={!file || status === "uploading" || status === "processing"}
          className={`mt-6 w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
            !file || status === "uploading" || status === "processing"
              ? "bg-gray-800 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
          }`}
        >
          {status === "uploading" && "Uploading..."}
          {status === "processing" && "Processing in Blender..."}
          {status === "completed" && "Processing Complete!"}
          {status === "idle" || status === "error" ? (
            <>
              <FileUp className="w-4 h-4" /> Generate Blendshapes
            </>
          ) : null}
        </button>

        {status === "completed" && downloadUrl && (
          <a
            href={downloadUrl}
            className="mt-4 block w-full py-3 px-4 rounded-lg font-bold text-center bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Download Processed Model
          </a>
        )}
      </div>

      <div className="mt-16 grid text-center text-gray-400 text-xs max-w-2xl">
        <p>
          Supported format: .glb (GLTF Binary). Ensure your mesh has a clean topology.
          The output will contain 52 empty ARKit blendshapes ready for rigging or simple deformation transfer if available.
        </p>
      </div>
    </main>
  );
}
