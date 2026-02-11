"use client";

import React, { Suspense, useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, Stage, OrbitControls, TransformControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { GLTFExporter } from "three-stdlib";

// --- Types ---
interface MeshEditorProps {
  url: string;
}

interface ShapeControlProps {
  name: string;
  value: number;
  onChange: (val: number) => void;
  isActive: boolean;
  onSelect: () => void;
}

// --- Helper Components ---

function ShapeControl({ name, value, onChange, isActive, onSelect }: ShapeControlProps) {
  return (
    <div className={`p-2 rounded mb-1 text-xs flex items-center justify-between group ${isActive ? "bg-blue-900/40 border border-blue-800" : "hover:bg-gray-800"}`}>
      <div 
        className="flex-1 cursor-pointer truncate mr-2 font-mono"
        onClick={onSelect}
        title={name}
      >
        <span className={isActive ? "text-blue-400 font-bold" : "text-gray-300"}>
          {name}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <span className="w-8 text-right text-gray-500 ml-2">{value.toFixed(2)}</span>
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
  setInfluences,
  setShapeNames,
  onMeshReady
}: {
  url: string;
  influences: Record<string, number>;
  showWireframe: boolean;
  editMode: boolean;
  activeShapeIndex: number | null;
  setInfluences: (inf: Record<string, number>) => void;
  setShapeNames: (names: string[]) => void;
  onMeshReady: (mesh: THREE.Mesh) => void;
}) {
  const { scene } = useGLTF(url);
  const meshRef = useRef<THREE.Mesh>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const dummyRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const { camera, gl } = useThree();
  
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
      onMeshReady(mesh);
      
      // Populate names if first load
      if (mesh.morphTargetDictionary) {
        const names = Object.keys(mesh.morphTargetDictionary);
        setShapeNames(names);
        
        // Init influences
        const newInfluences: Record<string, number> = {};
        names.forEach((name, i) => {
           // @ts-ignore
           newInfluences[name] = mesh.morphTargetInfluences[i] || 0;
        });
        setInfluences(newInfluences);
      }
    }
  }, [scene, url, setShapeNames, setInfluences, onMeshReady]);

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

  // Wireframe logic
  useEffect(() => {
    if (meshRef.current) {
       // We can just add/remove a wireframe child or modify material
       // Simple approach: modify material wireframe prop. 
       // NOTE: This affects all instances sharing material. Clone if needed.
       const mat = meshRef.current.material as THREE.MeshStandardMaterial;
       mat.wireframe = showWireframe;
       mat.needsUpdate = true;
    }
  }, [showWireframe]);

  // Raycast for vertex selection
  const handlePointerDown = (e: any) => {
    if (!editMode || !meshRef.current) return;
    
    // Only select if we clicked the mesh
    if (e.object !== meshRef.current) return;
    
    // Find closest vertex index
    // e.face.a, e.face.b, e.face.c are indices
    if (e.face) {
      // Simple heuristic: closest of the 3 face vertices to the intersection point
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
      
      // Position the dummy at this vertex
      const vPos = new THREE.Vector3().fromBufferAttribute(posAttribute, closest);
      dummyRef.current.position.copy(vPos);
      dummyRef.current.updateMatrix();
    }
  };

  // Handle Vertex Move
  const onTransformChange = () => {
    if (selectedVertex === null || !meshRef.current || activeShapeIndex === null) return;
    
    const mesh = meshRef.current;
    const geometry = mesh.geometry;
    const morphAttr = geometry.morphAttributes.position; // Array of BufferAttributes
    
    if (!morphAttr || !morphAttr[activeShapeIndex]) return;
    
    const targetAttribute = morphAttr[activeShapeIndex];
    
    // Calculate Delta
    // Current Position of dummy (Modified Vertex Pos)
    const newPos = dummyRef.current.position.clone();
    
    // Base Position
    const basePos = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, selectedVertex);
    
    // The morph target stores DELTAS (Offset from base).
    // So Delta = NewPos - BasePos
    // HOWEVER, if other morphs are active, the visual position is complex.
    // Simplifying assumption: We are editing the shape such that when it is at 1.0, the vertex is at NewPos.
    // So Delta = NewPos - BasePos.
    
    const delta = new THREE.Vector3().subVectors(newPos, basePos);
    
    targetAttribute.setXYZ(selectedVertex, delta.x, delta.y, delta.z);
    targetAttribute.needsUpdate = true;
    
    // Need to update normals etc? For now just positions.
  };

  return (
    <>
      <primitive 
        object={scene} 
        onPointerDown={handlePointerDown}
      />
      
      {/* Visual helper for selected vertex */}
      {editMode && selectedVertex !== null && (
        <>
          <mesh position={dummyRef.current.position}>
             <sphereGeometry args={[0.005, 8, 8]} />
             <meshBasicMaterial color="red" depthTest={false} />
          </mesh>
          
          <TransformControls 
            object={dummyRef.current} 
            mode="translate"
            onChange={onTransformChange}
          />
        </>
      )}
    </>
  );
}

// --- Main Export Component ---

export default function MeshEditor({ url }: MeshEditorProps) {
  const [influences, setInfluences] = useState<Record<string, number>>({});
  const [shapeNames, setShapeNames] = useState<string[]>([]);
  const [showWireframe, setShowWireframe] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeShape, setActiveShape] = useState<string | null>(null);
  
  // We keep a reference to the mesh to export it
  const meshRef = useRef<THREE.Mesh | null>(null);

  const handleExport = () => {
    if (!meshRef.current) return;
    
    // We need to export the whole scene ideally, but for now just the mesh is fine or the scene.
    // Let's use the parent scene of the mesh usually.
    const objectToExport = meshRef.current.parent || meshRef.current;
    
    const exporter = new GLTFExporter();
    exporter.parse(
      objectToExport,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: "text/plain" });
        // For binary .glb, parse options binary: true
        // But for simplicity text is fine, or:
      },
      (error) => {
        console.error("An error happened during export:", error);
      },
      { binary: true } // binary export
    );
    
    // Re-run with binary to actually download
    exporter.parse(
        objectToExport,
        (result) => {
            if (result instanceof ArrayBuffer) {
                const blob = new Blob([result], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'modified_mesh.glb';
                link.click();
            }
        },
        (err) => console.error(err),
        { binary: true }
    );
  };

  const activeShapeIndex = useMemo(() => {
    if (!activeShape || !meshRef.current?.morphTargetDictionary) return null;
    return meshRef.current.morphTargetDictionary[activeShape];
  }, [activeShape, meshRef.current]);

  return (
    <div className="flex w-full h-[600px] bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
      {/* 3D Viewport */}
      <div className="flex-grow relative">
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, position: [0, 0, 0.5] }}>
          <Suspense fallback={<Html center>Loading...</Html>}>
            <Stage environment="city" intensity={0.6}>
              <InteractiveModel 
                url={url} 
                influences={influences}
                showWireframe={showWireframe}
                editMode={editMode}
                activeShapeIndex={activeShapeIndex ?? null}
                setInfluences={setInfluences}
                setShapeNames={setShapeNames}
                onMeshReady={(m) => { meshRef.current = m; }}
              />
            </Stage>
          </Suspense>
          <OrbitControls makeDefault />
        </Canvas>
        
        {/* Overlay Controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
           <button 
             onClick={() => setShowWireframe(!showWireframe)}
             className={`px-3 py-1.5 rounded text-xs font-bold backdrop-blur-md border transition-colors ${showWireframe ? "bg-blue-600/80 border-blue-500 text-white" : "bg-black/50 border-gray-700 text-gray-300 hover:bg-black/70"}`}
           >
             {showWireframe ? "Hide Wireframe" : "Show Wireframe"}
           </button>
           
           <button 
             onClick={() => setEditMode(!editMode)}
             className={`px-3 py-1.5 rounded text-xs font-bold backdrop-blur-md border transition-colors ${editMode ? "bg-red-600/80 border-red-500 text-white" : "bg-black/50 border-gray-700 text-gray-300 hover:bg-black/70"}`}
           >
             {editMode ? "Exit Edit Mode" : "Edit Vertex Mode"}
           </button>
           
           <button 
             onClick={handleExport}
             className="px-3 py-1.5 rounded text-xs font-bold backdrop-blur-md border bg-green-600/80 border-green-500 text-white hover:bg-green-500/80"
           >
             Export Modified GLB
           </button>
        </div>
        
        {editMode && (
          <div className="absolute bottom-4 left-4 bg-black/80 p-3 rounded text-xs text-gray-300 max-w-xs border border-gray-800">
            <p className="font-bold text-white mb-1">Editing: {activeShape || "None"}</p>
            <ul className="list-disc pl-4 space-y-1">
               <li>Select a Shape from the right panel.</li>
               <li>Click a vertex on the model.</li>
               <li>Use the Gizmo to move it.</li>
               <li>The offset is saved to the selected Shape.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Sidebar Controls */}
      <div className="w-80 bg-gray-950 border-l border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <h3 className="font-bold text-sm text-white">Blendshapes ({shapeNames.length})</h3>
          <p className="text-[10px] text-gray-500 mt-1">Select name to edit vertices.</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {shapeNames.map((name) => (
            <ShapeControl
              key={name}
              name={name}
              value={influences[name] || 0}
              isActive={activeShape === name}
              onSelect={() => {
                setActiveShape(name);
                // Auto set value to 1 when selecting for edit? Optional.
                // setInfluences(prev => ({...prev, [name]: 1}));
              }}
              onChange={(val) => setInfluences(prev => ({ ...prev, [name]: val }))}
            />
          ))}
          {shapeNames.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-xs">
              No blendshapes found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
