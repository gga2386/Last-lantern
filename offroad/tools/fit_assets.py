# Fit CC0 Kenney vehicles to Oxbow physics. OFFROAD_V8
# Wheel hubs land on the raycast points. Bodies scale so the arches follow.
# blender -b -P offroad/tools/fit_assets.py
import bpy, math, os
from mathutils import Vector

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
SRC = os.environ.get("OX_ASSET_SRC", "/tmp/assets")
os.makedirs(OUT, exist_ok=True)

def glb(*parts):
    return os.path.join(SRC, *parts)

# track / wb are the physics half-widths (axle offsets), not the full spans.
SPECS = {
    "pickup": dict(src=glb("car/Models/GLB format/truck-flat.glb"), track=0.98, wb=1.65, R=0.48, rest=0.34),
    "jeep": dict(src=glb("car/Models/GLB format/suv.glb"), track=0.78, wb=1.12, R=0.42, rest=0.28),
    "bronco": dict(src=glb("car/Models/GLB format/suv-luxury.glb"), track=0.94, wb=1.38, R=0.5, rest=0.32),
    "wagon": dict(src=glb("car/Models/GLB format/sedan.glb"), track=0.98, wb=1.72, R=0.46, rest=0.32),
    "utility": dict(src=glb("car/Models/GLB format/truck.glb"), track=0.96, wb=1.52, R=0.5, rest=0.34),
    "van": dict(src=glb("car/Models/GLB format/van.glb"), track=0.92, wb=1.88, R=0.44, rest=0.3),
    "crawler": dict(src=glb("toy/Models/GLB format/vehicle-monster-truck.glb"), track=0.92, wb=1.15, R=0.52, rest=0.38),
}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]

def apply_xform(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

def wheel_radius(obj):
    loc = obj.matrix_world.translation
    r = 0.01
    for v in obj.data.vertices:
        co = obj.matrix_world @ v.co
        r = max(r, ((co.y - loc.y) ** 2 + (co.z - loc.z) ** 2) ** 0.5)
        r = max(r, ((co.x - loc.x) ** 2 + (co.z - loc.z) ** 2) ** 0.5)
    return r

def scale_about(obj, center, sx, sy, sz):
    loc = obj.matrix_world.translation.copy()
    obj.location = Vector((
        center.x + (loc.x - center.x) * sx,
        center.y + (loc.y - center.y) * sy,
        center.z + (loc.z - center.z) * sz,
    ))
    obj.scale = (obj.scale.x * sx, obj.scale.y * sy, obj.scale.z * sz)
    apply_xform(obj)

def fit(style):
    reset()
    spec = SPECS[style]
    bpy.ops.import_scene.gltf(filepath=spec["src"])
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    for o in meshes():
        apply_xform(o)
    wheels = [o for o in meshes() if "wheel" in o.name.lower()]
    if len(wheels) > 4:
        wheels.sort(key=lambda o: abs(o.location.x), reverse=True)
        spare = wheels[4:]
        wheels = wheels[:4]
    else:
        spare = []
    if len(wheels) != 4:
        raise SystemExit("%s expected 4 wheels, got %s" % (style, [o.name for o in meshes()]))
    def front_name(n):
        n = n.lower()
        return "front" in n or "-fl" in n or "-fr" in n
    named = [o for o in wheels if front_name(o.name)]
    if len(named) >= 2:
        others = [o for o in wheels if o not in named]
        if others and sum(o.location.y for o in named) / len(named) > sum(o.location.y for o in others) / len(others):
            for o in meshes():
                o.location.x *= -1
                o.location.y *= -1
                o.rotation_euler.z += math.pi
                apply_xform(o)
    center = Vector((0, 0, 0))
    for o in wheels:
        center += o.location
    center /= 4
    radius = sum(wheel_radius(o) for o in wheels) / 4
    half_track = sum(abs(o.location.x - center.x) for o in wheels) / 4
    half_wb = sum(abs(o.location.y - center.y) for o in wheels) / 4
    s_uniform = spec["R"] / radius
    print(style, "radius", round(radius, 3), "track", round(half_track * 2, 3), "wb", round(half_wb * 2, 3), "scale", round(s_uniform, 3))
    for o in meshes():
        scale_about(o, center, s_uniform, s_uniform, s_uniform)
    center = Vector((0, 0, 0))
    for o in wheels:
        center += o.location
    center /= 4
    half_track = sum(abs(o.location.x - center.x) for o in wheels) / 4 or 0.2
    half_wb = sum(abs(o.location.y - center.y) for o in wheels) / 4 or 0.2
    # A full stretch to the physics track turns these narrow CC0 shells into pancakes
    # and swallows the tires. Clamp it, then park the hubs on the real axles.
    sx = min(1.35, spec["track"] / half_track)
    sy = min(1.45, spec["wb"] / half_wb)
    body = [o for o in meshes() if o not in wheels and o not in spare]
    for o in body:
        scale_about(o, center, sx, sy, 1)
    wy = -0.05 - spec["rest"]
    dz = wy - center.z
    for o in meshes():
        o.location.z += dz
    # Snap hubs onto the physics axles. Nose is Blender -Y.
    wheels.sort(key=lambda o: (o.location.y, o.location.x))
    front = sorted([o for o in wheels if o.location.y <= center.y], key=lambda o: o.location.x)
    rear = sorted([o for o in wheels if o.location.y > center.y], key=lambda o: o.location.x)
    if len(front) != 2 or len(rear) != 2:
        wheels.sort(key=lambda o: o.location.y)
        front = sorted(wheels[:2], key=lambda o: o.location.x)
        rear = sorted(wheels[2:], key=lambda o: o.location.x)
    ordered = [front[0], front[1], rear[0], rear[1]]
    targets = [(-spec["track"], -spec["wb"]), (spec["track"], -spec["wb"]), (-spec["track"], spec["wb"]), (spec["track"], spec["wb"])]
    for obj, (x, y) in zip(ordered, targets):
        obj.location.x = x
        obj.location.y = y
        obj.location.z = wy
    # One shell. Paint is the atlas times the livery color.
    bpy.ops.object.select_all(action="DESELECT")
    for o in body:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body[0]
    if len(body) > 1:
        bpy.ops.object.join()
    shell = bpy.context.active_object
    shell.name = "Body"
    if shell.data.materials:
        mat = shell.data.materials[0].copy()
        mat.name = "Paint"
        shell.data.materials[0] = mat
    for p in shell.data.polygons:
        p.use_smooth = True
    lod = shell.copy()
    lod.data = shell.data.copy()
    lod.name = "LOD_Body"
    bpy.context.scene.collection.objects.link(lod)
    dec = lod.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = 0.45
    bpy.context.view_layer.objects.active = lod
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for i, obj in enumerate(ordered):
        empty = bpy.data.objects.new("Wheel%d" % i, None)
        empty.empty_display_size = 0.15
        bpy.context.scene.collection.objects.link(empty)
        empty.location = obj.location.copy()
        obj.parent = empty
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
        obj.scale = (1, 1, 1)
        obj.name = "WheelMesh%d" % i
    for obj in spare:
        obj.name = "Acc_spare"
    # Drop import empties that are not wheels.
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY" and not o.name.startswith("Wheel"):
            bpy.data.objects.remove(o, do_unlink=True)
    path = os.path.join(OUT, style + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True)
    print("wrote", style, os.path.getsize(path))

def pack_scenery():
    dest = os.path.join(OUT, "scenery")
    os.makedirs(dest, exist_ok=True)
    nature = glb("nature/Models/GLTF format")
    files = {
        "pine": "tree_pineDefaultA.glb",
        "oak": "tree_oak.glb",
        "palm": "tree_palmTall.glb",
        "cactus": "cactus_tall.glb",
        "bush": "plant_bushLarge.glb",
        "grass": "grass_large.glb",
        "rock_a": "rock_largeA.glb",
        "rock_b": "rock_largeB.glb",
        "rock_c": "rock_largeC.glb",
    }
    for name, fn in files.items():
        reset()
        bpy.ops.import_scene.gltf(filepath=os.path.join(nature, fn))
        path = os.path.join(dest, name + ".glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True)
        print("scenery", name, os.path.getsize(path))

if __name__ == "__main__":
    import sys
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    if "scenery" in argv:
        pack_scenery()
    styles = [a for a in argv if a in SPECS] or list(SPECS)
    if "scenery" not in argv or styles:
        for st in styles:
            if st in SPECS:
                fit(st)
