"use client";

import React, { Suspense, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, Stage, OrbitControls, TransformControls, Html, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { GLTFExporter } from "three-stdlib";
import { Undo, Redo, RotateCcw, Save, FolderOpen, Folder, ChevronDown, ChevronRight, Box } from "lucide-react";

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
  const [isOpen, setIsOpen] = useState(true);
  
  if (shapes.length === 0) return null;

  return (
    <div className="mb-2">
      <div 
        className="flex items-center gap-2 p-2 bg-gray-900/80 hover:bg-gray-800 cursor-pointer rounded select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{title}</span>
        <span className="text-[10px] text-gray-600 ml-auto">{shapes.length}</span>
      </div>
      
      {isOpen && (
        <div className="pl-2 mt-1 space-y-1">
          {shapes.map((name: string) => (
            <div 
              key={name}
              className={`p-2 rounded text-xs flex items-center justify-between group transition-all ${
                activeShape === name 
                  ? "bg-blue-600/20 border border-blue-500/50" 
                  : "hover:bg-gray-800 border border-transparent"
              }`}
            >
              <div 
                className="flex-1 cursor-pointer truncate mr-2"
                onClick={() => onSelect(name)}
                title={name}
              >
                <span className={activeShape === name ? "text-blue-400 font-bold" : "text-gray-400 group-hover:text-gray-200"}>
                  {name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={influences[name] || 0}
                  onChange={(e) => onChange(name, parseFloat(e.target.value))}
                  className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="w-6 text-right text-gray-500 font-mono text-[10px]">
                  {(influences[name] || 0).toFixed(1)}
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
      
      // Calculate where the dummy should be visually
      // Base Pos + Current Total Morph Offset
      // Ideally we want the dummy to be at the VISUAL position of the vertex
      
      // For simplicity in this editor, we position dummy at Base Pos + Active Morph Delta (if any)
      // This is an approximation. A robust editor would calculate full morph stack.
      
      const vPos = new THREE.Vector3().fromBufferAttribute(posAttribute, closest);
      
      // If we have an active shape, add its current delta to start pos
      if (activeShapeIndex !== null) {
         const morphAttr = meshRef.current.geometry.morphAttributes.position[activeShapeIndex];
         const currentDelta = new THREE.Vector3().fromBufferAttribute(morphAttr, closest);
         // We visualize the vertex at "Base + Delta" (as if influence is 1)
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
    
    // Calculate Delta: Visual Pos - Base Pos
    // We assume the user is manipulating the vertex as it looks when Influence = 1.0
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
            size={0.5}
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
  
  // History Stack
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  
  const meshRef = useRef<THREE.Mesh | null>(null);

  // Group shapes logic
  const groupedShapes = useMemo(() => {
    const groups: Record<string, string[]> = { ...SHAPE_CATEGORIES };
    // Find shapes not in categories
    const allCategorized = new Set(Object.values(SHAPE_CATEGORIES).flat());
    const others = shapeNames.filter(n => !allCategorized.has(n));
    if (others.length > 0) {
      // Merge with existing "Other" or create
      groups["Other"] = [...(groups["Other"] || []), ...others];
    }
    // Filter out categories that have no matching shapes in this model
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
  }, []);

  const handleVertexChange = (vertexIndex: number, oldDelta: THREE.Vector3, newDelta: THREE.Vector3) => {
    if (!activeShape) return;
    setHistory(prev => [...prev, { shapeName: activeShape, vertexIndex, oldDelta, newDelta }]);
    setRedoStack([]); // Clear redo on new action
  };

  const handleUndo = () => {
    if (history.length === 0 || !meshRef.current) return;
    const action = history[history.length - 1];
    
    // Revert
    const shapeIndex = meshRef.current.morphTargetDictionary![action.shapeName];
    const morphAttr = meshRef.current.geometry.morphAttributes.position[shapeIndex];
    morphAttr.setXYZ(action.vertexIndex, action.oldDelta.x, action.oldDelta.y, action.oldDelta.z);
    morphAttr.needsUpdate = true;
    
    // Update stacks
    setRedoStack(prev => [...prev, action]);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !meshRef.current) return;
    const action = redoStack[redoStack.length - 1];
    
    // Apply
    const shapeIndex = meshRef.current.morphTargetDictionary![action.shapeName];
    const morphAttr = meshRef.current.geometry.morphAttributes.position[shapeIndex];
    morphAttr.setXYZ(action.vertexIndex, action.newDelta.x, action.newDelta.y, action.newDelta.z);
    morphAttr.needsUpdate = true;
    
    // Update stacks
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
    <div className="flex w-full h-[700px] bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl select-none">
      {/* 3D Viewport */}
      <div className="flex-grow relative bg-gradient-to-b from-gray-900 to-black">
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, position: [0, 0, 0.6] }}>
          <Suspense fallback={<Html center><div className="text-blue-500 animate-pulse">Loading Model...</div></Html>}>
            <Stage environment="city" intensity={0.7} adjustCamera={1.2}>
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
          <OrbitControls makeDefault minDistance={0.1} maxDistance={2} />
        </Canvas>
        
        {/* Toolbar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
           <div className="flex gap-2 pointer-events-auto">
             <button 
               onClick={() => setShowWireframe(!showWireframe)}
               className={`p-2 rounded-lg backdrop-blur-md border transition-all ${showWireframe ? "bg-blue-600/80 border-blue-500 text-white" : "bg-black/50 border-gray-700 text-gray-400 hover:text-white"}`}
               title="Toggle Wireframe"
             >
               <Box className="w-4 h-4" />
             </button>
             
             <button 
               onClick={() => setEditMode(!editMode)}
               className={`p-2 rounded-lg backdrop-blur-md border transition-all ${editMode ? "bg-red-600/80 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-black/50 border-gray-700 text-gray-400 hover:text-white"}`}
               title="Toggle Vertex Edit Mode"
             >
               <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${editMode ? "bg-white animate-pulse" : "bg-gray-500"}`} />
                  <span className="text-xs font-bold">{editMode ? "EDITING" : "VIEW"}</span>
               </div>
             </button>
           </div>

           <div className="flex gap-2 pointer-events-auto">
             <button 
               onClick={handleUndo}
               disabled={history.length === 0}
               className="p-2 rounded-lg bg-black/50 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-md"
               title="Undo"
             >
               <Undo className="w-4 h-4" />
             </button>
             <button 
               onClick={handleRedo}
               disabled={redoStack.length === 0}
               className="p-2 rounded-lg bg-black/50 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-md"
               title="Redo"
             >
               <Redo className="w-4 h-4" />
             </button>
             <div className="w-px h-8 bg-gray-700 mx-1"></div>
             <button 
               onClick={handleExport}
               className="py-2 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-green-900/20"
             >
               <Save className="w-3 h-3" /> EXPORT
             </button>
           </div>
        </div>
        
        {editMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur border border-gray-800 p-4 rounded-xl text-xs text-gray-300 pointer-events-none min-w-[300px] text-center">
            {activeShape ? (
               <>
                 Editing Shape: <span className="text-blue-400 font-bold text-sm block mt-1">{activeShape}</span>
                 <p className="mt-2 text-gray-500">Click & Drag vertices to sculpt delta</p>
               </>
            ) : (
               <span className="text-yellow-500 flex items-center justify-center gap-2">
                 <AlertCircle className="w-4 h-4" /> Select a shape from the sidebar to start editing
               </span>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Controls */}
      <div className="w-80 bg-gray-950 border-l border-gray-800 flex flex-col h-full">
        <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-500" />
              Blendshapes
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{shapeNames.length} keys found</p>
          </div>
          <button 
             onClick={() => setInfluences(prev => {
                const reset: Record<string, number> = {};
                Object.keys(prev).forEach(k => reset[k] = 0);
                return reset;
             })}
             className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
             title="Reset all sliders"
          >
             <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent space-y-1">
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
                   if (editMode) {
                     // Auto-set influence to 1 for easier visual editing
                     setInfluences(prev => ({...prev, [name]: 1}));
                   }
                }}
                onChange={(name: string, val: number) => setInfluences(prev => ({ ...prev, [name]: val }))}
              />
            ))
          ) : (
             <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
                <Box className="w-8 h-8 opacity-20" />
                <span className="text-xs">No blendshapes detected</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
