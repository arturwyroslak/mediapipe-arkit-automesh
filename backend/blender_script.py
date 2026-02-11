import bpy
import sys
import os

# Ensure backend directory is in path to import core modules
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

try:
    from core.facial_rig_names import FacialRigNames
except ImportError:
    # Fallback if running directly without proper package context
    class FacialRigNames:
        names = {
            0: 'Basis', 1: 'eyeBlinkLeft', 2: 'eyeLookDownLeft', 3: 'eyeLookInLeft', 4: 'eyeLookOutLeft',
            5: 'eyeLookUpLeft', 6: 'eyeSquintLeft', 7: 'eyeWideLeft', 8: 'eyeBlinkRight', 9: 'eyeLookDownRight',
            10: 'eyeLookInRight', 11: 'eyeLookOutRight', 12: 'eyeLookUpRight', 13: 'eyeSquintRight', 14: 'eyeWideRight',
            15: 'jawForward', 16: 'jawLeft', 17: 'jawRight', 18: 'jawOpen', 19: 'mouthClose', 20: 'mouthFunnel',
            21: 'mouthPucker', 22: 'mouthRight', 23: 'mouthLeft', 24: 'mouthSmileLeft', 25: 'mouthSmileRight',
            26: 'mouthFrownRight', 27: 'mouthFrownLeft', 28: 'mouthDimpleLeft', 29: 'mouthDimpleRight',
            30: 'mouthStretchLeft', 31: 'mouthStretchRight', 32: 'mouthRollLower', 33: 'mouthRollUpper',
            34: 'mouthShrugLower', 35: 'mouthShrugUpper', 36: 'mouthPressLeft', 37: 'mouthPressRight',
            38: 'mouthLowerDownLeft', 39: 'mouthLowerDownRight', 40: 'mouthUpperUpLeft', 41: 'mouthUpperUpRight',
            42: 'browDownLeft', 43: 'browDownRight', 44: 'browInnerUp', 45: 'browOuterUpLeft', 46: 'browOuterUpRight',
            47: 'cheekPuff', 48: 'cheekSquintLeft', 49: 'cheekSquintRight', 50: 'noseSneerLeft', 51: 'noseSneerRight',
            52: 'tongueOut'
        }

def log(msg):
    print(f"[ARKit-AutoMesh] {msg}")

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    log("Scene cleared.")

def import_glb(filepath):
    log(f"Importing {filepath}...")
    bpy.ops.import_scene.gltf(filepath=filepath)
    
    # Identify the main mesh. Prioritize objects with 'Head' or 'Face' in name, otherwise pick largest mesh.
    candidates = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    
    if not candidates:
        return None
        
    target = candidates[0]
    # Simple heuristic: largest number of vertices usually implies the main mesh if there are accessories
    if len(candidates) > 1:
        target = max(candidates, key=lambda o: len(o.data.vertices))
        
    log(f"Selected target mesh: {target.name}")
    
    # Make active and selected
    bpy.context.view_layer.objects.active = target
    target.select_set(True)
    return target

def create_shape_keys(obj):
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis")
        log("Created Basis shape key.")
    
    existing_keys = obj.data.shape_keys.key_blocks
    
    count = 0
    for i in range(1, 53):
        shape_name = FacialRigNames.names.get(i)
        if shape_name and shape_name not in existing_keys:
            obj.shape_key_add(name=shape_name)
            count += 1
            
    log(f"Added {count} missing ARKit blendshapes (empty).")

def export_glb(filepath):
    log(f"Exporting to {filepath}...")
    # Ensure export includes shape keys (morph targets)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_morph=True,
        export_apply=True  # Apply modifiers if any
    )
    log("Export complete.")

if __name__ == "__main__":
    try:
        argv = sys.argv
        if "--" in argv:
            args = argv[argv.index("--") + 1:]
            if len(args) >= 2:
                input_path = args[0]
                output_path = args[1]
                
                clear_scene()
                target_mesh = import_glb(input_path)
                
                if target_mesh:
                    create_shape_keys(target_mesh)
                    export_glb(output_path)
                else:
                    log("ERROR: No suitable mesh found in input file.")
                    sys.exit(1)
            else:
                log("ERROR: Insufficient arguments. Usage: blender ... -- <input> <output>")
                sys.exit(1)
        else:
            log("ERROR: Separator '--' not found in arguments.")
            sys.exit(1)
            
    except Exception as e:
        log(f"FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
