"use client";

import React, { Suspense, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Stage, OrbitControls, TransformControls, Html, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { GLTFExporter } from "three-stdlib";
import { Undo, Redo, RotateCcw, Save, FolderOpen, ChevronDown, ChevronRight, Box, Edit3, Eye, Sliders, AlertCircle } from "lucide-react";

// --- Constants & Grouping ---
const SHAPE_CATEGORIES: Record<string, string[]> = {
  "Brows": ["browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight"],
  "Eyes": [
    "eyeBlinkLeft", "eyeBlinkRight", "eyeLookDownLeft", "eyeLookDownRight", 
    "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight", 
    "eyeLookUpLeft", "eyeLookUpRight", "eyeSquintLeft", "eyeSquintRight", 
    "eyeWideLeft", "eyeWideRight"
  ],
  "Jaw": ["jawForward", "jawLeft", "jawRight", "jawOpen"],
  "Mouth": [
    "mouthClose", "mouthFunnel", "mouthPucker", "mouthRight", "mouthLeft", 
    "mouthSmileLeft", "mouthSmileRight", "mouthFrownRight", "mouthFrownLeft", 
    "mouthDimpleLeft", "mouthDimpleRight", "mouthStretchLeft", "mouthStretchRight", 
    "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper", 
    "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft", "mouthLowerDownRight", 
    "mouthUpperUpLeft", "mouthUpperUpRight"
  ],
  "Other": ["cheekPuff", "cheekSquintLeft", "cheekSquintRight", "noseSneerLeft", "noseSneerRight", "tongueOut"]
};

// --- Types ---
interface MeshEditorProps {
  url: string;
}

interface HistoryState {
  shapeName: string;
  vertexIndex: number;
  oldDelta: THREE.Vector3;
  newDelta: THREE.Vector3;
}

// --- Helper Components ---

function CategoryGroup({ title, shapes, influences, activeShape, onSelect, onChange }: any) {
  const [isOpen, setIsOpen] = useState(false); // Default closed for cleaner look
  
  if (shapes.length === 0) return null;

  return (
    <div className="mb-2 border border-gray-800 rounded-lg overflow-hidden bg-gray-900/30">
      <div 
        className="flex items-center gap-3 p-3 hover:bg-gray-800/50 cursor-pointer select-none transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <span className="text-sm font-semibold text-gray-200">{title}</span>
        <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded-full text-gray-400 ml-auto">{shapes.length}</span>
      </div>
      
      {isOpen && (
        <div className="bg-black/20 p-2 space-y-1">
          {shapes.map((name: string) => (
            <div 
              key={name}
              className={`p-2 rounded-md text-xs flex items-center gap-3 transition-all ${
                activeShape === name 
                  ? "bg-blue-900/30 border border-blue-500/30" 
                  : "hover:bg-gray-800 border border-transparent"
              }`}
            >
              <div 
                className="flex-1 cursor-pointer truncate"
                onClick={() => onSelect(name)}
                title={name}
              >
                <span className={`block truncate ${activeShape === name ? "text-blue-400 font-bold" : "text-gray-400"}`}>
                  {name}
                </span>
              </div>
              
              <div className="flex items-center gap-2 group/slider">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={influences[name] || 0}
                  onChange={(e) => onChange(name, parseFloat(e.target.value))}
                  className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                />
                <span className="w-8 text-right text-gray-500 font-mono text-[10px] group-hover/slider:text-white transition-colors">
                  {(influences[name] || 0).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main 3D Scene Component ---

function InteractiveModel({ 
  url, 
  influences, 
  showWireframe, 
  editMode, 
  activeShapeIndex, 
  onVertexChange,
  onMeshReady
}: {
  url: string;
  influences: Record<string, number>;
  showWireframe: boolean;
  editMode: boolean;
  activeShapeIndex: number | null;
  onVertexChange: (vertexIndex: number, oldDelta: THREE.Vector3, newDelta: THREE.Vector3) => void;
  onMeshReady: (mesh: THREE.Mesh, names: string[]) => void;
}) {
  const { scene } = useGLTF(url);
  const meshRef = useRef<THREE.Mesh>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [hovered, setHover] = useState(false);
  const dummyRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const initialDragPos = useRef<THREE.Vector3 | null>(null);
  
  useCursor(hovered && editMode);

  // Initialize
  useEffect(() => {
    let targetMesh: THREE.Mesh | null = null;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetDictionary) {
        targetMesh = child as THREE.Mesh;
      }
    });

    if (targetMesh) {
      const mesh = targetMesh as THREE.Mesh;
      meshRef.current = mesh;
      // Enable frustum culling to false to avoid flickering when bounds change
      mesh.frustumCulled = false;
      
      const names = Object.keys(mesh.morphTargetDictionary || {});
      onMeshReady(mesh, names);
    }
  }, [scene, url, onMeshReady]);

  // Apply Influences
  useFrame(() => {
    if (meshRef.current && meshRef.current.morphTargetDictionary && meshRef.current.morphTargetInfluences) {
      Object.entries(influences).forEach(([name, value]) => {
        const idx = meshRef.current!.morphTargetDictionary![name];
        if (idx !== undefined) {
          meshRef.current!.morphTargetInfluences![idx] = value;
        }
      });
    }
  });

  // Wireframe
  useEffect(() => {
    if (meshRef.current) {
       const mat = meshRef.current.material as THREE.MeshStandardMaterial;
       mat.wireframe = showWireframe;
       mat.needsUpdate = true;
    }
  }, [showWireframe]);

  // Raycast
  const handlePointerDown = (e: any) => {
    if (!editMode || !meshRef.current) return;
    if (e.object !== meshRef.current) return;
    
    e.stopPropagation();
    
    if (e.face) {
      const posAttribute = meshRef.current.geometry.attributes.position;
      const localPoint = meshRef.current.worldToLocal(e.point.clone());
      
      let minDist = Infinity;
      let closest = -1;
      
      [e.face.a, e.face.b, e.face.c].forEach((idx) => {
        const v = new THREE.Vector3().fromBufferAttribute(posAttribute, idx);
        const dist = v.distanceTo(localPoint);
        if (dist < minDist) {
          minDist = dist;
          closest = idx;
        }
      });
      
      setSelectedVertex(closest);
      
      const vPos = new THREE.Vector3().fromBufferAttribute(posAttribute, closest);
      
      if (activeShapeIndex !== null) {
         const morphAttr = meshRef.current.geometry.morphAttributes.position[activeShapeIndex];
         const currentDelta = new THREE.Vector3().fromBufferAttribute(morphAttr, closest);
         vPos.add(currentDelta);
      }

      dummyRef.current.position.copy(vPos);
      dummyRef.current.updateMatrix();
    }
  };

  const handleDragStart = () => {
    if (activeShapeIndex === null || selectedVertex === null || !meshRef.current) return;
    const morphAttr = meshRef.current.geometry.morphAttributes.position[activeShapeIndex];
    initialDragPos.current = new THREE.Vector3().fromBufferAttribute(morphAttr, selectedVertex);
  }

  const handleDragEnd = () => {
    if (activeShapeIndex === null || selectedVertex === null || !meshRef.current || !initialDragPos.current) return;
    
    const morphAttr = meshRef.current.geometry.morphAttributes.position[activeShapeIndex];
    const finalDelta = new THREE.Vector3().fromBufferAttribute(morphAttr, selectedVertex);
    
    // Check if changed
    if (!finalDelta.equals(initialDragPos.current)) {
      onVertexChange(selectedVertex, initialDragPos.current.clone(), finalDelta.clone());
    }
    initialDragPos.current = null;
  };

  const onTransformChange = () => {
    if (selectedVertex === null || !meshRef.current || activeShapeIndex === null) return;
    
    const mesh = meshRef.current;
    const geometry = mesh.geometry;
    const morphAttr = geometry.morphAttributes.position[activeShapeIndex];
    
    const visualPos = dummyRef.current.position.clone();
    const basePos = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, selectedVertex);
    
    const newDelta = new THREE.Vector3().subVectors(visualPos, basePos);
    
    morphAttr.setXYZ(selectedVertex, newDelta.x, newDelta.y, newDelta.z);
    morphAttr.needsUpdate = true;
  };

  return (
    <>
      <primitive 
        object={scene} 
        onPointerDown={handlePointerDown}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      />
      
      {editMode && selectedVertex !== null && activeShapeIndex !== null && (
        <>
          <mesh position={dummyRef.current.position} scale={0.002}>
             <sphereGeometry args={[1, 16, 16]} />
             <meshBasicMaterial color="#3b82f6" depthTest={false} transparent opacity={0.8} />
          </mesh>
          
          <TransformControls 
            object={dummyRef.current} 
            mode="translate"
            onChange={onTransformChange}
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            size={0.4}
            space="local"
          />
        </>
      )}
    </>
  );
}

// --- Main Editor Component ---

export default function MeshEditor({ url }: MeshEditorProps) {
  const [influences, setInfluences] = useState<Record<string, number>>({});
  const [shapeNames, setShapeNames] = useState<string[]>([]);
  const [showWireframe, setShowWireframe] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeShape, setActiveShape] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // History Stack
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  
  const meshRef = useRef<THREE.Mesh | null>(null);

  // Group shapes logic
  const groupedShapes = useMemo(() => {
    const groups: Record<string, string[]> = { ...SHAPE_CATEGORIES };
    const allCategorized = new Set(Object.values(SHAPE_CATEGORIES).flat());
    const others = shapeNames.filter(n => !allCategorized.has(n));
    if (others.length > 0) {
      groups["Other"] = [...(groups["Other"] || []), ...others];
    }
    const filtered: Record<string, string[]> = {};
    Object.entries(groups).forEach(([cat, list]) => {
      const present = list.filter(name => shapeNames.includes(name));
      if (present.length > 0) filtered[cat] = present;
    });
    return filtered;
  }, [shapeNames]);

  const activeShapeIndex = useMemo(() => {
    if (!activeShape || !meshRef.current?.morphTargetDictionary) return null;
    return meshRef.current.morphTargetDictionary[activeShape];
  }, [activeShape, meshRef.current]);

  const handleMeshReady = useCallback((mesh: THREE.Mesh, names: string[]) => {
    meshRef.current = mesh;
    setShapeNames(names);
    const newInfl: Record<string, number> = {};
    names.forEach((name, i) => {
       // @ts-ignore
       newInfl[name] = mesh.morphTargetInfluences[i] || 0;
    });
    setInfluences(newInfl);
    setLoading(false);
  }, []);

  const handleVertexChange = (vertexIndex: number, oldDelta: THREE.Vector3, newDelta: THREE.Vector3) => {
    if (!activeShape) return;
    setHistory(prev => [...prev, { shapeName: activeShape, vertexIndex, oldDelta, newDelta }]);
    setRedoStack([]); 
  };

  const handleUndo = () => {
    if (history.length === 0 || !meshRef.current) return;
    const action = history[history.length - 1];
    const shapeIndex = meshRef.current.morphTargetDictionary![action.shapeName];
    const morphAttr = meshRef.current.geometry.morphAttributes.position[shapeIndex];
    morphAttr.setXYZ(action.vertexIndex, action.oldDelta.x, action.oldDelta.y, action.oldDelta.z);
    morphAttr.needsUpdate = true;
    setRedoStack(prev => [...prev, action]);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !meshRef.current) return;
    const action = redoStack[redoStack.length - 1];
    const shapeIndex = meshRef.current.morphTargetDictionary![action.shapeName];
    const morphAttr = meshRef.current.geometry.morphAttributes.position[shapeIndex];
    morphAttr.setXYZ(action.vertexIndex, action.newDelta.x, action.newDelta.y, action.newDelta.z);
    morphAttr.needsUpdate = true;
    setHistory(prev => [...prev, action]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const handleExport = () => {
    if (!meshRef.current) return;
    const objectToExport = meshRef.current.parent || meshRef.current;
    const exporter = new GLTFExporter();
    exporter.parse(
        objectToExport,
        (result) => {
            if (result instanceof ArrayBuffer) {
                const blob = new Blob([result], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'arkit_ready_mesh.glb';
                link.click();
            }
        },
        (err) => console.error(err),
        { binary: true }
    );
  };

  return (
    <div className="flex w-full h-[80vh] bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl select-none relative group">
      
      {/* 3D Viewport */}
      <div className="flex-grow relative bg-gradient-to-b from-gray-900 via-gray-900 to-black">
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 40, position: [0, 0, 0.7] }}>
          <Suspense fallback={null}>
            <Stage environment="studio" intensity={0.5} adjustCamera={1.2}>
              <InteractiveModel 
                url={url} 
                influences={influences}
                showWireframe={showWireframe}
                editMode={editMode}
                activeShapeIndex={activeShapeIndex ?? null}
                onVertexChange={handleVertexChange}
                onMeshReady={handleMeshReady}
              />
            </Stage>
          </Suspense>
          <OrbitControls makeDefault minDistance={0.1} maxDistance={2} enablePan={true} />
        </Canvas>
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
             <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-blue-400">Loading Geometry...</span>
             </div>
          </div>
        )}

        {/* Top Toolbar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
           <div className="flex gap-2 pointer-events-auto bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
             <button 
               onClick={() => setShowWireframe(!showWireframe)}
               className={`p-2 rounded-lg transition-all ${showWireframe ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
               title="Toggle Wireframe"
             >
               <Box className="w-4 h-4" />
             </button>
             <div className="w-px h-6 bg-white/10 mx-1 my-auto" />
             <button 
               onClick={() => setEditMode(!editMode)}
               className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${editMode ? "bg-red-600 text-white shadow-lg shadow-red-500/20 animate-pulse-slow" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
               title="Toggle Vertex Sculpting Mode"
             >
               <Edit3 className="w-4 h-4" />
               <span className="text-xs font-bold tracking-wide">{editMode ? "SCULPTING" : "VIEW MODE"}</span>
             </button>
           </div>

           <div className="flex gap-2 pointer-events-auto bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
             <button 
               onClick={handleUndo}
               disabled={history.length === 0}
               className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
               title="Undo"
             >
               <Undo className="w-4 h-4" />
             </button>
             <button 
               onClick={handleRedo}
               disabled={redoStack.length === 0}
               className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
               title="Redo"
             >
               <Redo className="w-4 h-4" />
             </button>
             <div className="w-px h-6 bg-white/10 mx-1 my-auto" />
             <button 
               onClick={handleExport}
               className="py-2 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-green-900/20 transition-all active:scale-95"
             >
               <Save className="w-3 h-3" /> EXPORT GLB
             </button>
           </div>
        </div>
        
        {/* On-screen Helper */}
        {editMode && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md border border-red-500/30 px-6 py-3 rounded-full text-center shadow-2xl">
              {activeShape ? (
                 <div className="flex flex-col items-center">
                   <span className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-1">Active Shape</span>
                   <span className="text-white font-bold text-sm flex items-center gap-2">
                     {activeShape} <span className="text-gray-500 font-normal">({(influences[activeShape] || 0).toFixed(2)})</span>
                   </span>
                   <span className="text-[10px] text-gray-400 mt-1">Click vertex to edit • Drag gizmo to move</span>
                 </div>
              ) : (
                 <div className="flex items-center gap-3 text-yellow-500">
                   <AlertCircle className="w-5 h-5" />
                   <span className="text-xs font-bold">Select a blendshape from sidebar to start sculpting</span>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Controls */}
      <div className="w-[320px] bg-black border-l border-gray-800 flex flex-col h-full shrink-0 z-20 shadow-2xl">
        <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-500" />
              Shape Editor
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Adjust sliders to test expressions</p>
          </div>
          <button 
             onClick={() => setInfluences(prev => {
                const reset: Record<string, number> = {};
                Object.keys(prev).forEach(k => reset[k] = 0);
                return reset;
             })}
             className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors border border-transparent hover:border-gray-700"
             title="Reset all sliders to zero"
          >
             <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent space-y-1">
          {Object.keys(groupedShapes).length > 0 ? (
            Object.entries(groupedShapes).map(([category, shapes]) => (
              <CategoryGroup 
                key={category}
                title={category}
                shapes={shapes}
                influences={influences}
                activeShape={activeShape}
                onSelect={(name: string) => {
                   setActiveShape(name);
                   if (editMode && (influences[name] || 0) < 0.5) {
                     setInfluences(prev => ({...prev, [name]: 1}));
                   }
                }}
                onChange={(name: string, val: number) => setInfluences(prev => ({ ...prev, [name]: val }))}
              />
            ))
          ) : (
             <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-3 opacity-50">
                <Box className="w-10 h-10 stroke-1" />
                <span className="text-xs">No shapes detected</span>
             </div>
          )}
        </div>
        
        <div className="p-3 border-t border-gray-800 bg-gray-900/30 text-[10px] text-gray-500 text-center">
           {shapeNames.length} Blendshapes • {activeShape ? "1 Active" : "None Selected"}
        </div>
      </div>
    </div>
  );
}
