# Headless Blender: smooth crawler body, mud tire, and yard wrecker.
# Blender is Z-up, -Y forward. glTF export maps that to Y-up, +Z forward.
import bpy
import math
from mathutils import Vector

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def mat(name, color, rough, metal, emit=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emit
    return m

def add_box(name, material, tw, th, td, tx, ty, tz, pitch=0, bevel=0.045):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(tx, -tz, ty))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (tw, td, th)
    ob.rotation_euler[0] = pitch
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        b = ob.modifiers.new('Bevel', 'BEVEL')
        b.width = min(bevel, tw * 0.18, th * 0.18, td * 0.12)
        b.segments = 2
        b.affect = 'EDGES'
        bpy.ops.object.modifier_apply(modifier=b.name)
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(material)
    return ob

def add_cyl(name, material, radius, depth, tx, ty, tz, axis='X', verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=(tx, -tz, ty))
    ob = bpy.context.active_object
    ob.name = name
    if axis == 'X':
        ob.rotation_euler[1] = math.pi / 2
    elif axis == 'Z':
        ob.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(material)
    return ob

def join(name, objects, material):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    if material and ob.data.materials:
        ob.data.materials[0] = material
    return ob

def join_materials():
    groups = {}
    for ob in list(bpy.context.scene.objects):
        if ob.type != 'MESH' or not ob.data.materials:
            continue
        groups.setdefault(ob.data.materials[0].name, []).append(ob)
    for name, obs in groups.items():
        if len(obs) < 2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in obs:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        bpy.ops.object.join()
        bpy.context.active_object.name = name

def export(path):
    join_materials()
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT'
    )

def crawler_body():
    clear()
    body = mat('body', (0.82, 0.12, 0.10), 0.42, 0.08)
    glass = mat('glass', (0.04, 0.05, 0.07), 0.08, 0.35)
    grille = mat('grille', (0.08, 0.08, 0.09), 0.5, 0.4)
    lamp = mat('lamp', (0.95, 0.93, 0.86), 0.25, 0.1, 0.4)
    trim = mat('trim', (0.07, 0.07, 0.08), 0.55, 0.15)
    zF, zR = 1.349, -1.387
    wheelR, drop, rest, axleY = 0.74, -1.28, 0.42, 0.76
    conn = axleY + drop + rest
    tireTop = conn - rest + wheelR
    railY = tireTop + 0.22
    rocker = railY + 0.14
    cabH = 1.26
    belt = rocker + cabH * 0.44
    roofY = rocker + cabH
    nose = zF + 0.58
    cabF = zF - 0.72
    cabB = cabF - 1.28
    half = 0.76
    sill = belt + 0.02
    hoodRear = cabF - 0.08
    hoodBottom = railY + 0.06
    hoodH = max(0.5, sill - hoodBottom)
    hoodW = half * 2 - 0.14
    hoodLen = nose - hoodRear
    cabLen = cabF - cabB
    cabZ = (cabF + cabB) / 2
    parts = []
    parts.append(add_box('cab', body, half * 2, cabH * 0.96, cabLen * 0.98, 0, rocker + cabH * 0.48, cabZ, bevel=0.07))
    parts.append(add_box('roof', body, half * 2 + 0.1, 0.08, cabLen + 0.22, 0, roofY + 0.02, cabZ - 0.04, bevel=0.035))
    parts.append(add_box('hood', body, hoodW, hoodH, hoodLen, 0, hoodBottom + hoodH / 2, (nose + hoodRear) / 2, bevel=0.06))
    parts.append(add_box('scoop', body, hoodW * 0.34, 0.07, hoodLen * 0.28, 0, sill + 0.03, cabF + hoodLen * 0.22, bevel=0.02))
    parts.append(add_box('cowl', body, half * 2 - 0.06, 0.1, 0.18, 0, sill - 0.02, cabF, bevel=0.02))
    parts.append(add_box('sill', body, half * 2 + 0.04, 0.07, cabLen, 0, rocker + 0.03, cabZ, bevel=0.015))
    join('crawler-body', parts, body)
    add_box('vent', trim, hoodW * 0.18, 0.02, 0.09, 0, sill + 0.06, cabF + hoodLen * 0.32, bevel=0.004)
    add_box('grille', grille, hoodW * 0.86, hoodH * 0.38, 0.06, 0, hoodBottom + hoodH * 0.22, nose + 0.02, bevel=0.012)
    for s in (-1, 1):
        add_cyl('lamp', lamp, 0.05, 0.04, s * hoodW * 0.3, hoodBottom + hoodH * 0.24, nose + 0.05, axis='Z', verts=12)
    winH = (roofY - 0.08) - sill
    winZ = (cabF + cabB) / 2
    winLen = (cabF - cabB) - 0.28
    for s in (-1, 1):
        add_box('glass', glass, 0.03, winH, winLen, s * (half + 0.01), sill + winH / 2, winZ, bevel=0.01)
        add_box('trim', trim, 0.02, 0.035, winLen + 0.04, s * (half + 0.03), sill + 0.01, winZ, bevel=0)
        add_box('trim', trim, 0.02, 0.035, winLen + 0.04, s * (half + 0.03), roofY - 0.07, winZ, bevel=0)
        add_box('trim', trim, 0.02, winH, 0.04, s * (half + 0.03), sill + winH / 2, cabF - 0.1, bevel=0)
        add_box('trim', trim, 0.02, winH, 0.04, s * (half + 0.03), sill + winH / 2, cabB + 0.12, bevel=0)
        add_box('trim', trim, 0.025, 0.03, 0.1, s * (half + 0.04), sill - 0.12, winZ + 0.2, bevel=0.004)
    add_box('glass', glass, half * 2 - 0.2, 0.62, 0.04, 0, belt + 0.34, cabF + 0.04, pitch=-0.38, bevel=0.01)
    add_box('glass', glass, half * 1.3, 0.48, 0.04, 0, belt + 0.36, cabB - 0.03, bevel=0.01)
    export('/workspace/offroad/models/crawler_body.glb')

def crawler_tire():
    clear()
    rubber = mat('tire', (0.07, 0.07, 0.08), 0.92, 0)
    rim = mat('rim', (0.08, 0.08, 0.09), 0.45, 0.35)
    ring = mat('ring', (0.86, 0.87, 0.9), 0.28, 0.72)
    hub = mat('hub', (0.78, 0.12, 0.1), 0.4, 0.25)
    bolt = mat('bolt', (0.8, 0.82, 0.84), 0.3, 0.7)
    carcass = add_box('skip', rubber, 0.01, 0.01, 0.01, 0, 0, 0, bevel=0)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.9, location=(0, 0, 0))
    tire = bpy.context.active_object
    tire.name = 'tire'
    tire.scale = (0.62, 1, 1)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    tire.data.materials.append(rubber)
    lugs = [tire]
    n = 16
    for i in range(n):
        a = (i / n) * math.pi * 2
        y = math.sin(a) * 0.92
        z = math.cos(a) * 0.92
        # three Y = blender Z, three Z = -blender Y, circle in three YZ
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -math.sin(a) * 0.9, math.cos(a) * 0.9))
        lug = bpy.context.active_object
        lug.scale = (0.42, 0.22, 0.16)
        lug.rotation_euler[0] = a
        bpy.ops.object.transform_apply(rotation=True, scale=True)
        lug.data.materials.append(rubber)
        lugs.append(lug)
        for side in (-1, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(side * 0.28, -math.sin(a + 0.2) * 0.82, math.cos(a + 0.2) * 0.82))
            sh = bpy.context.active_object
            sh.scale = (0.16, 0.16, 0.12)
            sh.rotation_euler[0] = a
            bpy.ops.object.transform_apply(rotation=True, scale=True)
            sh.data.materials.append(rubber)
            lugs.append(sh)
    join('tire', lugs, rubber)
    for side in (-1, 1):
        add_cyl('rim', rim, 0.46, 0.08, side * 0.34, 0, 0, axis='X', verts=20)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.58, minor_radius=0.045, major_segments=24, minor_segments=8, location=(side * 0.36, 0, 0))
        ring_ob = bpy.context.active_object
        ring_ob.rotation_euler[1] = math.pi / 2
        bpy.ops.object.transform_apply(rotation=True)
        bpy.ops.object.shade_smooth()
        ring_ob.data.materials.append(ring)
        add_cyl('hub', hub, 0.14, 0.1, side * 0.4, 0, 0, axis='X', verts=12)
        for i in range(8):
            a = (i / 8) * math.pi * 2
            add_cyl('bolt', bolt, 0.03, 0.04, side * 0.4, math.cos(a) * 0.34, math.sin(a) * 0.34, axis='X', verts=6)
    export('/workspace/offroad/models/crawler_tire.glb')

def wrecker():
    clear()
    paint = mat('paint', (0.89, 0.34, 0.12), 0.38, 0.08)
    dark = mat('dark', (0.1, 0.11, 0.13), 0.5, 0.2)
    glass = mat('glass', (0.06, 0.1, 0.12), 0.08, 0.3)
    chrome = mat('chrome', (0.82, 0.8, 0.74), 0.28, 0.7)
    lamp = mat('lamp', (1, 0.95, 0.82), 0.3, 0.1, 0.8)
    rubber = mat('tire', (0.08, 0.08, 0.08), 0.9, 0)
    rim = mat('rim', (0.9, 0.88, 0.82), 0.35, 0.4)
    parts = []
    parts.append(add_box('bed', paint, 1.7, 0.55, 2.2, 0, 0.72, -0.35, bevel=0.06))
    parts.append(add_box('cab', paint, 1.62, 0.85, 1.35, 0, 1.15, 0.85, bevel=0.07))
    parts.append(add_box('hood', paint, 1.5, 0.42, 0.85, 0, 0.95, 1.55, bevel=0.05))
    join('wrecker-body', parts, paint)
    add_box('glass', glass, 1.35, 0.48, 0.05, 0, 1.28, 1.5, pitch=-0.35, bevel=0.01)
    add_box('glass', glass, 0.04, 0.42, 0.7, 0.82, 1.25, 0.9, bevel=0.008)
    add_box('glass', glass, 0.04, 0.42, 0.7, -0.82, 1.25, 0.9, bevel=0.008)
    add_box('bumper', chrome, 1.7, 0.16, 0.16, 0, 0.48, 1.95, bevel=0.02)
    add_box('boom', dark, 0.14, 0.14, 1.6, 0, 1.95, -0.55, pitch=0.42, bevel=0.02)
    add_box('bedrail', dark, 1.55, 0.08, 1.5, 0, 1.05, -0.55, bevel=0.015)
    for x, z in ((-0.85, 1.2), (0.85, 1.2), (-0.85, -1.15), (0.85, -1.15)):
        add_cyl('tire', rubber, 0.4, 0.28, x, 0.4, z, axis='X', verts=16)
        add_cyl('rim', rim, 0.18, 0.3, x, 0.4, z, axis='X', verts=12)
    for s in (-1, 1):
        add_cyl('lamp', lamp, 0.07, 0.05, s * 0.48, 0.62, 2.02, axis='Z', verts=10)
    export('/workspace/offroad/models/wrecker.glb')

crawler_body()
crawler_tire()
wrecker()
print('exported v18 models')
