// Campsite models and the 3D fish, spot, and cook moments. OFFROAD_V10
// Assets load the first time camp is pitched, not with the driving boot.
import { GLTFLoader } from '../vendor/GLTFLoader.js'
import { SURF } from './world.js'
import { slopeAt, roastColor } from './camp.js'

const FILES = {
  tent0: 'tent_small_quaternius',
  tent1: 'tent_dome_2p_custom',
  tent2: 'tent_dome_4p_custom',
  roof: 'tent_rooftop_custom',
  tarp: 'tarp_awning_custom',
  pit: 'firepit_stones_logs_circuitz',
  grill: 'grill_grate_custom',
  chair: 'chair_camp_folding_saraskau',
  table: 'table_folding_spaulmichael',
  cooler: 'cooler_red_closed_spaulmichael',
  lantern: 'lantern_nickslough',
  lights: 'string_lights_custom',
  stove: 'stove_single_kaylousberg',
  propane: 'propane_tank_quaternius',
  wood: 'firewood_pile_kash',
  log: 'firewood_log_quaternius',
  bag: 'sleeping_bag_saraskau',
  pack: 'backpack_quaternius',
  axe: 'axe_quaternius',
  rod: 'fishing_rod_quaternius',
  bobber: 'bobber_custom',
  trout: 'fish_trout_polygoogle',
  fish: 'fish_animated_quaternius',
  bucket: 'bucket_of_fish_quaternius',
  dock: 'dock_quaternius',
  doe: 'deer_doe_animated_quaternius',
  stag: 'deer_stag_animated_quaternius',
  fox: 'fox_animated_quaternius',
  elk: 'elk_polygoogle',
  turkey: 'turkey_polygoogle',
  rabbit: 'rabbit_gray_noahlewis',
  binoculars: 'binoculars_polygoogle',
  camera: 'camera_polygoogle',
  post: 'trail_marker_post_custom',
  cairn: 'trail_marker_cairn_custom',
  sign: 'trail_sign_wooden_ipoly3d',
  skillet: 'skillet_castiron_milkandbanana',
  pot: 'pot_quaternius',
  fillet: 'food_fish_fillet_quaternius',
  steak: 'food_steak_quaternius',
  sausage: 'food_bratwurst_polygoogle',
  corn: 'food_corn_polygoogle',
  can: 'food_can_open_quaternius'
}

// Animated animals sit above the origin in the file. Drop them onto the trail.
const FOOT = { doe: 0.52, stag: 0.32, fox: 0.3, fish: 0.05 }

let cache = null
let loading = null

export function campAssetsReady() { return !!cache }

export function ensureCamp(THREE) {
  if (cache) return Promise.resolve(cache)
  if (loading) return loading
  const loader = new GLTFLoader()
  loading = Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    const gltf = await loader.loadAsync('models/camp/' + file + '.glb')
    gltf.scene.traverse(o => {
      if (!o.isMesh) return
      o.castShadow = false
      o.receiveShadow = true
      if (o.isSkinnedMesh) o.frustumCulled = false
    })
    return [key, gltf.scene, gltf.animations || []]
  })).then(rows => {
    const scenes = {}
    const clips = {}
    rows.forEach(([key, scene, animations]) => {
      scenes[key] = scene
      clips[key] = animations
    })
    cache = { scenes, clips }
    return cache
  }).catch(err => {
    loading = null
    throw err
  })
  return loading
}

function cloneProp(src) {
  return src.clone(true)
}

function cloneAnimated(src) {
  const clone = src.clone(true)
  const pairs = []
  const walk = (a, b) => {
    pairs.push([a, b])
    for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i])
  }
  walk(src, clone)
  const map = new Map(pairs)
  for (const [, node] of pairs) {
    if (!node.isSkinnedMesh || !node.skeleton) continue
    const bones = node.skeleton.bones.map(bone => map.get(bone) || bone)
    node.bind(new node.skeleton.constructor(bones, node.skeleton.boneInverses), node.bindMatrix)
  }
  return clone
}

function ownMaterials(root) {
  root.traverse(o => {
    if (!o.isMesh || !o.material) return
    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone()
  })
}

function tentSlot(name) {
  if (name === 'LightGreen' || name === 'PaletteMaterial002' || name === 'rtt_shell') return 'accent'
  if (name === 'Green' || name === 'PaletteMaterial001' || name === 'rtt_fabric') return 'fabric'
  return ''
}

function rememberColor(mat, kind, slot) {
  mat.userData.campKind = kind
  mat.userData.campSlot = slot
  if (!mat.userData.campOrig) {
    mat.userData.campOrig = { color: '#' + mat.color.getHexString(), map: mat.map || null }
  }
}

function splitChair(THREE, mesh) {
  const src = mesh.geometry
  const uv = src.getAttribute('uv')
  const pos = src.getAttribute('position')
  if (!uv || !pos) return
  const nrm = src.getAttribute('normal')
  const index = src.getIndex()
  const tri = i => index ? index.getX(i) : i
  const count = index ? index.count : pos.count
  const buckets = { fabric: [], frame: [] }
  for (let i = 0; i < count; i += 3) {
    const ids = [tri(i), tri(i + 1), tri(i + 2)]
    const u = (uv.getX(ids[0]) + uv.getX(ids[1]) + uv.getX(ids[2])) / 3
    buckets[u < 0.055 ? 'fabric' : 'frame'].push(ids[0], ids[1], ids[2])
  }
  const parent = mesh.parent
  if (!parent) return
  for (const slot of ['fabric', 'frame']) {
    const ids = buckets[slot]
    if (!ids.length) continue
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(ids.length * 3)
    const nn = nrm ? new Float32Array(ids.length * 3) : null
    ids.forEach((id, i) => {
      p[i * 3] = pos.getX(id)
      p[i * 3 + 1] = pos.getY(id)
      p[i * 3 + 2] = pos.getZ(id)
      if (nn) {
        nn[i * 3] = nrm.getX(id)
        nn[i * 3 + 1] = nrm.getY(id)
        nn[i * 3 + 2] = nrm.getZ(id)
      }
    })
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    if (nn) g.setAttribute('normal', new THREE.BufferAttribute(nn, 3))
    const mat = mesh.material.clone()
    mat.map = mesh.material.map || null
    rememberColor(mat, 'chair', slot)
    const piece = new THREE.Mesh(g, mat)
    piece.position.copy(mesh.position)
    piece.quaternion.copy(mesh.quaternion)
    piece.scale.copy(mesh.scale)
    piece.castShadow = mesh.castShadow
    piece.receiveShadow = mesh.receiveShadow
    parent.add(piece)
  }
  parent.remove(mesh)
}

export function prepareCampPaint(THREE, root, kind) {
  if (!root) return
  ownMaterials(root)
  if (kind === 'chair') {
    const meshes = []
    root.traverse(o => { if (o.isMesh) meshes.push(o) })
    meshes.forEach(m => splitChair(THREE, m))
    return
  }
  root.traverse(o => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach(m => {
      const slot = tentSlot(m.name || '')
      if (slot) rememberColor(m, 'tent', slot)
    })
  })
}

export function paintCamp(root, colors) {
  if (!root) return
  const tent = (colors && colors.tent) || {}
  const chairs = (colors && colors.chairs) || {}
  root.traverse(o => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach(m => {
      const slot = m.userData.campSlot
      const kind = m.userData.campKind
      if (!slot || !kind) return
      const hex = kind === 'tent' ? tent[slot] : chairs[slot]
      const orig = m.userData.campOrig
      if (!hex) {
        if (!orig) return
        m.color.set(orig.color)
        m.map = orig.map
      } else {
        m.map = null
        m.color.set(hex)
      }
      m.needsUpdate = true
    })
  })
}

function clipNamed(clips, frag) {
  const f = frag.toLowerCase()
  return (clips || []).find(c => (c.name || '').toLowerCase().includes(f)) || null
}

function treeRadius(t) { return 1.35 + (t.s || 1) * 0.85 }
function rockRadius(r) { return (r.rad || 1) + 0.7 }

function blocked(world, x, z, pad, truck, allowTruck) {
  if (!allowTruck && truck && Math.hypot(x - truck.x, z - truck.z) < 2.55) return true
  if (world.surface(x, z) === SURF.water) return true
  if (world.waterDepth(x, z) > 0.12) return true
  for (const t of world.trees) {
    if (Math.hypot(t.x - x, t.z - z) < treeRadius(t) + pad * 0.35) return true
  }
  for (const r of world.rocks) {
    if (Math.hypot(r.x - x, r.z - z) < rockRadius(r) + pad * 0.25) return true
  }
  if (slopeAt(world, x, z) > 0.34) return true
  return false
}

function clearSpot(world, x, z, pad, truck, allowTruck) {
  if (!blocked(world, x, z, pad, truck, allowTruck)) return { x, z }
  for (let ring = 1; ring <= 9; ring++) {
    const rad = ring * 0.65
    const steps = 6 + ring * 2
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2 + ring
      const px = x + Math.cos(a) * rad
      const pz = z + Math.sin(a) * rad
      if (!blocked(world, px, pz, pad, truck, allowTruck)) return { x: px, z: pz }
    }
  }
  return { x, z }
}

function plant(world, obj, x, z, yaw) {
  const y = world.height(x, z) - 0.02
  obj.position.set(x, y, z)
  obj.rotation.order = 'YXZ'
  obj.rotation.y = yaw || 0
  const e = 0.75
  const hx = world.height(x + e, z) - world.height(x - e, z)
  const hz = world.height(x, z + e) - world.height(x, z - e)
  obj.rotation.x = Math.atan2(hz, e * 2) * 0.85
  obj.rotation.z = -Math.atan2(hx, e * 2) * 0.85
  obj.userData.ground = true
  return obj
}

function faceZ(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z)
}
// Folding chairs face along their local +X.
function faceX(from, to) {
  return Math.atan2(-(to.z - from.z), to.x - from.x)
}

function placeRel(world, fire, right, fwd, rx, fz, pad, truck, allowTruck) {
  const x = fire.x + right.x * rx + fwd.x * fz
  const z = fire.z + right.z * rx + fwd.z * fz
  return clearSpot(world, x, z, pad, truck, allowTruck)
}

function addProp(world, group, src, spot, yaw, sink) {
  const obj = cloneProp(src)
  plant(world, obj, spot.x, spot.z, yaw)
  if (sink) obj.position.y += sink
  group.add(obj)
  return obj
}

function bulbMaterials(root) {
  const mats = []
  root.traverse(o => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach(m => {
      if (m && (m.name || '') === 'bulb_emissive') mats.push(m)
    })
  })
  return mats
}

function glowLantern(root) {
  let best = null
  let bestL = -1
  root.traverse(o => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach(m => {
      if (!m || !m.color || !m.emissive) return
      const l = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11
      if (l > bestL) { bestL = l; best = m }
    })
  })
  if (best) {
    best.emissive.set('#ffb45a')
    best.emissiveIntensity = 0.6
  }
  return best
}

function makeFlames(THREE, low) {
  const n = low ? 16 : 40
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const seeds = []
  for (let i = 0; i < n; i++) {
    seeds.push({
      a: Math.random() * Math.PI * 2,
      r: 0.04 + Math.random() * 0.18,
      h: Math.random(),
      s: 0.45 + Math.random() * 0.9,
      ember: i > n * 0.62
    })
    const ember = seeds[i].ember
    col[i * 3] = 1
    col[i * 3 + 1] = ember ? 0.28 : 0.45 + Math.random() * 0.45
    col[i * 3 + 2] = ember ? 0.05 : 0.08
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.PointsMaterial({
    size: low ? 0.14 : 0.18,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  pts.userData.seeds = seeds
  pts.userData.n = n
  return pts
}

function makeSmoke(THREE, parent, count) {
  const puffs = []
  const geo = new THREE.PlaneGeometry(0.42, 0.42)
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x6a6258, transparent: true, opacity: 0.22, depthWrite: false
    })
    const m = new THREE.Mesh(geo, mat)
    m.position.y = 0.4 + Math.random()
    parent.add(m)
    puffs.push({ m, life: Math.random() })
  }
  return puffs
}

export function buildCampSite(THREE, opts) {
  const { world, truck, camp, low, shadow, pose } = opts
  const scenes = cache.scenes
  const group = new THREE.Group()
  group.name = 'camp'
  const c = pose || truck.position
  const q = pose ? new THREE.Quaternion(pose.qx, pose.qy, pose.qz, pose.qw) : truck.quaternion
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
  const truckXZ = { x: c.x, z: c.z }
  const ideal = {
    x: c.x + right.x * 3.5 + fwd.x * 0.3,
    z: c.z + right.z * 3.5 + fwd.z * 0.3
  }
  const fire = clearSpot(world, ideal.x, ideal.z, 1.05, truckXZ, false)
  const rel = (rx, fz, pad, allow) => placeRel(world, fire, right, fwd, rx, fz, pad, truckXZ, allow)

  const anchor = new THREE.Group()
  plant(world, anchor, fire.x, fire.z, 0)
  const pit = cloneProp(scenes.pit)
  anchor.add(pit)
  let grill = null
  if ((camp.pit || 0) >= 2) {
    grill = cloneProp(scenes.grill)
    grill.position.y = 0.1
    anchor.add(grill)
  }
  const flames = makeFlames(THREE, low)
  flames.position.y = 0.22
  anchor.add(flames)
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xff6a1f, transparent: true, opacity: 0.92, depthWrite: false })
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.62, 6), coreMat)
  core.position.y = 0.48
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.95, depthWrite: false }))
  inner.position.y = 0.4
  anchor.add(core, inner)
  const smoke = low ? [] : makeSmoke(THREE, anchor, 6)
  const fireLight = new THREE.PointLight(0xff7a2a, 5.5, 12, 2)
  fireLight.position.set(0, 0.55, 0)
  fireLight.castShadow = false
  anchor.add(fireLight)
  group.add(anchor)

  const level = camp.tent || 0
  const tentKey = level >= 2 ? 'tent2' : level === 1 ? 'tent1' : 'tent0'
  const tentSpot = rel(-2.55, -0.85, 1.15, false)
  const tent = addProp(world, group, scenes[tentKey], tentSpot, 0)
  tent.rotation.y = faceZ(tentSpot, fire)
  prepareCampPaint(THREE, tent, 'tent')
  if (shadow) tent.traverse(o => { if (o.isMesh) o.castShadow = true })

  const bagSpot = rel(-1.7, -2.9, 0.55, false)
  addProp(world, group, scenes.bag, bagSpot, faceZ(bagSpot, fire) + 0.4)

  if (level >= 1) {
    const packSpot = rel(-3.35, 0.55, 0.4, false)
    addProp(world, group, scenes.pack, packSpot, 0.6)
    const logSpot = rel(-2.9, 1.55, 0.4, false)
    const log = addProp(world, group, scenes.log, logSpot, 1.1)
    const axe = cloneProp(scenes.axe)
    axe.position.set(0.02, 0.1, 0)
    axe.rotation.z = 1.15
    axe.rotation.y = 0.4
    log.add(axe)
  }
  if (level >= 2) {
    addProp(world, group, scenes.cooler, rel(2.15, 1.85, 0.45, false), 0.4)
    addProp(world, group, scenes.wood, rel(-0.4, -2.15, 0.7, false), 0.8)
  }

  let lanternMat = null
  let lanternLight = null
  if ((camp.pit || 0) >= 1) {
    const tableSpot = rel(2.55, -1.35, 1.05, false)
    const table = addProp(world, group, scenes.table, tableSpot, faceZ(tableSpot, fire) + Math.PI / 2)
    const lantern = cloneProp(scenes.lantern)
    ownMaterials(lantern)
    lantern.position.set(0.05, 0.72, 0.62)
    table.add(lantern)
    lanternMat = glowLantern(lantern)
    lanternLight = new THREE.PointLight(0xffc88a, 0.8, 5.5, 2)
    lanternLight.position.set(0, 0.18, 0)
    lantern.add(lanternLight)
    const stove = cloneProp(scenes.stove)
    stove.position.set(-0.02, 0.72, -0.42)
    table.add(stove)
    const propaneSpot = rel(3.15, -0.35, 0.35, false)
    addProp(world, group, scenes.propane, propaneSpot, 0.2)
  }

  if (camp.chairs) {
    const spots = [rel(-1.35, 1.85, 0.4, false), rel(1.15, 2.05, 0.4, false)]
    for (const s of spots) {
      const chair = addProp(world, group, scenes.chair, s, faceX(s, fire))
      prepareCampPaint(THREE, chair, 'chair')
      if (shadow) chair.traverse(o => { if (o.isMesh) o.castShadow = true })
    }
  }

  let bulbs = []
  let stringLight = null
  if (camp.lights) {
    const a = tentSpot
    const b = rel(2.2, -1.2, 0.3, false)
    const mid = clearSpot(world, (a.x + b.x) / 2, (a.z + b.z) / 2, 0.35, truckXZ, false)
    const lights = addProp(world, group, scenes.lights, mid, faceZ(a, b))
    bulbs = bulbMaterials(lights)
    stringLight = new THREE.PointLight(0xffe1a8, 0, 7, 2)
    stringLight.position.y = 1.7
    lights.add(stringLight)
  }

  let roof = null
  if (level >= 3) {
    roof = cloneProp(scenes.roof)
    roof.userData.roof = true
    roof.rotation.y = Math.PI
    prepareCampPaint(THREE, roof, 'tent')
    if (shadow) roof.traverse(o => { if (o.isMesh) o.castShadow = true })
    const tarpSpot = clearSpot(
      world,
      c.x - right.x * 4.6 + fwd.x * 2.1,
      c.z - right.z * 4.6 + fwd.z * 2.1,
      1.15,
      truckXZ,
      true
    )
    const away = { x: tarpSpot.x - c.x, z: tarpSpot.z - c.z }
    addProp(world, group, scenes.tarp, tarpSpot, Math.atan2(away.x, away.z))
  }

  function attachRoof(nextTruck) {
    if (!roof) return
    if (roof.parent) roof.parent.remove(roof)
    const body = nextTruck.getObjectByName('body') || nextTruck
    body.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(body)
    if (!Number.isFinite(box.max.y)) return
    const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.02, (box.min.z + box.max.z) / 2 - 0.2)
    nextTruck.worldToLocal(top)
    roof.position.copy(top)
    roof.rotation.set(0, Math.PI, 0)
    roof.userData.roof = true
    nextTruck.add(roof)
  }
  attachRoof(truck)

  const tmp = new THREE.Vector3()
  function tick(dt, dark, camera) {
    const time = performance.now() * 0.001
    fireLight.intensity = (dark ? 7.2 : 4.4) + Math.sin(time * 11) * 0.55 + Math.random() * 0.4
    const flicker = 0.85 + Math.sin(time * 17) * 0.12 + Math.sin(time * 9) * 0.08
    core.scale.set(0.85 + Math.sin(time * 13) * 0.12, flicker, 0.85 + Math.cos(time * 15) * 0.1)
    inner.scale.set(1, 0.75 + Math.sin(time * 21) * 0.18, 1)
    const seeds = flames.userData.seeds
    const arr = flames.geometry.attributes.position.array
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      const h = (s.h + time * s.s * (s.ember ? 0.55 : 1)) % 1
      const rise = s.ember ? 0.35 + h * 1.35 : h * 0.95
      const rad = s.r * (s.ember ? 1.4 : (1 - h * 0.75))
      arr[i * 3] = Math.cos(s.a + time * 0.6) * rad
      arr[i * 3 + 1] = rise
      arr[i * 3 + 2] = Math.sin(s.a + time * 0.6) * rad
    }
    flames.geometry.attributes.position.needsUpdate = true
    for (const p of smoke) {
      p.life += dt * 0.18
      if (p.life > 1) p.life -= 1
      const u = p.life
      p.m.position.set(Math.sin(u * 6) * 0.18, 0.45 + u * 1.7, Math.cos(u * 5) * 0.15)
      p.m.scale.setScalar(0.45 + u * 1.3)
      p.m.material.opacity = (1 - u) * 0.28
      if (camera) {
        p.m.getWorldPosition(tmp)
        p.m.lookAt(camera.position)
      }
    }
    const bulbI = dark ? 2.8 : 0.45
    for (const m of bulbs) m.emissiveIntensity = bulbI
    if (stringLight) stringLight.intensity = dark ? 1.6 : 0.15
    if (lanternMat) lanternMat.emissiveIntensity = dark ? 1.7 : 0.45
    if (lanternLight) lanternLight.intensity = dark ? 2.1 : 0.45
  }

  function repaint(colors) {
    paintCamp(group, colors)
    if (roof) paintCamp(roof, colors)
  }
  if (opts.colors) repaint(opts.colors)

  function audit() {
    const issues = []
    group.traverse(o => {
      if (!o.userData || !o.userData.ground) return
      const x = o.position.x
      const z = o.position.z
      const ground = world.height(x, z)
      const float = o.position.y - ground
      if (float > 0.12 || float < -0.2) issues.push({ name: o.name || 'prop', float: +float.toFixed(3) })
      if (world.surface(x, z) === SURF.water || world.waterDepth(x, z) > 0.2) issues.push({ name: 'water', x, z })
      for (const t of world.trees) {
        if (Math.hypot(t.x - x, t.z - z) < treeRadius(t) * 0.72) issues.push({ name: 'tree', x: +x.toFixed(1), z: +z.toFixed(1) })
      }
      for (const r of world.rocks) {
        if (Math.hypot(r.x - x, r.z - z) < (r.rad || 1) * 0.85) issues.push({ name: 'rock', x: +x.toFixed(1), z: +z.toFixed(1) })
      }
    })
    return { ok: issues.length === 0, issues, fire }
  }

  return { group, fire, roof, attachRoof, tick, audit, anchor, repaint }
}

export function fishStage(world, x, z) {
  const cands = []
  const consider = (stand, water) => {
    if (!stand) return
    const dist = Math.hypot(stand.x - x, stand.z - z)
    if (dist > 72) return
    cands.push({ stand, water, slope: slopeAt(world, stand.x, stand.z), dist })
  }
  const lake = world.lakeAt(x, z, 90)
  if (lake) {
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const ux = Math.cos(a)
      const uz = Math.sin(a)
      let bank = null
      for (let d = lake.r + 2.4; d > lake.r - 4; d -= 0.65) {
        const px = lake.x + ux * d
        const pz = lake.z + uz * d
        if (world.surface(px, pz) !== SURF.water && world.waterDepth(px, pz) < 0.05) { bank = { x: px, z: pz }; break }
      }
      if (bank) consider(bank, { x: lake.x + ux * Math.max(1.6, lake.r - 3.2), z: lake.z + uz * Math.max(1.6, lake.r - 3.2) })
    }
  }
  for (const dx of [-16, -6, 0, 6, 16]) {
    const px = x + dx
    const rz = world.riverZ(px)
    if (Math.abs(z - rz) > 58) continue
    const side = z >= rz ? 1 : -1
    let bank = null
    for (let d = 1.4; d <= 16; d += 0.55) {
      const pz = rz + side * d
      if (world.surface(px, pz) !== SURF.water && world.waterDepth(px, pz) < 0.05) { bank = { x: px, z: pz }; break }
    }
    if (bank) consider(bank, { x: px, z: rz + side * 2.1 })
  }
  cands.sort((a, b) => a.slope - b.slope || a.dist - b.dist)
  return cands[0] || { stand: { x: x + 2.5, z }, water: { x: x + 6, z }, slope: 1 }
}

function waterY(world, x, z) {
  return world.height(x, z)
}

export function buildFishMoment(THREE, opts) {
  const { world, x, z } = opts
  const scenes = cache.scenes
  const clips = cache.clips
  const group = new THREE.Group()
  group.name = 'fish-moment'
  const stage = fishStage(world, x, z)
  const { stand, water } = stage
  const yaw = Math.atan2(water.x - stand.x, water.z - stand.z)
  if ((stage.slope || 0) < 0.2) {
    const dock = cloneProp(scenes.dock)
    plant(world, dock, stand.x, stand.z, yaw)
    dock.position.y -= 0.78
    group.add(dock)
  }
  const rod = cloneProp(scenes.rod)
  plant(world, rod, stand.x, stand.z, yaw)
  rod.rotation.order = 'YXZ'
  rod.rotation.set(1.2, yaw, 0)
  rod.position.y += 0.22
  group.add(rod)
  const tip = new THREE.Object3D()
  tip.position.set(0, 2.02, 0)
  rod.add(tip)
  const bobber = cloneProp(scenes.bobber)
  bobber.scale.setScalar(7)
  group.add(bobber)
  const bucket = cloneProp(scenes.bucket)
  const bpos = { x: stand.x - Math.cos(yaw) * 0.7, z: stand.z + Math.sin(yaw) * 0.7 }
  plant(world, bucket, bpos.x, bpos.z, yaw)
  group.add(bucket)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3))
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xe8e4dc }))
  line.frustumCulled = false
  group.add(line)
  const trout = cloneProp(scenes.trout)
  trout.visible = false
  group.add(trout)
  const swimmer = cloneAnimated(scenes.fish)
  swimmer.visible = false
  group.add(swimmer)
  const mix = new THREE.AnimationMixer(swimmer)
  const swim = clipNamed(clips.fish, 'swim')
  if (swim) mix.clipAction(swim).play()
  const tmp = new THREE.Vector3()
  const tipW = new THREE.Vector3()
  const bobW = new THREE.Vector3()
  let shown = null

  function tick(dt, play) {
    mix.update(dt)
    tip.getWorldPosition(tipW)
    const fly = play.phase === 'cast' ? 0 : Math.min(1, (play.fly = (play.fly || 0) + dt * 1.8))
    const wx = stand.x + (water.x - stand.x) * (0.35 + fly * 0.65)
    const wz = stand.z + (water.z - stand.z) * (0.35 + fly * 0.65)
    let dip = Math.sin(performance.now() * 0.003) * 0.035
    if (play.phase === 'bite') dip = -0.14 + Math.sin(performance.now() * 0.02) * 0.04
    if (play.phase === 'reel') {
      const band = Math.max(0.08, (play.band || 0.2))
      const tension = 1 - Math.min(1, Math.abs((play.mark || 0) - (play.zone || 0.5)) / band)
      dip = -0.04 - (1 - tension) * 0.18
      play.tension = tension
    }
    const y = waterY(world, wx, wz) + 0.08 + dip
    bobber.position.set(wx, y, wz)
    bobber.getWorldPosition(bobW)
    const mid = tipW.clone().lerp(bobW, 0.5)
    mid.y -= 0.25 + (1 - fly) * 0.2
    const arr = line.geometry.attributes.position
    arr.setXYZ(0, tipW.x, tipW.y, tipW.z)
    arr.setXYZ(1, mid.x, mid.y, mid.z)
    arr.setXYZ(2, bobW.x, bobW.y, bobW.z)
    arr.needsUpdate = true
    if (play.phase === 'land') {
      const model = play.fishId === 'trout' ? trout : swimmer
      if (shown !== model) {
        if (shown) shown.visible = false
        shown = model
        model.visible = true
      }
      const u = Math.min(1, (play.landT || 0) / 1.05)
      model.position.set(
        bobW.x + (bucket.position.x - bobW.x) * u,
        bobW.y + Math.sin(u * Math.PI) * 1.15 + (bucket.position.y + 0.32 - bobW.y) * u,
        bobW.z + (bucket.position.z - bobW.z) * u
      )
      model.rotation.y += dt * 2
      model.rotation.z = u * 1.4
    }
  }

  function focus(camera) {
    const dirx = water.x - stand.x
    const dirz = water.z - stand.z
    const len = Math.hypot(dirx, dirz) || 1
    camera.position.set(
      stand.x - (dirx / len) * 1.7 + Math.cos(yaw) * 2.5,
      world.height(stand.x, stand.z) + 1.45,
      stand.z - (dirz / len) * 1.7 - Math.sin(yaw) * 2.5
    )
    tmp.set(water.x, waterY(world, water.x, water.z) + 0.2, water.z)
    camera.lookAt(tmp)
  }

  function dispose() { mix.stopAllAction() }
  return { group, tick, focus, dispose, stand, water }
}

export function buildHuntMoment(THREE, opts) {
  const { world, x, z, right, fwd, animals, kit } = opts
  const scenes = cache.scenes
  const clips = cache.clips
  const group = new THREE.Group()
  group.name = 'hunt-moment'
  const dirs = [fwd, right, { x: -fwd.x, z: -fwd.z }, { x: -right.x, z: -right.z }]
  let look = fwd
  let best = -1
  for (const d of dirs) {
    let ok = 0
    for (let i = 2; i <= 6; i++) {
      const px = x + d.x * i * 2
      const pz = z + d.z * i * 2
      if (world.surface(px, pz) !== SURF.water && world.waterDepth(px, pz) < 0.08 && slopeAt(world, px, pz) < 0.3) ok++
    }
    if (ok > best) { best = ok; look = d }
  }
  const across = { x: -look.z, z: look.x }
  const origin = {
    x: x + look.x * 12,
    z: z + look.z * 12
  }
  const span = 12
  function pointAt(t) {
    const px = origin.x + across.x * (t - 0.5) * span
    const pz = origin.z + across.z * (t - 0.5) * span
    return { x: px, y: world.height(px, pz), z: pz }
  }
  const markers = [0.08, 0.5, 0.92]
  markers.forEach((t, i) => {
    const p = pointAt(t)
    const key = i === 1 ? 'sign' : i === 0 ? 'post' : 'cairn'
    const m = cloneProp(scenes[key])
    plant(world, m, p.x, p.z, Math.atan2(look.x, look.z))
    group.add(m)
  })
  const actors = []
  const mixers = []
  animals.forEach(a => {
    const model = scenes[a.model] ? a.model : 'fox'
    const animated = model === 'doe' || model === 'stag' || model === 'fox'
    const node = animated ? cloneAnimated(scenes[model]) : cloneProp(scenes[model])
    if (FOOT[model]) node.position.y = -FOOT[model]
    const holder = new THREE.Group()
    holder.add(node)
    group.add(holder)
    if (animated) {
      const mixer = new THREE.AnimationMixer(node)
      const clip = clipNamed(clips[model], 'walk') || clipNamed(clips[model], 'idle')
      if (clip) mixer.clipAction(clip).play()
      mixers.push(mixer)
    }
    actors.push({ a, holder, model })
  })
  const toolKey = kit >= 2 ? 'camera' : 'binoculars'
  const tool = cloneProp(scenes[toolKey])
  tool.scale.setScalar(kit >= 2 ? 1.4 : 2.2)
  const stand = pointAt(0.5)
  plant(world, tool, stand.x - look.x * 1.4, stand.z - look.z * 1.4, Math.atan2(look.x, look.z))
  group.add(tool)
  const sight = new THREE.Vector3()
  const aim = new THREE.Vector3()

  function tick(dt, play, camera) {
    mixers.forEach(m => m.update(dt))
    for (const actor of actors) {
      const p = pointAt(actor.a.x)
      actor.holder.position.set(p.x, p.y, p.z)
      const ahead = pointAt(Math.min(1.05, actor.a.x + 0.05))
      actor.holder.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z)
    }
    const s = pointAt(play.mark || 0.5)
    sight.set(s.x, s.y + 0.85, s.z)
    if (camera) {
      aim.copy(sight).project(camera)
      play.aimX = (aim.x * 0.5 + 0.5) * 100
      play.aimY = (-aim.y * 0.5 + 0.5) * 100
    }
  }

  function focus(camera) {
    const back = pointAt(0.5)
    camera.position.set(
      back.x - look.x * 6.2,
      back.y + 1.7,
      back.z - look.z * 6.2
    )
    camera.lookAt(back.x, back.y + 0.85, back.z)
  }

  function dispose() {
    mixers.forEach(m => m.stopAllAction())
  }
  return { group, tick, focus, dispose }
}

function foodTint(root, brown, burnt) {
  root.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.color || o.userData.keep) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach(m => {
      if (!m.userData.base) m.userData.base = m.color.clone()
      const done = m.userData.base.clone().lerp(new m.color.constructor('#6a3414'), 0.82)
      const char = new m.color.constructor('#1c1410')
      if (burnt) m.color.copy(char)
      else m.color.copy(m.userData.base).lerp(done, Math.max(0, Math.min(1, brown)))
    })
  })
}

export function buildCookMoment(THREE, opts) {
  const { world, fire } = opts
  const scenes = cache.scenes
  const group = new THREE.Group()
  group.name = 'cook-moment'
  const anchor = new THREE.Group()
  plant(world, anchor, fire.x, fire.z, 0)
  const pit = cloneProp(scenes.pit)
  anchor.add(pit)
  const grill = cloneProp(scenes.grill)
  grill.position.y = 0.1
  anchor.add(grill)
  const flames = makeFlames(THREE, true)
  flames.material.size = 0.07
  flames.material.opacity = 0.8
  flames.position.y = 0.16
  anchor.add(flames)
  const skillet = cloneProp(scenes.skillet)
  skillet.position.set(0.02, 0.34, 0.02)
  skillet.rotation.y = 0.6
  anchor.add(skillet)
  const pot = cloneProp(scenes.pot)
  pot.position.set(-0.02, 0.36, 0)
  pot.visible = false
  anchor.add(pot)
  const food = new THREE.Group()
  food.position.set(0.02, 0.4, 0.04)
  anchor.add(food)
  const steamN = 18
  const steamPos = new Float32Array(steamN * 3)
  const steamGeo = new THREE.BufferGeometry()
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3))
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({
    color: 0xf4efe6, size: 0.08, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true
  }))
  steam.position.y = 0.15
  steam.frustumCulled = false
  food.add(steam)
  group.add(anchor)
  let recipeId = ''

  function showRecipe(id) {
    recipeId = id || ''
    food.clear()
    // clear() drops steam. Put it back after rebuilding food.
    const add = (key, x, y, z, s) => {
      const m = cloneProp(scenes[key])
      ownMaterials(m)
      m.position.set(x, y, z)
      m.scale.setScalar(s)
      food.add(m)
      return m
    }
    if (id === 'stew') {
      pot.visible = true
      skillet.visible = false
      add('corn', 0.28, 0.02, 0.05, 0.9)
    } else {
      pot.visible = false
      skillet.visible = true
      if (id === 'breakfast') {
        add('steak', -0.04, 0.04, 0.02, 2.6)
        add('sausage', 0.12, 0.05, -0.05, 2.4)
        add('sausage', 0.1, 0.05, 0.08, 2.4)
        add('corn', 0.24, 0.04, 0.1, 1.1)
      } else if (id === 'pan') {
        add('fillet', 0, 0.04, 0, 2.4)
        add('can', 0.18, 0.03, -0.08, 2.2)
      } else {
        add('fillet', 0, 0.04, 0, 2.6)
      }
    }
    food.add(steam)
  }

  function tick(dt, play) {
    const time = performance.now() * 0.001
    const seeds = flames.userData.seeds
    const arr = flames.geometry.attributes.position.array
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      const h = (s.h + time * s.s) % 1
      arr[i * 3] = Math.cos(s.a) * s.r * (1 - h)
      arr[i * 3 + 1] = h * 0.7
      arr[i * 3 + 2] = Math.sin(s.a) * s.r * (1 - h)
    }
    flames.geometry.attributes.position.needsUpdate = true
    if (play.recipe && play.recipe !== recipeId && play.phase !== 'pick') showRecipe(play.recipe)
    if (play.phase === 'heat' || play.phase === 'done') {
      play.brown = Math.min(1, (play.brown || 0) + dt * 0.16)
      foodTint(food, play.phase === 'done' && play.grade === 'burnt' ? 1 : play.brown, play.phase === 'done' && play.grade === 'burnt')
      const puff = Math.max(0, (play.brown || 0) - 0.35)
      steam.visible = puff > 0.05
      const sp = steam.geometry.attributes.position.array
      for (let i = 0; i < steamN; i++) {
        const u = (time * 0.35 + i / steamN) % 1
        sp[i * 3] = Math.sin(i + time) * 0.05
        sp[i * 3 + 1] = u * 0.45 * (0.4 + puff)
        sp[i * 3 + 2] = Math.cos(i * 1.3) * 0.05
      }
      steam.geometry.attributes.position.needsUpdate = true
      steam.material.opacity = 0.15 + puff * 0.45
    }
    if (play.flipT > 0) {
      play.flipT = Math.max(0, play.flipT - dt)
      food.rotation.x = Math.sin((1 - play.flipT / 0.35) * Math.PI) * Math.PI
    } else if (play.phase !== 'done') food.rotation.x = 0
  }

  function focus(camera) {
    const y = world.height(fire.x, fire.z)
    camera.position.set(fire.x + 0.72, y + 0.62, fire.z + 0.78)
    camera.lookAt(fire.x, y + 0.3, fire.z)
  }
  function dispose() {}
  return { group, tick, focus, dispose, showRecipe }
}

export function buildRoastMoment(THREE, opts) {
  const { world, fire } = opts
  const group = new THREE.Group()
  group.name = 'roast-moment'
  const y0 = world.height(fire.x, fire.z)
  const sugar = new THREE.MeshBasicMaterial({ color: 0xf4efe6 })
  const wood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.01, 0.72, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.84 })
  )
  wood.rotation.z = Math.PI / 2
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.09, 16), sugar)
  const capA = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), sugar)
  const capB = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), sugar)
  capA.position.y = 0.044
  capB.position.y = -0.044
  const mallow = new THREE.Group()
  mallow.add(body, capA, capB)
  mallow.position.x = 0.36
  const stick = new THREE.Group()
  stick.add(wood, mallow)
  group.add(stick)
  const flame = makeFlames(THREE, true)
  flame.material.size = 0.05
  flame.scale.setScalar(0.28)
  flame.position.set(0.36, 0.1, 0)
  flame.visible = false
  stick.add(flame)
  const puffGeo = new THREE.PlaneGeometry(0.12, 0.12)
  const puffs = []
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xc8c2b8, transparent: true, opacity: 0, depthWrite: false })
    const m = new THREE.Mesh(puffGeo, mat)
    m.visible = false
    mallow.add(m)
    puffs.push({ m, life: 0 })
  }
  const restTip = new THREE.Vector3(fire.x + 0.62, y0 + 0.5, fire.z + 0.28)
  const hotTip = new THREE.Vector3(fire.x + 0.06, y0 + 0.4, fire.z + 0.04)
  const tip = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const axis = new THREE.Vector3(1, 0, 0)
  const color = new THREE.Color()

  function tick(dt, play) {
    const near = Math.max(0, Math.min(1, play.near || 0))
    tip.copy(restTip).lerp(hotTip, near)
    dir.copy(hotTip).sub(restTip)
    if (dir.lengthSq() < 1e-6) dir.set(-1, -0.2, -1)
    dir.normalize()
    stick.position.copy(tip).addScaledVector(dir, -0.36)
    stick.quaternion.setFromUnitVectors(axis, dir)
    color.set(roastColor(play.onFire ? Math.min(1, (play.heat || 0) + 0.2) : (play.heat || 0)))
    sugar.color.copy(color)
    flame.visible = !!play.onFire
    if (play.onFire) {
      const time = performance.now() * 0.001
      const seeds = flame.userData.seeds
      const arr = flame.geometry.attributes.position.array
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i]
        const h = (s.h + time * s.s * 1.4) % 1
        arr[i * 3] = Math.cos(s.a + time) * s.r * (1 - h) * 0.45
        arr[i * 3 + 1] = h * 0.22
        arr[i * 3 + 2] = Math.sin(s.a + time) * s.r * (1 - h) * 0.45
      }
      flame.geometry.attributes.position.needsUpdate = true
    }
    const smoking = play.onFire || (play.smoke || 0) > 0 || (play.heat || 0) > 0.4
    if (play.smoke > 0) play.smoke = Math.max(0, play.smoke - dt)
    puffs.forEach((p, i) => {
      if (!smoking) { p.m.visible = false; return }
      p.life += dt * (play.onFire ? 0.9 : 0.45)
      if (p.life > 1) p.life -= 1
      const u = p.life
      p.m.visible = true
      p.m.position.set(Math.sin(i + u * 4) * 0.03, 0.05 + u * 0.22, Math.cos(i) * 0.03)
      p.m.scale.setScalar(0.4 + u * 1.4)
      p.m.material.opacity = (1 - u) * (play.onFire ? 0.55 : 0.28)
      p.m.lookAt(restTip.x, restTip.y + 0.4, restTip.z)
    })
  }

  function focus(camera) {
    const y = world.height(fire.x, fire.z)
    camera.position.set(fire.x + 0.15, y + 0.58, fire.z + 1.15)
    camera.lookAt(fire.x + 0.22, y + 0.44, fire.z + 0.12)
  }
  function dispose() {}
  return { group, tick, focus, dispose }
}
