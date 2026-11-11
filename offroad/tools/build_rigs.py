# Original Oxbow rigs, modeled in Blender. No brand marks. OFFROAD_V5
# Nose points down Blender -Y so glTF export faces Three.js +Z.
# blender -b -P offroad/tools/build_rigs.py -- [style|all]
import bpy, math, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
os.makedirs(ROOT, exist_ok=True)

def args():
    a = sys.argv
    a = a[a.index("--") + 1:] if "--" in a else []
    return a

# Blender: X right, Z up, -Y forward.
STYLES = {
    "pickup": dict(track=0.98, wb=1.65, R=0.48, rest=0.34, nose=2.05, tail=2.15,
                   body=(1.7, 3.5, 0.62), body_z=0.42,
                   cab=(1.5, 1.15, 0.62), cab_y=-0.15, cab_z=0.95,
                   hood=(1.5, 1.15, 0.28), hood_y=-1.15, hood_z=0.62, hood_pitch=8,
                   bed=True, snorkel=True, windows=2),
    "jeep": dict(track=0.78, wb=1.12, R=0.42, rest=0.28, nose=1.45, tail=1.35,
                 body=(1.25, 2.3, 0.42), body_z=0.34,
                 cab=None, hood=(0.85, 0.9, 0.16), hood_y=-0.55, hood_z=0.5, hood_pitch=6,
                 bed=False, snorkel=True, windows=0, open=True),
    "bronco": dict(track=0.94, wb=1.38, R=0.5, rest=0.32, nose=1.82, tail=1.7,
                   body=(1.62, 2.9, 0.66), body_z=0.46,
                   cab=(1.48, 1.25, 0.58), cab_y=0.25, cab_z=0.98,
                   hood=(1.48, 1.05, 0.26), hood_y=-0.95, hood_z=0.64, hood_pitch=10,
                   bed=False, snorkel=False, windows=1),
    "wagon": dict(track=0.98, wb=1.72, R=0.46, rest=0.32, nose=2.15, tail=2.2,
                  body=(1.7, 3.9, 0.64), body_z=0.44,
                  cab=(1.55, 2.35, 0.62), cab_y=0.25, cab_z=1.0,
                  hood=(1.55, 0.95, 0.24), hood_y=-1.25, hood_z=0.62, hood_pitch=8,
                  bed=False, snorkel=False, windows=3, wood=True),
    "utility": dict(track=0.96, wb=1.52, R=0.5, rest=0.34, nose=1.9, tail=1.9,
                    body=(1.58, 3.3, 0.68), body_z=0.48,
                    cab=(1.5, 1.55, 0.7), cab_y=0.35, cab_z=1.05,
                    hood=(1.48, 1.05, 0.26), hood_y=-1.0, hood_z=0.66, hood_pitch=4,
                    bed=False, snorkel=True, windows=2, boxy=True),
    "van": dict(track=0.92, wb=1.88, R=0.44, rest=0.3, nose=2.25, tail=2.25,
                body=(1.7, 4.2, 1.35), body_z=0.85,
                cab=None, hood=None, bed=False, snorkel=False, windows=2, van=True),
}

def wy(s):
    return -0.05 - s["rest"] * 0.72

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, color, metal, rough, coat=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    if emit and "Emission Strength" in b.inputs:
        b.inputs["Emission Strength"].default_value = emit
        if "Emission Color" in b.inputs:
            b.inputs["Emission Color"].default_value = (*color, 1)
    return m

def act(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def apply_mods(obj):
    act(obj)
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def cube(name, loc, scale, parent, material, bevel=0.08, pitch=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.rotation_euler = (math.radians(pitch), 0, 0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    if bevel:
        md = o.modifiers.new("Bevel", "BEVEL")
        md.width = bevel
        md.segments = 3
        md.affect = "EDGES"
        apply_mods(o)
    if material:
        o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    o.parent = parent
    return o

def cyl(name, loc, radius, depth, rot, parent, material, verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if material:
        o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    o.parent = parent
    return o

def uv(name, loc, radius, parent, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=radius, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if material:
        o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    o.parent = parent
    return o

def fuse(parts, name, parent, material, voxel=0.07):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = name
    md = body.modifiers.new("Remesh", "REMESH")
    md.mode = "VOXEL"
    md.voxel_size = voxel
    md.adaptivity = 0.0
    apply_mods(body)
    sm = body.modifiers.new("Smooth", "SMOOTH")
    sm.iterations = 5
    sm.factor = 0.5
    apply_mods(body)
    body.data.materials.clear()
    body.data.materials.append(material)
    for p in body.data.polygons:
        p.use_smooth = True
    body.parent = parent
    return body

def cut_arches(body, s):
    y = wy(s)
    # blender Y is -game Z, so front wheel (game +wb) is blender Y = -wb
    cuts = []
    for side in (-1, 1):
        for game_z in (s["wb"], -s["wb"]):
            c = cyl("cut", (side * s["track"], -game_z, y), s["R"] + 0.05, 0.7, (0, math.pi / 2, 0), body, None, 20)
            cuts.append(c)
    for c in cuts:
        md = body.modifiers.new("Arch", "BOOLEAN")
        md.operation = "DIFFERENCE"
        md.object = c
        md.solver = "EXACT"
        apply_mods(body)
        bpy.data.objects.remove(c, do_unlink=True)
    return body

def wheel(name, loc, R, parent, M):
    empty = bpy.data.objects.new(name, None)
    empty.location = loc
    bpy.context.scene.collection.objects.link(empty)
    empty.parent = parent
    tire = cyl(name + "_tire", loc, R * 0.98, 0.3, (0, math.pi / 2, 0), empty, M["rubber"], 24)
    tread = cyl(name + "_tread", loc, R * 1.03, 0.18, (0, math.pi / 2, 0), empty, M["tread"], 24)
    rim = cyl(name + "_rim", loc, R * 0.58, 0.32, (0, math.pi / 2, 0), empty, M["rim"], 20)
    cap = cyl(name + "_cap", loc, R * 0.18, 0.34, (0, math.pi / 2, 0), empty, M["dark"], 12)
    for o in (tire, tread, rim, cap):
        o.location = (0, 0, 0)
        o.parent = empty
    return empty

def build(style):
    reset()
    s = STYLES[style]
    root = bpy.data.objects.new(style, None)
    bpy.context.scene.collection.objects.link(root)
    M = {
        "paint": mat("Paint", (1, 1, 1), 0.05, 0.3, coat=0.9),
        "accent": mat("Accent", (1, 1, 1), 0.04, 0.36, coat=0.4),
        "glass": mat("Glass", (0.04, 0.09, 0.11), 0.05, 0.04, coat=1),
        "chrome": mat("Chrome", (0.8, 0.8, 0.76), 0.9, 0.22, coat=0.25),
        "rubber": mat("Rubber", (0.015, 0.015, 0.015), 0, 0.72),
        "tread": mat("Tread", (0.01, 0.01, 0.01), 0, 0.95),
        "rim": mat("Rim", (0.93, 0.92, 0.88), 0.4, 0.3),
        "dark": mat("Dark", (0.015, 0.02, 0.025), 0.15, 0.45),
        "lamp": mat("Lamp", (1, 0.97, 0.88), 0, 0.18, emit=2),
        "tail": mat("Tail", (0.65, 0.04, 0.03), 0, 0.32, emit=1),
        "mud": mat("Mud", (0.25, 0.16, 0.09), 0, 1),
        "gear": mat("Gear", (0.18, 0.45, 0.14), 0.05, 0.5),
        "kayak": mat("Kayak", (0.72, 0.84, 0.18), 0.02, 0.35, coat=0.4),
        "red": mat("KayakRed", (0.72, 0.2, 0.12), 0.02, 0.35, coat=0.35),
    }
    parts = []
    bevel = 0.06 if s.get("boxy") or s.get("van") else 0.1
    parts.append(cube("hull", (0, 0, s["body_z"]), s["body"], root, None, bevel=bevel))
    if s.get("cab"):
        parts.append(cube("cab", (0, s["cab_y"], s["cab_z"]), s["cab"], root, None, bevel=bevel * 0.8))
    if s.get("hood"):
        parts.append(cube("hood", (0, s["hood_y"], s["hood_z"]), s["hood"], root, None, bevel=0.06, pitch=s.get("hood_pitch", 0)))
    if s.get("bed"):
        parts.append(cube("bedL", (-0.72, 0.85, 0.62), (0.12, 1.5, 0.36), root, None, bevel=0.03))
        parts.append(cube("bedR", (0.72, 0.85, 0.62), (0.12, 1.5, 0.36), root, None, bevel=0.03))
    if s.get("open"):
        parts.append(cube("fenderL", (-s["track"], -0.15, wy(s) + s["R"] * 0.55), (0.34, s["wb"] * 1.7, 0.28), root, None, bevel=0.08))
        parts.append(cube("fenderR", (s["track"], -0.15, wy(s) + s["R"] * 0.55), (0.34, s["wb"] * 1.7, 0.28), root, None, bevel=0.08))
    body = fuse(parts, "Body", root, M["paint"], voxel=0.048 if not s.get("van") else 0.055)
    # arches only on closed bodies; jeep fenders are the arches
    if not s.get("open"):
        cut_arches(body, s)
    # duplicate lod
    lod = body.copy()
    lod.data = body.data.copy()
    lod.name = "LOD_Body"
    bpy.context.scene.collection.objects.link(lod)
    lod.parent = root
    md = lod.modifiers.new("Decimate", "DECIMATE")
    md.ratio = 0.35
    apply_mods(lod)
    nose = -s["body"][1] * 0.5
    tail = s["body"][1] * 0.5
    # glass
    if s.get("van"):
        cube("Glass_wind", (0, nose + 0.15, 1.15), (1.35, 0.05, 0.55), root, M["glass"], bevel=0.02, pitch=-12)
        cube("Glass_sideL", (-0.86, 0.1, 1.12), (0.04, 1.4, 0.36), root, M["glass"], bevel=0.01)
        cube("Glass_sideR", (0.86, 0.1, 1.12), (0.04, 1.4, 0.36), root, M["glass"], bevel=0.01)
    elif s.get("open"):
        cube("Glass_wind", (0, -0.05, 0.82), (0.85, 0.04, 0.4), root, M["glass"], bevel=0.01, pitch=-24)
    else:
        wind_y = s.get("hood_y", -0.8) * 0.15
        cube("Glass_wind", (0, wind_y - 0.15, s["cab_z"]), (s["cab"][0] * 0.82, 0.05, s["cab"][2] * 0.55), root, M["glass"], bevel=0.015, pitch=-28)
        cube("Glass_sideL", (-s["body"][0] * 0.48, s["cab_y"], s["cab_z"]), (0.04, s["cab"][1] * 0.7, s["cab"][2] * 0.42), root, M["glass"], bevel=0.01)
        cube("Glass_sideR", (s["body"][0] * 0.48, s["cab_y"], s["cab_z"]), (0.04, s["cab"][1] * 0.7, s["cab"][2] * 0.42), root, M["glass"], bevel=0.01)
    # front clip. Nose is -Y.
    cube("Bumper", (0, nose - 0.1, wy(s) + s["R"] * 0.55), (s["track"] * 1.7, 0.22, 0.18), root, M["chrome"], bevel=0.05)
    cube("Grille", (0, nose - 0.12, 0.62 if not s.get("van") else 0.78), (0.78, 0.1, 0.42), root, M["dark"], bevel=0.02)
    for i in range(4):
        cube("Bar%d" % i, (0, nose - 0.18, (0.48 if not s.get("van") else 0.64) + i * 0.09), (0.62, 0.04, 0.035), root, M["chrome"], bevel=0.006)
    count = 4 if style == "utility" else 2
    for i in range(count):
        x = (i - (count - 1) / 2) * (0.28 if count == 4 else s["track"] * 0.72)
        uv("Head%d" % i, (x, nose - 0.16, 0.7 if not s.get("van") else 0.95), 0.12, root, M["lamp"], (1, 0.65, 1))
    for side in (-1, 1):
        uv("Tail%d" % side, (side * s["track"] * 0.55, tail + 0.08, 0.5), 0.08, root, M["tail"], (1, 0.55, 0.85))
        cube("Mirror%d" % side, (side * (s["track"] + 0.1), -0.2, 0.9), (0.16, 0.08, 0.1), root, M["dark"], bevel=0.02)
    cyl("Antenna", (0.28, 0.1, 1.45 if not s.get("van") else 1.75), 0.012, 0.9, (0, 0, 0), root, M["dark"], 6)
    if s.get("snorkel"):
        cyl("Snorkel", (-s["track"] * 0.55, -0.35, 0.95), 0.035, 0.85, (0, 0, 0), root, M["dark"], 8)
    # liveries sit on the sides
    span = (s["nose"] + s["tail"]) * 0.32
    for side in (-1, 1):
        cube("Accent_stripe", (side * s["body"][0] * 0.5, 0.05, 0.62), (0.05, span, 0.1), root, M["accent"], bevel=0.01)
        cube("Accent_thick", (side * s["body"][0] * 0.5, 0.0, 0.52), (0.055, span * 0.9, 0.24), root, M["accent"], bevel=0.015)
        if s.get("wood") or style == "pickup":
            for i in range(4):
                cube("Accent_wood", (side * s["body"][0] * 0.5, 0.35 + i * 0.32, 0.5), (0.05, 0.24, 0.34), root, M["accent"], bevel=0.008)
        cube("Accent_chevron", (side * s["body"][0] * 0.52, -0.15, 0.7), (0.05, 0.7, 0.45), root, M["accent"], bevel=0.01, pitch=28 if side > 0 else -28)
    for i, (x, y, z, r) in enumerate(((0.65, 0.4, 0.25, 0.16), (-0.55, -0.6, 0.22, 0.14), (0.4, 1.0, 0.2, 0.15))):
        uv("Mud%d" % i, (x, y, z), r, root, M["mud"], (1.3, 0.8, 0.4))
    roof = s["body_z"] + s["body"][2] * 0.5 + 0.08
    if s.get("cab"):
        roof = s["cab_z"] + s["cab"][2] * 0.5 + 0.06
    if s.get("van"):
        roof = s["body_z"] + s["body"][2] * 0.5 + 0.05
    cube("Acc_rack", (0.34, 0, roof), (0.05, 1.3, 0.04), root, M["dark"], bevel=0.008)
    cube("Acc_rackb", (-0.34, 0, roof), (0.05, 1.3, 0.04), root, M["dark"], bevel=0.008)
    for i, x in enumerate((-0.22, 0.05, 0.28)):
        cyl("Acc_jerry", (x, 0.15, roof + 0.14), 0.11, 0.42, (0, math.pi / 2, 0), root, M["gear"], 10)
    cyl("Acc_kayak", (-0.05, 0.05, roof + 0.16), 0.1, 2.1, (math.pi / 2, 0, 0), root, M["kayak"], 10)
    cyl("Acc_kayakb", (0.18, -0.05, roof + 0.18), 0.08, 1.9, (math.pi / 2, 0, 0.15), root, M["red"], 10)
    cyl("Acc_bike", (0.4, tail - 0.15, 0.75), 0.32, 0.06, (0, math.pi / 2, 0), root, M["rubber"], 16)
    cyl("Acc_bikeb", (0.4, tail - 0.55, 0.75), 0.32, 0.06, (0, math.pi / 2, 0), root, M["rubber"], 16)
    cube("Acc_bikef", (0.4, tail - 0.35, 0.95), (0.05, 0.5, 0.05), root, M["red"], bevel=0)
    if style == "utility":
        wheel("Acc_spare", (0, -0.7, 0.85), s["R"] * 0.82, root, M)
    elif style == "van":
        for i in range(4):
            wheel("Acc_spare" if i == 0 else "Acc_spare%d" % i, (0, -0.4 + i * 0.34, roof + 0.2), s["R"] * 0.62, root, M)
    else:
        wheel("Acc_spare", (0, tail - 0.05, 0.62), s["R"] * 0.8, root, M)
    y = wy(s)
    for i, (x, gz) in enumerate(((-s["track"], s["wb"]), (s["track"], s["wb"]), (-s["track"], -s["wb"]), (s["track"], -s["wb"]))):
        wheel("Wheel%d" % i, (x, -gz, y), s["R"], root, M)
    path = os.path.join(ROOT, style + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True)
    print("wrote", style, os.path.getsize(path), "verts", len(body.data.vertices))
    if os.environ.get("OX_PREVIEW"):
        cam_data = bpy.data.cameras.new("Cam")
        cam = bpy.data.objects.new("Cam", cam_data)
        bpy.context.scene.collection.objects.link(cam)
        cam.location = (5.2, -7.2, 2.6)
        bpy.context.scene.camera = cam
        tr = cam.constraints.new("TRACK_TO")
        tr.target = root
        tr.track_axis = "TRACK_NEGATIVE_Z"
        tr.up_axis = "UP_Y"
        lod.hide_render = True
        sun = bpy.data.lights.new("Sun", "SUN")
        sun.energy = 4
        sun.color = (1, 0.75, 0.5)
        so = bpy.data.objects.new("Sun", sun)
        bpy.context.scene.collection.objects.link(so)
        so.rotation_euler = (math.radians(48), 0.2, -0.6)
        bpy.context.scene.render.engine = "BLENDER_WORKBENCH"
        bpy.context.scene.render.resolution_x = 960
        bpy.context.scene.render.resolution_y = 540
        bpy.context.scene.display.shading.light = "STUDIO"
        bpy.context.scene.display.shading.color_type = "MATERIAL"
        bpy.context.scene.render.filepath = "/tmp/rig-%s.png" % style
        bpy.ops.render.render(write_still=True)

if __name__ == "__main__":
    a = args()
    names = [x for x in a if x in STYLES]
    styles = names or list(STYLES)
    for st in styles:
        build(st)
