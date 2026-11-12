// Oxbow — Hollow Creek. OFFROAD_V7_1
import * as THREE from '../vendor/three.module.js'
import { createWorld, WORLD_SIZE, HALF, SURF, SURF_NAME } from './world.js'
import { OFFROAD_V2, OFFROAD_V3, OFFROAD_V4, OFFROAD_V4_1, OFFROAD_V5, OFFROAD_V5_1, OFFROAD_V6, OFFROAD_V7, OFFROAD_V7_1, freshSave, SAVE_KEY, VEHICLES, UPGRADES, AUX, JERRY, ADVENTURES, TANK, coerceSave, buyUpgrade, buyVehicle, buyAux, buyJerry, useJerry, refuel, burnFuel, specWithUpgrades, tankCapacity, jerrySlots, rankFor, isDark, clockLabel, tickAdventure, noteAssist, REGION_OPEN, regionUnlocked, crawlAngles } from './economy.js'
import { preloadRigs, buildRig, applyLod } from './rigs.js'
import { CAMP, campLevel, buyCamp, canPitch, rollFish, reelBand, biteSeconds, aimHit, RECIPES, canCook, cookJudge, applyCook, activityState, gameFor } from './camp.js'
import { createSim, ROLL_LIMIT, recoveryCopy } from './physics.js'

export { OFFROAD_V2, OFFROAD_V3, OFFROAD_V4, OFFROAD_V4_1, OFFROAD_V5, OFFROAD_V5_1, OFFROAD_V6, OFFROAD_V7, OFFROAD_V7_1 }

const world = createWorld(1)
const yard = world.pois.find(p => p.id === 'yard')
const sim = createSim(world)
const $ = id => document.getElementById(id)
const app = $('app')

const GFX = {
  low: { seg: 96, trees: 240, shadow: 0, dust: false, dpr: 1, fog: 160, aa: false },
  medium: { seg: 140, trees: 520, shadow: 1024, dust: true, dpr: 1.35, fog: 230, aa: false },
  high: { seg: 180, trees: 829, shadow: 2048, dust: true, dpr: 1.85, fog: 320, aa: true }
}
function defaultGfx() {
  const coarse = matchMedia('(pointer: coarse)').matches
  return coarse ? 'medium' : 'high'
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return coerceSave(JSON.parse(raw), defaultGfx())
  } catch (e) { return null }
}
let save = loadSave() || freshSave({ settings: { gfx: defaultGfx(), tilt: false, sound: true, shake: true, cycle: 8 } })
let mode = 'title'
let camMode = 'chase'
let lockOn = false
let lowOn = false
let throttleSm = 0
let hazard = { stuck: '', mud: 0, water: 0, sink: 0, wade: 0.7, bogAt: 0.6 }
let recovery = null
let anchor = null
let freeze = false
let lastSpeed = 0
let lastSurf = 0
let lastRegion = ''
let steerSm = 0
let orbit = 0.8
let orbitYaw = 0.4
let orbitPitch = 0.35
let orbitDist = 11
let dprScale = 1
let adaptAcc = 0
let saveAcc = 0
let wiped = false
let holdCam = false
const keys = { w: 0, s: 0, a: 0, d: 0, space: 0, f: 0 }
const pad = { gas: 0, brake: 0, left: 0, right: 0, winch: 0, hand: 0 }
let tiltV = 0

const gfx = () => GFX[save.settings.gfx] || GFX.medium
const canvas = $('view')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: gfx().aa, powerPreference: 'high-performance', stencil: false })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.02
renderer.setPixelRatio(Math.min(gfx().dpr, window.devicePixelRatio || 1))
renderer.shadowMap.enabled = gfx().shadow > 0
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(58, 1, 0.18, 900)
const sun = new THREE.DirectionalLight(0xffb068, 2.2)
sun.castShadow = gfx().shadow > 0
if (gfx().shadow) {
  sun.shadow.mapSize.set(gfx().shadow, gfx().shadow)
  sun.shadow.camera.near = 2
  sun.shadow.camera.far = 90
  sun.shadow.bias = -0.0004
}
scene.add(sun, sun.target)
const hemi = new THREE.HemisphereLight(0xffd0a8, 0x3a2a22, 0.55)
scene.add(hemi)
const fill = new THREE.DirectionalLight(0xffe2c4, 0.7)
fill.position.set(30, 24, -40)
scene.add(fill)
const rim = new THREE.DirectionalLight(0xffb27a, 0.8)
rim.position.set(-22, 14, 28)
scene.add(rim)
rim.target.position.set(0, 0, 0)
scene.add(rim.target)
function buildEnvironment() {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envScene = new THREE.Scene()
    const skyGeo = new THREE.SphereGeometry(12, 24, 14)
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float h = d.y;
          vec3 top = vec3(0.52, 0.7, 0.95);
          vec3 hor = vec3(1.0, 0.68, 0.36);
          vec3 ground = vec3(0.48, 0.28, 0.16);
          vec3 col = mix(hor, top, smoothstep(0.0, 0.55, h));
          col = mix(ground, col, smoothstep(-0.4, 0.08, h));
          float sunD = pow(max(dot(d, normalize(vec3(0.45, 0.32, 0.84))), 0.0), 26.0);
          col += vec3(1.0, 0.86, 0.62) * sunD * 1.6;
          gl_FragColor = vec4(col, 1.0);
        }`
    })
    envScene.add(new THREE.Mesh(skyGeo, envMat))
    const tex = pmrem.fromScene(envScene, 0.04).texture
    pmrem.dispose()
    skyGeo.dispose()
    envMat.dispose()
    return tex
  } catch (e) {
    return null
  }
}
const envTex = buildEnvironment()
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  toneMapped: false,
  uniforms: {
    sun: { value: new THREE.Vector3(0, 0.2, 0) },
    elev: { value: 0.6 },
    top: { value: new THREE.Color('#4a739c') },
    hor: { value: new THREE.Color('#c5d5d8') },
    grd: { value: new THREE.Color('#1e3328') },
    sunCol: { value: new THREE.Color('#ffb068') }
  },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    varying vec3 vP; uniform vec3 sun; uniform float elev;
    uniform vec3 top; uniform vec3 hor; uniform vec3 grd; uniform vec3 sunCol;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 d = normalize(vP);
      float h = clamp(d.y, -0.05, 1.0);
      float day = smoothstep(-0.05, 0.35, elev);
      vec3 col = mix(grd, hor, smoothstep(-0.08, 0.12, h));
      col = mix(col, top, smoothstep(0.02, 0.62, h));
      float sd = pow(max(dot(d, normalize(sun)), 0.0), mix(28.0, 80.0, day));
      col += sunCol * sd * (0.55 + smoothstep(-0.2, 0.25, elev));
      vec3 moon = normalize(vec3(-sun.x, max(0.15, -sun.y), -sun.z));
      float md = pow(max(dot(d, moon), 0.0), 280.0);
      col += vec3(0.75, 0.84, 1.0) * md * (1.0 - day);
      float star = step(0.997, hash(floor(d.xz * 220.0 + d.y * 40.0)));
      col += star * (1.0 - day) * step(0.08, d.y);
      gl_FragColor = vec4(col, 1.0);
    }`
})
const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), skyMat)
scene.add(sky)
const moon = new THREE.DirectionalLight(0xb9c7ff, 0)
scene.add(moon, moon.target)
const starPos = []
for (let i = 0; i < (gfx().shadow ? 420 : 180); i++) {
  const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 0.85 + 0.08, Math.random() * 2 - 1).normalize().multiplyScalar(470)
  starPos.push(v.x, v.y, v.z)
}
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }))
scene.add(stars)
scene.fog = new THREE.Fog(0xe39a6a, 28, gfx().fog)

const LOOK = {
  forest: {
    day: ['#4a739c', '#c9ddd6', '#1c3328', '#9bb8ae', '#fff6e4', '#d7ebe4', '#1d3328'],
    dusk: ['#2a3c58', '#e88848', '#142018', '#c46a3c', '#ffb060', '#ffd0a4', '#241c14'],
    night: ['#070c16', '#121820', '#050806', '#070c14', '#9eb4ff', '#1a2744', '#0c100e'],
    ground: ['#3e6240', '#7a6244', '#3c3428', '#c6b48a', '#667064', '#246878'],
    map: [46, 92, 58]
  },
  desert: {
    day: ['#7eb4d6', '#f3c49a', '#c47a52', '#e7c2a0', '#ffe0b0', '#ffd8b4', '#a86848'],
    dusk: ['#5a3a52', '#f0a060', '#8a4030', '#e09058', '#ff9040', '#ffc098', '#6a3028'],
    night: ['#140c18', '#2a1820', '#120c0c', '#100c10', '#c8b8e8', '#2a2038', '#1a100c'],
    ground: ['#c47a52', '#d2a06a', '#8a5840', '#e8c8a0', '#b15a42', '#3c92a0'],
    map: [186, 116, 74]
  },
  mountain: {
    day: ['#6a92c4', '#d5e2ee', '#8a949e', '#c5d2de', '#fff6ea', '#dce8f2', '#6a727c'],
    dusk: ['#2a3c5c', '#f0b080', '#5a6068', '#c88868', '#ffc090', '#f0d0c0', '#4a5058'],
    night: ['#060810', '#121820', '#0c1014', '#080c12', '#b0c4ff', '#1a2438', '#101418'],
    ground: ['#6d786c', '#8a7c68', '#4a4840', '#d4d0c8', '#8e96a0', '#1c8e98'],
    map: [118, 132, 150]
  }
}
const SNOW = new THREE.Color('#f4f7fb')
const FOAM = new THREE.Color('#e7f1f2')
function mixHex(list, w) {
  const c = new THREE.Color(0, 0, 0)
  const f = new THREE.Color()
  c.add(f.set(list.forest).multiplyScalar(w.forest))
  c.add(f.set(list.desert).multiplyScalar(w.desert))
  c.add(f.set(list.mountain).multiplyScalar(w.mountain))
  return c
}
function groundColor(x, z, surf, h) {
  const w = world.blend(x, z)
  const painted = surf === SURF.water && world.lakeAt(x, z) ? SURF.sand : surf
  const key = ['forest', 'desert', 'mountain']
  const c = new THREE.Color(0, 0, 0)
  for (const id of key) c.add(new THREE.Color(LOOK[id].ground[painted] || LOOK[id].ground[0]).multiplyScalar(w[id]))
  const nearLake = world.lakeAt(x, z, 36)
  if (nearLake && surf !== SURF.water) c.lerp(new THREE.Color(nearLake.region === 'desert' ? '#e0c09a' : '#8d959e'), 0.8)
  const edge = Math.max(Math.abs(x), Math.abs(z)) > HALF - 48
  if (!edge && !nearLake && w.mountain > 0.45 && h > 18 && surf !== SURF.water) {
    const snow = Math.min(1, (h - 16) / 7) * w.mountain
    c.lerp(SNOW, snow * 0.9)
  }
  return c
}
function buildTerrain() {
  const seg = gfx().seg
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const h = world.height(x, z)
    pos.setY(i, h)
    const c = groundColor(x, z, world.surface(x, z), h)
    const n = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1
    const shade = 0.84 + n * 0.24
    colors[i * 3] = c.r * shade
    colors[i * 3 + 1] = c.g * shade
    colors[i * 3 + 2] = c.b * shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }))
  mesh.receiveShadow = gfx().shadow > 0
  scene.add(mesh)
  const water = []
  const waterCol = []
  const n = world.gridN
  const es = WORLD_SIZE / (n - 1)
  const shore = (i, j) => {
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) return true
      if (world.surf[jj * n + ii] !== 5) return true
    }
    return false
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (world.surf[j * n + i] !== 5) continue
      const wx = -HALF + (i / (n - 1)) * WORLD_SIZE
      const wz = HALF - (j / (n - 1)) * WORLD_SIZE
      if (world.lakeAt(wx, wz)) continue
      const x = wx
      const z = wz
      const y = world.heights[j * n + i] + 0.35
      const col = groundColor(x, z, SURF.water, y)
      if (shore(i, j)) col.lerp(FOAM, 0.42)
      water.push(x - es * 0.5, y, z - es * 0.5, x + es * 0.5, y, z - es * 0.5, x + es * 0.5, y, z + es * 0.5)
      water.push(x - es * 0.5, y, z - es * 0.5, x + es * 0.5, y, z + es * 0.5, x - es * 0.5, y, z + es * 0.5)
      for (let k = 0; k < 6; k++) waterCol.push(col.r, col.g, col.b)
    }
  }
  const wg = new THREE.BufferGeometry()
  wg.setAttribute('position', new THREE.Float32BufferAttribute(water, 3))
  wg.setAttribute('color', new THREE.Float32BufferAttribute(waterCol, 3))
  wg.computeVertexNormals()
  const wmesh = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, opacity: 0.78, roughness: 0.18, metalness: 0.08, depthWrite: false
  }))
  scene.add(wmesh)
  for (const lake of world.lakes) {
    const y = (lake.bed || 4) + 0.12
    const tone = lake.region === 'mountain' ? 0x178f98 : 0x3aa8a4
    const radius = lake.r * (lake.region === 'mountain' ? 0.58 : 0.78)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 36), new THREE.MeshStandardMaterial({ color: tone, transparent: true, opacity: 0.92, roughness: 0.08, metalness: 0.16, depthWrite: false }))
    disc.rotation.x = -Math.PI / 2
    disc.position.set(lake.x, y, lake.z)
    const foam = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius * 1.12, 36), new THREE.MeshStandardMaterial({ color: 0xd7eef0, transparent: true, opacity: 0.4, roughness: 0.4, depthWrite: false }))
    foam.rotation.x = -Math.PI / 2
    foam.position.set(lake.x, y + 0.05, lake.z)
    scene.add(disc, foam)
  }
}
function mergeParts(parts) {
  const geos = parts.map(g => (g.index ? g.toNonIndexed() : g))
  let n = 0
  geos.forEach(g => { n += g.attributes.position.count })
  const pos = new Float32Array(n * 3)
  const nrm = new Float32Array(n * 3)
  let o = 0
  for (const g of geos) {
    const p = g.attributes.position.array
    const nv = g.attributes.normal.array
    pos.set(p, o)
    nrm.set(nv, o)
    o += p.length
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  return geo
}
function plantGeo() {
  const a = new THREE.ConeGeometry(1.15, 1.45, 6); a.translate(0, 2.05, 0)
  const b = new THREE.ConeGeometry(0.86, 1.2, 6); b.translate(0, 3.0, 0)
  const c = new THREE.ConeGeometry(0.48, 0.85, 5); c.translate(0, 3.7, 0)
  const pine = mergeParts([a, b, c])
  const aspen = new THREE.SphereGeometry(0.95, 7, 5); aspen.scale(1, 1.25, 1); aspen.translate(0, 2.7, 0)
  const body = new THREE.CylinderGeometry(0.34, 0.4, 2.5, 7); body.translate(0, 1.25, 0)
  const arm = new THREE.CylinderGeometry(0.16, 0.18, 1.05, 6); arm.rotateZ(Math.PI / 2); arm.translate(0.62, 1.65, 0)
  const arm2 = new THREE.CylinderGeometry(0.14, 0.16, 0.8, 5); arm2.rotateZ(-Math.PI / 2.3); arm2.translate(-0.48, 1.35, 0.08)
  const cactus = mergeParts([body, arm, arm2])
  const juniper = new THREE.SphereGeometry(1, 7, 5); juniper.scale(1.35, 0.62, 1.25); juniper.translate(0, 0.85, 0)
  const pale = new THREE.CylinderGeometry(0.1, 0.16, 2.4, 5); pale.translate(0, 1.2, 0)
  return { pine, aspen, cactus, juniper, pale }
}
function instanced(geo, color, matrices, roughness) {
  if (!matrices.length) return null
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: roughness == null ? 0.86 : roughness }), matrices.length)
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  mesh.castShadow = gfx().shadow > 0
  scene.add(mesh)
  return mesh
}
function scatter() {
  const dummy = new THREE.Object3D()
  const trees = world.trees.slice(0, gfx().trees)
  const geos = plantGeo()
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 2.2, 5)
  trunkG.translate(0, 1.1, 0)
  const buckets = { trunk: [], pale: [], pine: [], aspen: [], cactus: [], juniper: [] }
  trees.forEach(t => {
    dummy.position.set(t.x, t.y, t.z)
    dummy.rotation.set(0, t.x * 0.17, 0)
    dummy.scale.setScalar(t.s)
    dummy.updateMatrix()
    const m = dummy.matrix.clone()
    if (t.k === 2) buckets.cactus.push(m)
    else if (t.k === 3) buckets.juniper.push(m)
    else if (t.k === 1) { buckets.pale.push(m); buckets.aspen.push(m) }
    else { buckets.trunk.push(m); buckets.pine.push(m) }
  })
  instanced(trunkG, 0x5a4030, buckets.trunk)
  instanced(geos.pale, 0xe4e0d4, buckets.pale, 0.7)
  instanced(geos.pine, 0x1f4a30, buckets.pine)
  instanced(geos.aspen, 0xc5d6a4, buckets.aspen, 0.75)
  instanced(geos.cactus, 0x6d8f48, buckets.cactus, 0.7)
  instanced(geos.juniper, 0x7d8a58, buckets.juniper, 0.8)
  const rockGeos = [
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.BoxGeometry(1.4, 0.55, 1.1),
    new THREE.ConeGeometry(0.7, 1.8, 5)
  ]
  const rockCols = { desert: new THREE.Color('#b15a42'), forest: new THREE.Color('#6a6458'), mountain: new THREE.Color('#9aa3ad') }
  const groups = [[], [], []]
  world.rocks.forEach(r => {
    const climb = r.h < 1.75
    dummy.position.set(r.x, world.height(r.x, r.z) + (climb ? 0.05 : r.h * 0.12), r.z)
    dummy.scale.set(r.rad * (r.kind === 1 ? 0.62 : 0.46), (climb ? 0.34 : r.h * (r.kind === 2 ? 0.85 : 0.55)), r.rad * 0.44)
    dummy.rotation.set(r.h * 0.2, r.x * 0.2, r.kind === 1 ? 0.3 : 0.15)
    dummy.updateMatrix()
    groups[r.kind] = groups[r.kind] || groups[0]
    groups[r.kind].push({ m: dummy.matrix.clone(), region: r.region || 'forest' })
  })
  groups.forEach((list, kind) => {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(rockGeos[kind] || rockGeos[0], new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94 }), list.length)
    list.forEach((item, i) => {
      mesh.setMatrixAt(i, item.m)
      mesh.setColorAt(i, rockCols[item.region] || rockCols.forest)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
    mesh.castShadow = gfx().shadow > 0
    mesh.receiveShadow = true
    scene.add(mesh)
  })
  scatterGround()
}
function scatterGround() {
  if (save.settings.gfx === 'low') return
  const cap = save.settings.gfx === 'high' ? 380 : 180
  const dummy = new THREE.Object3D()
  const buckets = { grass: [], flower: [], ripple: [], scree: [], snow: [] }
  const flowerCol = []
  const blooms = [new THREE.Color('#e07a8a'), new THREE.Color('#f0d36a'), new THREE.Color('#f4efe6'), new THREE.Color('#d07048')]
  for (let i = 0; i < cap; i++) {
    const hx = ((Math.imul(i + 1, 374761393) ^ 0x9e3779b9) >>> 0) / 4294967296
    const hz = ((Math.imul(i + 9, 668265263) ^ 0x85ebca6b) >>> 0) / 4294967296
    const x = (hx * 2 - 1) * (HALF - 28)
    const z = (hz * 2 - 1) * (HALF - 28)
    const s = world.surface(x, z)
    if (s === SURF.water || s === SURF.trail) continue
    const reg = world.regionAt(x, z).id
    const y = world.height(x, z)
    let kind = 'grass'
    if (reg === 'desert' && s === SURF.sand) kind = 'ripple'
    else if (reg === 'desert') kind = hx > 0.72 ? 'flower' : 'grass'
    else if (reg === 'mountain' && y > 18 && !world.lakeAt(x, z, 22)) kind = 'snow'
    else if (reg === 'mountain' && s === SURF.rock) kind = 'scree'
    else if (hx > 0.78) kind = 'flower'
    dummy.position.set(x, y + (kind === 'snow' || kind === 'ripple' ? 0.05 : 0), z)
    dummy.rotation.set(kind === 'ripple' || kind === 'snow' ? -Math.PI / 2 : 0, hz * 6, 0)
    const sc = kind === 'ripple' ? 0.8 + hx : kind === 'snow' ? 0.45 + hz * 0.35 : 0.55 + hx * 0.7
    dummy.scale.setScalar(sc)
    dummy.updateMatrix()
    buckets[kind].push(dummy.matrix.clone())
    if (kind === 'flower') flowerCol.push(blooms[i % blooms.length])
  }
  const grass = new THREE.ConeGeometry(0.16, 0.5, 3); grass.translate(0, 0.25, 0)
  const flower = new THREE.SphereGeometry(0.12, 5, 4); flower.translate(0, 0.35, 0)
  const ripple = new THREE.CircleGeometry(0.7, 6)
  const scree = new THREE.DodecahedronGeometry(0.22, 0)
  const snow = new THREE.CircleGeometry(0.85, 6)
  const paint = (geo, color, list, rough) => {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }), list.length)
    list.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    scene.add(mesh)
    return mesh
  }
  paint(grass, 0x3f6a3a, buckets.grass, 0.95)
  const flowers = paint(flower, 0xffffff, buckets.flower, 0.6)
  if (flowers) {
    flowerCol.forEach((c, i) => flowers.setColorAt(i, c))
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true
  }
  paint(ripple, 0xd7b48a, buckets.ripple, 1)
  paint(scree, 0x8d96a0, buckets.scree, 0.95)
  paint(snow, 0xf7f8fb, buckets.snow, 0.85)
}
function block(color, x, y, z, w, h, d, matOpts) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, matOpts)))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}
let blades
function buildCamps() {
  const y = yard
  block(0x6a3b28, y.x + 11, y.y + 1.4, y.z + 2, 8.4, 2.8, 5.2)
  block(0x3a2a22, y.x + 11, y.y + 3.0, y.z + 2, 9, 0.35, 5.8)
  block(0xc24b24, y.x - 7, y.y + 1.1, y.z + 4, 0.5, 2.2, 1.6)
  const cabin = world.pois.find(p => p.id === 'cabin')
  block(0x7a4a30, cabin.x, cabin.y + 1.3, cabin.z, 6.2, 2.6, 4.6)
  block(0x3e2a24, cabin.x, cabin.y + 2.9, cabin.z, 6.8, 0.4, 5.2)
  const mill = world.pois.find(p => p.id === 'mill')
  block(0xcfc6b4, mill.x, mill.y + 2.2, mill.z, 2.2, 4.4, 2.2)
  blades = new THREE.Group()
  blades.position.set(mill.x, mill.y + 3.6, mill.z + 1.2)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x6a5438 }))
  const arm2 = arm.clone()
  arm2.rotation.z = Math.PI / 2
  blades.add(arm, arm2)
  scene.add(blades)
  const look = world.pois.find(p => p.id === 'lookout')
  block(0x8a8680, look.x, look.y + 3.2, look.z, 2.4, 6.4, 2.4)
  block(0xe4572e, look.x, look.y + 6.6, look.z, 3.2, 0.3, 3.2)
  const quarry = world.pois.find(p => p.id === 'quarry')
  block(0x8a5a32, quarry.x + 6, quarry.y + 0.6, quarry.z + 2, 1.4, 1.2, 1.4)
  block(0x5c6a72, quarry.x + 8, quarry.y + 0.8, quarry.z - 1, 1.6, 1.6, 1.2)
  const cairn = world.pois.find(p => p.id === 'cairn')
  block(0x8d887f, cairn.x, cairn.y + 0.35, cairn.z, 0.7, 0.7, 0.7)
  block(0x6e6a64, cairn.x + 0.15, cairn.y + 0.9, cairn.z - 0.1, 0.45, 0.45, 0.45)
  for (const p of world.pois) if (p.kind === 'store') buildStore(p)
  const sign = document.createElement('canvas')
  sign.width = 256; sign.height = 64
  const sg = sign.getContext('2d')
  sg.fillStyle = '#1a120c'; sg.fillRect(0, 0, 256, 64)
  sg.fillStyle = '#f0c14a'; sg.font = '700 28px Impact, sans-serif'; sg.fillText('OXBOW YARD', 18, 42)
  const tex = new THREE.CanvasTexture(sign)
  tex.colorSpace = THREE.SRGBColorSpace
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: tex }))
  board.position.set(y.x - 7, y.y + 2.5, y.z + 4.8)
  scene.add(board)
}
function buildStore(p) {
  block(0x6d4a32, p.x + 5.5, p.y + 1.5, p.z, 5.6, 3, 4.2)
  block(0x2c241c, p.x + 5.5, p.y + 3.15, p.z, 6.2, 0.28, 4.8)
  block(0xc4552e, p.x + 5.5, p.y + 2.2, p.z + 2.2, 2.4, 0.12, 1.4)
  block(0xc9ccd0, p.x, p.y + 0.85, p.z + 1.2, 0.7, 1.5, 0.5)
  block(0x222, p.x, p.y + 1.7, p.z + 1.2, 0.9, 0.16, 0.7)
  const c = document.createElement('canvas')
  c.width = 512; c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#1a120c'; g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#f0c14a'; g.font = '700 42px Impact, sans-serif'; g.fillText('GENERAL STORE', 24, 52)
  g.fillStyle = '#f4efe6'; g.font = '28px sans-serif'; g.fillText(p.name + '  ·  fuel', 24, 96)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: tex }))
  board.position.set(p.x + 5.5, p.y + 2.35, p.z + 2.16)
  scene.add(board)
}
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 1.4, 46, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffc14a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
)
scene.add(beam)
beam.visible = false
const winchGeo = new THREE.BufferGeometry()
winchGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
const winchLine = new THREE.Line(winchGeo, new THREE.LineBasicMaterial({ color: 0xe8e4dc }))
winchLine.frustumCulled = false
winchLine.visible = false
scene.add(winchLine)

let truck, wheels = []
function rigLook(id) {
  const all = (save.cosmetics && save.cosmetics[id]) || {}
  const style = (VEHICLES[id] && VEHICLES[id].style) || 'pickup'
  const base = {
    pickup: { jerry: true, spare: true, kayak: false, bike: false },
    jeep: { jerry: false, spare: true, kayak: false, bike: false },
    bronco: { jerry: false, spare: false, kayak: true, bike: false },
    wagon: { jerry: true, spare: false, kayak: false, bike: true },
    utility: { jerry: true, spare: true, kayak: false, bike: false },
    van: { jerry: false, spare: true, kayak: false, bike: false }
  }[style] || { jerry: false, spare: true, kayak: false, bike: false }
  return { livery: all.livery || 0, rack: Object.assign({}, base, all.rack || {}) }
}
function buildTruck(spec) {
  if (truck) scene.remove(truck)
  wheels.forEach(w => scene.remove(w))
  wheels = []
  const look = rigLook(spec.id)
  const detail = save.settings.gfx === 'high' ? 4 : save.settings.gfx === 'low' ? 2 : 3
  const built = buildRig(THREE, spec, { livery: look.livery, rack: look.rack, shadow: !!gfx().shadow, detail, env: envTex })
  truck = built.group
  wheels = built.wheels
  scene.add(truck)
  wheels.forEach(w => scene.add(w))
}
function updateLamps() {
  const ud = truck && truck.userData
  if (!ud) return
  const dark = isDark(save.clock)
  const modeL = save.lights || 'auto'
  const on = modeL === 'on' || (modeL === 'auto' && dark)
  const hi = !!(on && save.highbeam)
  for (const s of ud.lamps) {
    s.intensity = on ? (hi ? 34 : 18) : 0
    s.distance = hi ? 68 : 40
    s.angle = hi ? 0.32 : 0.5
    s.castShadow = !!(on && gfx().shadow)
  }
  ud.lampMat.emissiveIntensity = on ? (hi ? 3.4 : 2.3) : 0.55
  if (ud.roofMat) ud.roofMat.emissiveIntensity = on ? 1.8 : 0.05
  if (ud.tailMat) ud.tailMat.emissiveIntensity = dark ? 1.6 : 0.5
  const btn = $('btn-lights')
  if (btn) btn.textContent = modeL === 'auto' ? 'AUTO' : modeL === 'on' ? 'ON' : 'OFF'
  const beam = $('btn-beam')
  if (beam) { beam.classList.toggle('on', hi); beam.disabled = !on }
}
function paintMap(target) {
  const n = world.gridN
  const g = target.getContext('2d')
  const img = g.createImageData(n, n)
  const rgb = [[110, 75, 50], [150, 114, 74], [62, 54, 44], [198, 163, 107], [120, 116, 112], [42, 104, 128]]
  const es = WORLD_SIZE / (n - 1)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const h = world.heights[j * n + i]
      const x = -HALF + i * es
      const z = HALF - j * es
      const w = world.blend(x, z)
      const surf = world.surf[j * n + i]
      const zone = [
        LOOK.forest.map[0] * w.forest + LOOK.desert.map[0] * w.desert + LOOK.mountain.map[0] * w.mountain,
        LOOK.forest.map[1] * w.forest + LOOK.desert.map[1] * w.desert + LOOK.mountain.map[1] * w.mountain,
        LOOK.forest.map[2] * w.forest + LOOK.desert.map[2] * w.desert + LOOK.mountain.map[2] * w.mountain
      ]
      const base = rgb[surf] || rgb[0]
      const mix = surf === 5 ? 0.25 : 0.62
      const shade = 0.78 + Math.max(-0.18, Math.min(0.32, h / 48))
      const o = (j * n + i) * 4
      img.data[o] = (zone[0] * mix + base[0] * (1 - mix)) * shade
      img.data[o + 1] = (zone[1] * mix + base[1] * (1 - mix)) * shade
      img.data[o + 2] = (zone[2] * mix + base[2] * (1 - mix)) * shade
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
}
const mapBake = document.createElement('canvas')
mapBake.width = mapBake.height = world.gridN
paintMap(mapBake)

let horizon = null
function viewRegion() {
  const c = sim.chassis
  const x = c ? c.position.x : 0
  const z = c ? c.position.z : -160
  return world.regionAt(x, z)
}
function phaseColor(slot, elev, w) {
  const day = Math.max(0, Math.min(1, (elev - 0.08) / 0.55))
  const night = Math.max(0, Math.min(1, (-elev + 0.05) / 0.35))
  const dusk = Math.max(0, 1 - day - night)
  const sum = day + dusk + night || 1
  const pick = (phase) => mixHex({
    forest: LOOK.forest[phase][slot],
    desert: LOOK.desert[phase][slot],
    mountain: LOOK.mountain[phase][slot]
  }, w)
  const c = pick('night').multiplyScalar(night / sum)
  c.add(pick('dusk').multiplyScalar(dusk / sum))
  c.add(pick('day').multiplyScalar(day / sum))
  return c
}
function applyTime(t) {
  const ang = (t - 0.25) * Math.PI * 2
  const elev = Math.sin(ang)
  const day = Math.max(0, elev)
  const here = viewRegion()
  const w = here.w
  const fogC = phaseColor(3, elev, w)
  const top = phaseColor(0, elev, w)
  const hor = phaseColor(1, elev, w)
  const grd = phaseColor(2, elev, w)
  const sunC = phaseColor(4, elev, w)
  const hemiC = phaseColor(5, elev, w)
  const groundC = phaseColor(6, elev, w)
  scene.fog.color.copy(fogC)
  scene.fog.near = 22 + day * 16
  scene.fog.far = gfx().fog * (0.62 + day * 0.4)
  renderer.setClearColor(fogC)
  const low = elev > -0.02 && elev < 0.55 ? 1 : 0
  const graded = save.settings.gfx !== 'low'
  renderer.toneMappingExposure = 0.78 + day * 0.26 + low * (graded ? 0.34 : 0.12)
  sun.color.copy(sunC)
  sun.intensity = day * 2.35 + low * 0.45
  hemi.color.copy(hemiC)
  hemi.groundColor.copy(groundC)
  hemi.intensity = 0.1 + day * 0.48 + low * 0.12
  fill.color.copy(hemiC)
  fill.intensity = 0.12 + day * 0.42 + low * 0.36
  rim.intensity = 0.14 + day * 0.18 + low * 0.85
  rim.color.copy(sunC)
  const dir = new THREE.Vector3(Math.cos(ang), Math.max(-0.05, elev), Math.sin(ang) * 0.55).normalize()
  skyMat.uniforms.sun.value.copy(dir)
  skyMat.uniforms.elev.value = elev
  skyMat.uniforms.top.value.copy(top)
  skyMat.uniforms.hor.value.copy(hor)
  skyMat.uniforms.grd.value.copy(grd)
  skyMat.uniforms.sunCol.value.copy(sunC)
  moon.intensity = Math.max(0, -elev) * 0.42
  moon.color.set('#c5d4ff')
  stars.material.opacity = Math.max(0, Math.min(1, -elev * 1.3))
  if (horizon) {
    horizon.material.color.copy(grd).multiplyScalar(0.55)
    const p = camera.position
    horizon.position.set(p.x, 0, p.z)
    horizon.scale.setScalar(Math.max(0.45, scene.fog.far / 300))
  }
  const grade = $('grade')
  const vig = $('vignette')
  if (grade) grade.classList.toggle('off', !graded)
  if (vig) vig.classList.toggle('off', !graded)
  if (grade && graded) {
    const warm = low ? 0.22 : day > 0.5 ? 0.08 : 0.02
    const css = '#' + fogC.getHexString()
    grade.style.background = 'radial-gradient(ellipse at center, transparent 42%, rgba(12,8,6,' + (0.28 + warm) + ') 100%), linear-gradient(180deg, ' + css + '22, transparent 46%)'
  }
  return dir
}
function buildHorizon() {
  const N = 80
  const pos = []
  const idx = []
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const jag = 14 + Math.sin(i * 0.65) ** 2 * 22 + Math.sin(i * 2.2) * 5
    pos.push(Math.cos(a) * 300, 2, Math.sin(a) * 300)
    pos.push(Math.cos(a) * 460, jag, Math.sin(a) * 460)
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  horizon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x6a5344, fog: true, side: THREE.DoubleSide }))
  horizon.frustumCulled = false
  scene.add(horizon)
}
buildHorizon()
const moteCount = gfx().dust ? (save.settings.gfx === 'high' ? 120 : 64) : 0
const motePos = new Float32Array(Math.max(1, moteCount) * 3)
const moteCol = new Float32Array(Math.max(1, moteCount) * 3)
for (let i = 0; i < moteCount; i++) {
  motePos[i * 3] = (Math.random() - 0.5) * 36
  motePos[i * 3 + 1] = Math.random() * 8
  motePos[i * 3 + 2] = (Math.random() - 0.5) * 36
}
const moteGeo = new THREE.BufferGeometry()
moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
moteGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3))
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true }))
motes.visible = moteCount > 0
motes.frustumCulled = false
scene.add(motes)
let moteT = 0
function tickMotes(dt) {
  if (!moteCount || mode === 'title') { motes.visible = mode !== 'title' && moteCount > 0; }
  if (!moteCount) return
  motes.visible = mode !== 'title'
  const here = viewRegion()
  const elev = skyMat.uniforms.elev.value
  const night = elev < 0.05
  moteT += dt
  const p = camera.position
  motes.position.set(p.x, 0, p.z)
  const attr = moteGeo.attributes.position
  const col = moteGeo.attributes.color
  for (let i = 0; i < moteCount; i++) {
    let x = attr.getX(i)
    let y = attr.getY(i)
    let z = attr.getZ(i)
    if (here.id === 'mountain') {
      y -= dt * (1.4 + (i % 5) * 0.15)
      x += Math.sin(moteT + i) * dt * 0.4
      if (y < 0.2) y = 6 + (i % 4)
    } else if (here.id === 'desert') {
      x += dt * 1.1
      y += Math.sin(moteT * 0.7 + i) * dt * 0.15
      if (x > 20) x = -20
    } else {
      y += Math.sin(moteT * 1.4 + i) * dt * 0.35
      x += dt * 0.25
      if (night) y = 1.2 + (Math.sin(moteT * 2 + i) * 0.5 + 0.5) * 2.2
      if (x > 18) x = -18
    }
    attr.setXYZ(i, x, y, z)
    if (here.id === 'mountain') col.setXYZ(i, 0.92, 0.95, 1)
    else if (here.id === 'desert') col.setXYZ(i, 0.92, 0.72, 0.45)
    else if (night) col.setXYZ(i, 0.85, 1, 0.45)
    else col.setXYZ(i, 0.95, 0.92, 0.55)
  }
  attr.needsUpdate = true
  col.needsUpdate = true
  motes.material.opacity = here.id === 'forest' && night ? 0.85 : 0.28
  motes.material.size = here.id === 'mountain' ? 0.08 : here.id === 'forest' && night ? 0.12 : 0.06
}
let sunDir = applyTime(save.clock)

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch (e) {}
}
function capturePose() {
  const c = sim.chassis
  if (!c) return
  save.x = c.position.x; save.y = c.position.y; save.z = c.position.z
  save.qx = c.quaternion.x; save.qy = c.quaternion.y; save.qz = c.quaternion.z; save.qw = c.quaternion.w
  save.vehicle = save.vehicle || 'mule'
}
function toast(msg) {
  const el = $('toast')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => el.classList.remove('show'), 2400)
}
function atYard() {
  const c = sim.chassis
  return !!c && Math.hypot(c.position.x - yard.x, c.position.z - yard.z) < 26
}
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'))
  if (id) $(id).classList.add('show')
  app.classList.toggle('menu', !!id && mode !== 'title')
  if (id && mode === 'play') mode = 'pause'
}
function closePanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'))
  app.classList.remove('menu')
  if (mode === 'pause') mode = 'play'
}
function enterTitle() {
  mode = 'title'
  app.classList.add('title')
  app.classList.remove('playing', 'menu')
  closePanels()
  $('btn-continue').disabled = !loadSave()
}
function startPlay(fromSave) {
  if (fromSave) save = fromSave
  const specId = VEHICLES[save.vehicle] ? save.vehicle : 'mule'
  save.vehicle = specId
  const pose = fromSave && Number.isFinite(fromSave.x)
    ? { x: fromSave.x, y: fromSave.y, z: fromSave.z, qx: fromSave.qx, qy: fromSave.qy, qz: fromSave.qz, qw: fromSave.qw }
    : { x: yard.x, z: yard.z + 8 }
  sim.spawn(specId, pose, save.upgrades)
  buildTruck(specWithUpgrades(specId, save.upgrades))
  mode = 'play'
  app.classList.remove('title')
  app.classList.add('playing')
  closePanels()
  persist()
}
function zeroInput() {
  return { throttle: 0, brake: 0, steer: 0, handbrake: false, lock: false, winch: false, fuel: TANK }
}
function sampleInput(dt) {
  let target = (pad.right - pad.left) + (keys.d - keys.a)
  if (save.settings.tilt) target += tiltV
  target = Math.max(-1, Math.min(1, target))
  steerSm += (target - steerSm) * Math.min(1, dt * 3.2)
  const rawT = Math.max(keys.w, pad.gas)
  const rise = rawT > throttleSm ? 1.8 : 4.2
  throttleSm += (rawT - throttleSm) * Math.min(1, dt * rise)
  return {
    throttle: throttleSm,
    brake: Math.max(keys.s, pad.brake),
    steer: steerSm,
    handbrake: !!(keys.space || pad.hand),
    lock: lockOn,
    low: lowOn,
    winch: !!(keys.f || pad.winch),
    anchor,
    fuel: save.fuel,
    grip: (save.buff && save.buff.grip) || 1
  }
}

const q = new THREE.Quaternion()
const fwd = new THREE.Vector3()
const desired = new THREE.Vector3()
const lookAt = new THREE.Vector3()
const camFwd = new THREE.Vector3()
function syncTruck() {
  const c = sim.chassis
  if (!c || !truck) return
  truck.position.set(c.position.x, c.position.y - Math.min(0.42, (hazard.sink || 0) * 0.55), c.position.z)
  truck.quaternion.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
  applyLod(truck, camera.position.distanceTo(truck.position) > 28)
  const pulling = !!(anchor && (keys.f || pad.winch) && mode === 'play')
  winchLine.visible = pulling
  if (pulling) {
    const wp = winchLine.geometry.attributes.position
    wp.setXYZ(0, c.position.x, c.position.y + 0.6, c.position.z)
    wp.setXYZ(1, anchor.x, anchor.y, anchor.z)
    wp.needsUpdate = true
  }
  q.copy(truck.quaternion)
  fwd.set(0, 0, 1).applyQuaternion(q)
  if (sim.vehicle) {
    for (let i = 0; i < 4; i++) {
      sim.vehicle.updateWheelTransform(i)
      const t = sim.vehicle.getWheelTransformWorld(i)
      wheels[i].position.set(t.position.x, t.position.y, t.position.z)
      wheels[i].quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w)
    }
  }
}
function updateCamera(dt) {
  const c = sim.chassis
  if (!c) return
  if (holdCam) {
    sunDir = applyTime(save.clock)
    const p = camera.position
    sun.position.set(p.x + sunDir.x * 48, Math.max(8, p.y + sunDir.y * 48), p.z + sunDir.z * 48)
    sun.target.position.set(p.x - 2, p.y - 1.2, p.z + 6)
    sky.position.copy(camera.position)
    stars.position.copy(camera.position)
    return
  }
  q.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
  fwd.set(0, 0, 1).applyQuaternion(q)
  const p = c.position
  if (mode === 'camp') {
    orbit += dt * 0.15
    const yaw = orbitYaw + orbit
    camera.position.set(firePos.x + Math.sin(yaw) * 7.2, firePos.y + 2.4, firePos.z + Math.cos(yaw) * 7.2)
    camera.lookAt(firePos.x, firePos.y + 0.5, firePos.z)
  } else if (mode === 'title') {
    orbit += dt * 0.22
    camera.position.set(p.x + Math.sin(orbit) * 9.5, p.y + 3.1, p.z + Math.cos(orbit) * 9.5)
    camera.lookAt(p.x, p.y + 0.9, p.z)
  } else if (camMode === 'hood') {
    desired.set(0, 0.95, sim.spec.half[2] * 0.35).applyQuaternion(q).add(p)
    lookAt.set(0, 0.7, 12).applyQuaternion(q).add(p)
    camera.position.lerp(desired, 0.4)
    camera.lookAt(lookAt)
  } else if (camMode === 'orbit') {
    const cp = Math.cos(orbitPitch)
    camera.position.set(
      p.x + Math.sin(orbitYaw) * cp * orbitDist,
      p.y + 1.2 + Math.sin(orbitPitch) * orbitDist,
      p.z + Math.cos(orbitYaw) * cp * orbitDist
    )
    camera.lookAt(p.x, p.y + 0.8, p.z)
  } else {
    const back = 6.3
    desired.set(p.x - fwd.x * back, p.y + 2.45, p.z - fwd.z * back)
    if (save.settings.shake) desired.y += Math.sin(performance.now() * 0.02) * Math.min(0.08, Math.abs(lastSpeed) * 0.004)
    lookAt.set(p.x + fwd.x * 4, p.y + 0.95, p.z + fwd.z * 4)
    const k = 1 - Math.pow(0.001, dt)
    camera.position.lerp(desired, k)
    const gy = world.height(camera.position.x, camera.position.z) + 1.15
    if (camera.position.y < gy) camera.position.y = gy
    camera.lookAt(lookAt)
  }
  sunDir = applyTime(save.clock)
  sun.position.set(p.x + sunDir.x * 48, p.y + Math.max(6, sunDir.y * 48), p.z + sunDir.z * 48)
  sun.target.position.set(p.x, p.y, p.z)
  moon.position.set(p.x - sunDir.x * 40, p.y + 30, p.z - sunDir.z * 40)
  moon.target.position.set(p.x, p.y, p.z)
  sky.position.copy(camera.position)
  stars.position.copy(camera.position)
}
const poiById = Object.fromEntries(world.pois.map(p => [p.id, p]))
function nearStore() {
  const c = sim.chassis
  if (!c) return null
  let best = null, bd = 1e9
  for (const p of world.pois) {
    if (p.kind !== 'store') continue
    const d = Math.hypot(c.position.x - p.x, c.position.z - p.z)
    if (d < p.r && d < bd) { best = p; bd = d }
  }
  return best
}
function currentStep() {
  if (!save.active) return null
  const adv = ADVENTURES.find(a => a.id === save.active.id)
  return adv ? { adv, step: adv.steps[save.active.step] } : null
}
function updateGame(dt) {
  const c = sim.chassis
  if (!c) return
  if (save.settings.cycle > 0) save.clock = (save.clock + dt / (save.settings.cycle * 60)) % 1
  for (const p of world.pois) {
    if (p.kind === 'store' || save.discovered.includes(p.id)) continue
    if (Math.hypot(c.position.x - p.x, c.position.z - p.z) < 18) {
      save.discovered.push(p.id)
      toast('Found ' + p.name)
      persist()
    }
  }
  const regNow = world.regionAt(c.position.x, c.position.z).id
  if (regNow !== lastRegion) {
    if (lastRegion) toast(world.regionAt(c.position.x, c.position.z).name)
    lastRegion = regNow
  }
  const cur = currentStep()
  if (cur) {
    const res = tickAdventure(save, {
      x: c.position.x, z: c.position.z, speed: lastSpeed, clock: save.clock, dt,
      water: world.surface(c.position.x, c.position.z) === SURF.water,
      ford: world.ford, pois: poiById
    })
    if (res && res.advanced) { toast(res.step.text); persist() }
    if (res && res.done) { toast(res.adv.name + '  +' + res.gain + ' rep' + (res.stars > 1 ? '  ★'.repeat(res.stars) : '')); persist() }
  }
  if (mode === 'play') {
    saveAcc += dt
    if (saveAcc > 4) { saveAcc = 0; capturePose(); persist() }
  }
  const now = currentStep()
  if (now) {
    const step = now.step
    const poi = step.poi ? poiById[step.poi] : world.ford
    const dist = Math.hypot(c.position.x - poi.x, c.position.z - poi.z)
    $('objective').textContent = now.adv.name + ' · ' + step.text + ' · ' + Math.round(dist) + ' m'
    beam.visible = true
    const gy = step.poi && poiById[step.poi] ? poiById[step.poi].y : world.height(poi.x, poi.z)
    beam.position.set(poi.x, gy + 24, poi.z)
  } else {
    $('objective').textContent = nearStore() ? nearStore().name + ' — E for the store' : 'J opens adventures'
    beam.visible = false
  }
  $('fliphint').classList.toggle('show', rolled() && !recovery)
  anchor = nearestAnchor()
  refreshRecover()
  const storeBtn = $('btn-store')
  if (storeBtn) storeBtn.hidden = mode === 'camp' || !nearStore()
  const campBtn = $('btn-camp')
  if (campBtn) campBtn.hidden = mode === 'camp' || !canPitch(world, c.position.x, c.position.z, sim.upright(), lastSpeed)
  const can = $('btn-jerry')
  if (can) {
    can.hidden = jerrySlots(save.rep) === 0 && !save.jerry
    can.textContent = 'CAN ' + (save.jerry || 0)
    can.disabled = !save.jerry
  }
}
function drawMap(canvas, big) {
  const g = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  g.drawImage(mapBake, 0, 0, w, h)
  const px = (x, z) => [(x + HALF) / WORLD_SIZE * w, (HALF - z) / WORLD_SIZE * h]
  for (const p of world.pois) {
    const [x, y] = px(p.x, p.z)
    const known = save.discovered.includes(p.id)
    const cur = currentStep()
    const targetId = cur && cur.step.poi
    if (p.kind === 'hidden' && !known && targetId !== p.id) continue
    g.fillStyle = p.kind === 'store' ? '#3ec6b0' : p.id === targetId ? '#ffb000' : known ? '#f4efe6' : '#888'
    g.beginPath()
    g.arc(x, y, big ? 7 : 3.5, 0, Math.PI * 2)
    g.fill()
    if (big) {
      g.fillStyle = '#f4efe6'
      g.font = '16px sans-serif'
      g.fillText(p.kind === 'store' || known ? p.name : '?', x + 8, y + 4)
    }
  }
  const c = sim.chassis
  if (!c) return
  const [x, y] = px(c.position.x, c.position.z)
  q.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
  fwd.set(0, 0, 1).applyQuaternion(q)
  const ang = Math.atan2(fwd.x, fwd.z)
  g.save()
  g.translate(x, y)
  g.rotate(ang)
  g.fillStyle = '#e4572e'
  g.beginPath()
  g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill()
  g.restore()
}
function truckAngles() {
  const c = sim.chassis
  if (!c) return { pitch: 0, roll: 0 }
  q.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
  fwd.set(0, 0, 1).applyQuaternion(q)
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  const pitch = Math.atan2(fwd.y, Math.hypot(fwd.x, fwd.z) || 0.001) * 180 / Math.PI
  const roll = Math.atan2(right.y, Math.hypot(right.x, right.z) || 0.001) * 180 / Math.PI
  return { pitch, roll }
}
function updateHud() {
  const mph = Math.abs(lastSpeed) * 2.237
  $('speed').textContent = String(Math.round(mph))
  $('gear').textContent = lastSpeed < -0.35 ? 'R' : lowOn ? 'L' : 'D'
  const cap = tankCapacity(save)
  const fuelPct = Math.max(0, save.fuel / cap) * 100
  $('fuelbar').style.width = fuelPct + '%'
  $('fuelbar').classList.toggle('low', save.fuel < cap * 0.2)
  $('fuellabel').textContent = save.fuel.toFixed(1) + '/' + cap
  const clk = clockLabel(save.clock)
  $('clock').textContent = clk.text + ' ' + clk.phase
  const rk = rankFor(save.rep)
  $('rep').textContent = rk.name + ' · ' + save.rep
  $('surface').textContent = (SURF_NAME[Math.round(lastSurf)] || 'dirt').toUpperCase()
  const regionEl = $('region')
  if (regionEl && sim.chassis) {
    const reg = world.regionAt(sim.chassis.position.x, sim.chassis.position.z)
    regionEl.textContent = reg.name
    regionEl.dataset.region = reg.id
  }
  const tilt = truckAngles()
  const pitchEl = $('tilt-pitch')
  const rollEl = $('tilt-roll')
  const tiltBox = $('tiltbox')
  if (pitchEl && rollEl && tiltBox) {
    pitchEl.textContent = 'P ' + tilt.pitch.toFixed(0) + '°'
    rollEl.textContent = 'R ' + tilt.roll.toFixed(0) + '°'
    const worst = Math.max(Math.abs(tilt.pitch), Math.abs(tilt.roll))
    tiltBox.classList.toggle('warn', worst >= 22 && worst < 36)
    tiltBox.classList.toggle('bad', worst >= 36)
  }
  const bogEl = $('bog')
  if (bogEl) {
    const show = hazard.mud > 0.04 || hazard.water > 0.04 || !!hazard.stuck
    bogEl.hidden = !show
    const fill = $('bogfill')
    const label = $('boglabel')
    if (show && fill && label) {
      const waterish = hazard.water >= hazard.mud
      const limit = waterish ? Math.max(0.2, hazard.wade || 0.8) : Math.max(0.2, hazard.bogAt || 0.6)
      const value = waterish ? hazard.water : hazard.mud
      const pct = Math.max(0, Math.min(1, value / limit))
      fill.style.width = (pct * 100) + '%'
      fill.classList.toggle('warn', pct > 0.6 && pct < 0.9)
      fill.classList.toggle('bad', pct >= 0.9 || !!hazard.stuck)
      label.textContent = hazard.stuck === 'mud' ? 'Bogged' : hazard.stuck === 'water' ? 'Flooded' : waterish ? 'Water ' + Math.round(pct * 100) + '%' : 'Mud ' + Math.round(pct * 100) + '%'
    }
  }
  $('btn-lock').classList.toggle('on', lockOn)
  const lowBtn = $('btn-low')
  if (lowBtn) lowBtn.classList.toggle('on', lowOn)
  drawMap($('minimap'), false)
  if ($('mapfull').classList.contains('show')) drawMap($('mapbig'), true)
  const curP = currentStep()
  const poi = curP && curP.step.poi ? poiById[curP.step.poi] : curP && curP.step.kind === 'ford' ? { x: world.ford.x, y: world.height(world.ford.x, world.ford.z), z: world.ford.z, name: 'The ford' } : null
  const label = $('poi-label')
  if (!poi || mode !== 'play') { label.style.display = 'none'; return }
  const v = new THREE.Vector3(poi.x, (poi.y || 0) + 4, poi.z)
  camera.getWorldDirection(camFwd)
  const inFront = v.clone().sub(camera.position).dot(camFwd) > 0
  const ndc = v.project(camera)
  let sx = (ndc.x * 0.5 + 0.5) * window.innerWidth
  let sy = (-ndc.y * 0.5 + 0.5) * window.innerHeight
  if (!inFront) { sx = window.innerWidth - sx; sy = window.innerHeight - sy }
  const m = 36
  const clamped = sx < m || sy < m || sx > window.innerWidth - m || sy > window.innerHeight - m || !inFront
  sx = Math.max(m, Math.min(window.innerWidth - m, sx))
  sy = Math.max(m, Math.min(window.innerHeight - 90, sy))
  label.style.display = 'block'
  label.style.left = sx + 'px'
  label.style.top = sy + 'px'
  const cur = currentStep()
  const name = (cur && cur.step.poi && poiById[cur.step.poi] && poiById[cur.step.poi].name) || (cur && cur.step.text) || ''
  label.textContent = (clamped ? '▸ ' : '') + name
}
function fillAdventures() {
  const box = $('job-list')
  box.replaceChildren()
  const head = document.createElement('p')
  head.className = 'note'
  const rk = rankFor(save.rep)
  head.textContent = rk.name + ' · ' + save.rep + ' reputation. A clean run or a fast climb earns extra.'
  box.appendChild(head)
  for (const adv of ADVENTURES) {
    const row = document.createElement('div')
    row.className = 'job'
    const cleared = save.cleared[adv.id]
    const active = save.active && save.active.id === adv.id
    const home = adv.region || 'forest'
    const needRegion = REGION_OPEN[home] || 0
    const lockedRegion = !regionUnlocked(save, home)
    const lockedRep = save.rep < adv.rep
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = adv.name + ' · ' + adv.diff + ' · ' + home + (cleared ? '  ' + '★'.repeat(cleared.stars) : '')
    const stepNote = active ? ' Now: ' + adv.steps[save.active.step].text + '.' : ''
    const gateNote = lockedRegion ? ' The ' + (home === 'desert' ? 'Red Wash' : home === 'mountain' ? 'Granite Spine' : 'Hollow Forest') + ' opens at ' + needRegion + ' rep.' : ''
    row.querySelector('span').textContent = adv.text + gateNote + stepNote
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = active ? 'Under way' : lockedRegion ? 'Locked · ' + needRegion + ' rep' : lockedRep ? 'Locked · ' + adv.rep + ' rep' : cleared ? 'Ride it again' : 'Take adventure'
    btn.disabled = !!active || lockedRegion || lockedRep
    btn.onclick = () => {
      if (lockedRegion || lockedRep) { toast(btn.textContent); return }
      save.active = { id: adv.id, step: 0, elapsed: 0, resets: 0 }
      toast(adv.name)
      persist(); fillAdventures()
    }
    row.appendChild(btn)
    box.appendChild(row)
  }
}
function fillGarage() {
  const here = atYard()
  $('garage-note').textContent = here ? rankFor(save.rep).name + ' · ' + save.rep + ' rep. The yard will fit what your name allows.' : 'Look around. Parts are fitted only at Oxbow Yard. Fuel and cans are at the general stores.'
  const box = $('garage-body')
  box.replaceChildren()
  for (const id of Object.keys(UPGRADES)) {
    const u = UPGRADES[id]
    const level = save.upgrades[id] || 0
    const need = level >= u.max ? null : u.need[level]
    const row = document.createElement('div')
    row.className = 'up' + (need != null && save.rep < need ? ' locked' : '')
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = u.name + '  ' + level + '/' + u.max
    row.querySelector('span').textContent = u.blurb + (need == null ? '' : ' Needs ' + rankFor(need).name + ' (' + need + ' rep).')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = need == null ? 'Maxed' : save.rep < need ? 'Locked · ' + need + ' rep' : 'Fit it'
    btn.disabled = !here || need == null || save.rep < need
    btn.onclick = () => {
      const next = buyUpgrade(save, id)
      if (!next) return
      save = next
      const pose = { x: sim.chassis.position.x, y: sim.chassis.position.y + 0.3, z: sim.chassis.position.z, qx: sim.chassis.quaternion.x, qy: sim.chassis.quaternion.y, qz: sim.chassis.quaternion.z, qw: sim.chassis.quaternion.w }
      sim.spawn(save.vehicle, pose, save.upgrades)
      buildTruck(sim.spec)
      toast(u.name + ' fitted')
      persist(); fillGarage()
    }
    row.appendChild(btn)
    box.appendChild(row)
  }
  for (const id of Object.keys(VEHICLES)) {
    const v = VEHICLES[id]
    const owned = save.owned.includes(id)
    const row = document.createElement('div')
    row.className = 'up' + (!owned && save.rep < v.need ? ' locked' : '')
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = v.name + (save.vehicle === id ? ' · out' : '')
    const fitted = specWithUpgrades(id, save.upgrades)
    const ang = crawlAngles(fitted)
    row.querySelector('span').textContent = (owned ? 'In the shed. ' : 'Needs ' + v.need + ' rep. ') + 'Approach ' + ang.approach + '°, departure ' + ang.departure + '°, breakover ' + ang.breakover + '°. Wade ' + fitted.wade.toFixed(2) + ' m.'
    const btn = document.createElement('button')
    btn.type = 'button'
    if (!owned) btn.textContent = save.rep < v.need ? 'Locked · ' + v.need + ' rep' : 'Take the keys'
    else btn.textContent = save.vehicle === id ? 'Driving it' : 'Take it out'
    btn.disabled = !here || (!owned && save.rep < v.need) || (owned && save.vehicle === id)
    btn.onclick = () => {
      if (!owned) {
        const next = buyVehicle(save, id)
        if (!next) return
        save = next
      } else save.vehicle = id
      sim.spawn(save.vehicle, { x: yard.x, z: yard.z + 8, y: yard.y + 2 }, save.upgrades)
      buildTruck(sim.spec)
      toast(VEHICLES[save.vehicle].name)
      persist(); fillGarage()
    }
    row.appendChild(btn)
    box.appendChild(row)
  }
  if (here && save.owned.includes(save.vehicle)) {
    const look = rigLook(save.vehicle)
    const v = VEHICLES[save.vehicle]
    const paintRow = document.createElement('div')
    paintRow.className = 'up'
    paintRow.innerHTML = '<b></b><span></span>'
    const liv = v.liveries[look.livery % v.liveries.length]
    paintRow.querySelector('b').textContent = 'Paint · ' + liv.name
    paintRow.querySelector('span').textContent = 'Cycle the livery. The mud stays.'
    const pb = document.createElement('button')
    pb.type = 'button'
    pb.textContent = 'Next paint'
    pb.onclick = () => {
      save.cosmetics = save.cosmetics || {}
      const cur = save.cosmetics[save.vehicle] || { livery: 0, rack: {} }
      cur.livery = ((cur.livery || 0) + 1) % v.liveries.length
      save.cosmetics[save.vehicle] = cur
      buildTruck(sim.spec)
      persist(); fillGarage()
    }
    paintRow.appendChild(pb)
    box.appendChild(paintRow)
    for (const key of ['jerry', 'spare', 'kayak', 'bike']) {
      const label = { jerry: 'Roof cans', spare: 'Spare tire', kayak: 'Kayak', bike: 'Rear bike' }[key]
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = (look.rack[key] ? 'On · ' : 'Off · ') + label
      b.onclick = () => {
        save.cosmetics = save.cosmetics || {}
        const cur = save.cosmetics[save.vehicle] || { livery: look.livery, rack: {} }
        cur.rack = Object.assign({}, look.rack, cur.rack, { [key]: !look.rack[key] })
        cur.livery = look.livery
        save.cosmetics[save.vehicle] = cur
        buildTruck(sim.spec)
        persist(); fillGarage()
      }
      box.appendChild(b)
    }
  }
  const head = document.createElement('p')
  head.className = 'note'
  head.textContent = 'Camp kit'
  box.appendChild(head)
  for (const id of Object.keys(CAMP)) {
    const g = CAMP[id]
    const level = (save.camp && save.camp[id]) || 0
    const need = level >= g.max ? null : g.need[level]
    const row = document.createElement('div')
    row.className = 'up' + (need != null && save.rep < need ? ' locked' : '')
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = g.labels[level] + '  ' + level + '/' + g.max
    row.querySelector('span').textContent = g.blurb + (need == null ? '' : ' Next needs ' + need + ' rep.')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = need == null ? 'Maxed' : save.rep < need ? 'Locked · ' + need + ' rep' : 'Pack it'
    btn.disabled = !here || need == null || save.rep < need
    btn.onclick = () => {
      const next = buyCamp(save, id)
      if (!next) return
      save = next
      toast(g.labels[save.camp[id]])
      persist(); fillGarage()
    }
    row.appendChild(btn)
    box.appendChild(row)
  }
}
function fillStore() {
  const here = nearStore()
  $('store-note').textContent = here ? here.name + '. The pump is free. You still have to be here to use it.' : 'Roll up to a general store.'
  const box = $('store-body')
  box.replaceChildren()
  const cap = tankCapacity(save)
  const ref = document.createElement('button')
  ref.type = 'button'
  ref.textContent = save.fuel >= cap - 0.05 ? 'Tank is full (' + cap + ' gal)' : 'Fill the tank — free'
  ref.disabled = !here || save.fuel >= cap - 0.05
  ref.onclick = () => { save = refuel(save); toast('Tank full'); persist(); fillStore() }
  box.appendChild(ref)
  const level = save.aux || 0
  const need = level >= AUX.max ? null : AUX.need[level]
  const aux = document.createElement('div')
  aux.className = 'up' + (need != null && save.rep < need ? ' locked' : '')
  aux.innerHTML = '<b></b><span></span>'
  aux.querySelector('b').textContent = AUX.name + '  ' + level + '/' + AUX.max + ' · ' + cap + ' gal'
  aux.querySelector('span').textContent = AUX.blurb + (need == null ? '' : ' Next +' + AUX.add[level] + ' gal needs ' + need + ' rep.')
  const ab = document.createElement('button')
  ab.type = 'button'
  ab.textContent = need == null ? 'Maxed' : save.rep < need ? 'Locked · ' + need + ' rep' : 'Fit auxiliary tank'
  ab.disabled = !here || need == null || save.rep < need
  ab.onclick = () => { const n = buyAux(save); if (!n) return; save = n; toast('Tank is now ' + tankCapacity(save) + ' gal'); persist(); fillStore() }
  aux.appendChild(ab)
  box.appendChild(aux)
  const slots = jerrySlots(save.rep)
  const nextSlot = slots < JERRY.need.length ? JERRY.need[slots] : null
  const row = document.createElement('div')
  row.className = 'up' + (slots === 0 ? ' locked' : '')
  row.innerHTML = '<b></b><span></span>'
  row.querySelector('b').textContent = 'Jerry cans  ' + (save.jerry || 0) + '/' + Math.max(slots, save.jerry || 0)
  row.querySelector('span').textContent = JERRY.blurb + (nextSlot != null ? ' Next can at ' + nextSlot + ' rep.' : '')
  const jb = document.createElement('button')
  jb.type = 'button'
  jb.textContent = (save.jerry || 0) >= slots ? (nextSlot != null ? 'Locked · ' + nextSlot + ' rep' : 'Carrying all you can') : 'Take a can'
  jb.disabled = !here || (save.jerry || 0) >= slots
  jb.onclick = () => { const n = buyJerry(save); if (!n) return; save = n; toast('Jerry can in the rack'); persist(); fillStore() }
  row.appendChild(jb)
  box.appendChild(row)
  for (const key of ['salt', 'oil']) {
    const b = document.createElement('button')
    b.type = 'button'
    const n = (save.pantry && save.pantry[key]) || 0
    b.textContent = n >= 4 ? key + ' pouch is full' : 'Take ' + key + ' — free (' + n + '/4)'
    b.disabled = !here || n >= 4
    b.onclick = () => { save.pantry[key] = n + 1; toast('Took ' + key); persist(); fillStore() }
    box.appendChild(b)
  }
}
function syncSettings() {
  $('gfx').value = save.settings.gfx
  $('cycle').value = String(save.settings.cycle)
  $('tilt').checked = !!save.settings.tilt
  $('sound').checked = save.settings.sound !== false
  $('shake').checked = save.settings.shake !== false
}
function rolled() { return sim.upright() < ROLL_LIMIT }
function nearestAnchor() {
  const c = sim.chassis
  if (!c) return null
  let best = null
  let bd = 16
  for (const t of world.trees) {
    const d = Math.hypot(t.x - c.position.x, t.z - c.position.z)
    if (d < bd && d > 2.2) { bd = d; best = { x: t.x, y: t.y + 1.4, z: t.z } }
  }
  for (const r of world.rocks) {
    if (r.rad < 6) continue
    const d = Math.hypot(r.x - c.position.x, r.z - c.position.z)
    if (d < bd && d > 3) { bd = d; best = { x: r.x, y: world.height(r.x, r.z) + r.h * 0.8, z: r.z } }
  }
  return best
}
function firmSpot(x, z) {
  for (let ring = 8; ring <= 26; ring += 4) {
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * Math.PI * 2
      const px = x + Math.cos(ang) * ring
      const pz = z + Math.sin(ang) * ring
      if (world.mudDepth(px, pz) < 0.05 && world.waterDepth(px, pz) < 0.05 && world.surface(px, pz) !== SURF.water) {
        return { x: px, z: pz, y: world.height(px, pz) }
      }
    }
  }
  return { x: x + 14, z: z + 4, y: world.height(x + 14, z + 4) }
}
function yawOf(c) {
  return Math.atan2(2 * (c.quaternion.w * c.quaternion.y + c.quaternion.x * c.quaternion.z), 1 - 2 * (c.quaternion.y * c.quaternion.y + c.quaternion.z * c.quaternion.z))
}
function buildWrecker() {
  const g = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color: 0xe4572e, roughness: 0.32, metalness: 0.08 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x142028, roughness: 0.08, metalness: 0.15 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd5d2c8, metalness: 0.75, roughness: 0.28 })
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xfff1c4, emissiveIntensity: 0.6 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })
  const rim = new THREE.MeshStandardMaterial({ color: 0xf2efe6, metalness: 0.35, roughness: 0.35 })
  const add = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    g.add(m)
    return m
  }
  add(paint, 1.8, 0.7, 3.4, 0, 0.75, 0)
  add(paint, 1.55, 0.7, 1.25, 0, 1.35, 0.45)
  add(glass, 1.3, 0.42, 0.06, 0, 1.4, 1.05)
  add(chrome, 1.7, 0.14, 0.18, 0, 0.45, 1.7)
  add(dark, 0.16, 0.16, 1.5, 0, 1.85, -0.7)
  const boom = add(dark, 0.12, 0.12, 1.7, 0, 2.15, -1.35)
  boom.rotation.x = 0.45
  for (const [x, z] of [[-0.85, 1.15], [0.85, 1.15], [-0.85, -1.15], [0.85, -1.15]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), rubber)
    w.rotation.z = Math.PI / 2
    w.position.set(x, 0.4, z)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10), rim)
    cap.rotation.z = Math.PI / 2
    w.add(cap)
    g.add(w)
  }
  const spots = []
  for (const s of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff4d4, 0, 30, 0.5, 0.4, 1)
    spot.position.set(s * 0.4, 0.75, 1.55)
    const tgt = new THREE.Object3D()
    tgt.position.set(s * 0.1, -0.3, 14)
    g.add(spot, tgt)
    spot.target = tgt
    spots.push(spot)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lamp)
    bulb.position.set(s * 0.48, 0.62, 1.68)
    g.add(bulb)
  }
  g.userData.spots = spots
  g.userData.lamp = lamp
  g.userData.hook = new THREE.Vector3(0, 1.7, -1.7)
  return g
}
function approachPoint(px, pz, yaw) {
  let best = null
  for (const turn of [2.2, -2.2, 1.4, 2.8, 0.8]) {
    const ang = yaw + turn
    const dist = 20
    const x = px + Math.sin(ang) * dist
    const z = pz + Math.cos(ang) * dist
    if (world.surface(x, z) === SURF.water) continue
    const slope = Math.abs(world.height(x, z) - world.height(px, pz))
    if (!best || slope < best.slope) best = { x, z, ang, slope }
  }
  if (!best || best.slope > 7) {
    const ang = yaw + 1.7
    return { x: px + Math.sin(ang) * 8, z: pz + Math.cos(ang) * 8, ang, slope: 0, near: true }
  }
  return best
}
function startRecovery(reason) {
  if (recovery) return 'busy'
  if (!rolled() && !hazard.stuck) return 'not-stuck'
  noteAssist(save)
  const c = sim.chassis
  const yaw = yawOf(c)
  const from = approachPoint(c.position.x, c.position.z, yaw)
  const rig = buildWrecker()
  const night = isDark(save.clock)
  for (const s of rig.userData.spots) s.intensity = night ? 24 : 8
  rig.userData.lamp.emissiveIntensity = night ? 2.4 : 0.45
  rig.position.set(from.x, world.height(from.x, from.z) + 0.15, from.z)
  scene.add(rig)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf0c14a }))
  line.visible = false
  line.frustumCulled = false
  scene.add(line)
  recovery = { phase: 'drive', left: from.near ? 20 : 20, t: 0, rig, line, from, reason: reason || (rolled() ? 'roll' : hazard.stuck), firm: firmSpot(c.position.x, c.position.z) }
  persist()
  toast(recovery.reason === 'mud' ? 'Yard truck is coming to pull you out of the mud.' : recovery.reason === 'water' ? 'Yard truck is coming to drag you out of the creek.' : 'Yard truck is on the way.')
  return 'ok'
}
function cancelRecovery() {
  if (!recovery || recovery.phase === 'drag' || recovery.phase === 'leave') return
  recovery.phase = 'leave'
  recovery.t = 0
  recovery.line.visible = false
  toast('Call canceled.')
}
function updateCable() {
  if (!recovery || !recovery.line.visible) return
  const hook = recovery.rig.localToWorld(recovery.rig.userData.hook.clone())
  const c = sim.chassis
  const nose = new THREE.Vector3(0, 0.35, -(sim.spec.half[2] || 2) * 0.65)
  const qn = new THREE.Quaternion(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
  nose.applyQuaternion(qn).add(new THREE.Vector3(c.position.x, c.position.y, c.position.z))
  const pos = recovery.line.geometry.attributes.position
  pos.setXYZ(0, hook.x, hook.y, hook.z)
  pos.setXYZ(1, nose.x, nose.y, nose.z)
  pos.needsUpdate = true
}
function tickRecovery(dt) {
  if (!recovery) return
  const r = recovery
  const c = sim.chassis
  if (r.phase === 'drive') {
    r.left -= dt
    const u = 1 - Math.max(0, r.left) / 20
    const ease = u * u * (3 - 2 * u)
    const park = r.firm
    const x = r.from.x + (park.x - r.from.x) * ease
    const z = r.from.z + (park.z - r.from.z) * ease
    const y = world.height(x, z) + 0.2
    r.rig.position.set(x, y, z)
    r.rig.rotation.set(0, Math.atan2(c.position.x - x, c.position.z - z), 0)
    if (r.left <= 0) { r.phase = 'hook'; r.t = 0; r.line.visible = true }
  } else if (r.phase === 'hook') {
    r.t += dt
    updateCable()
    if (r.t > 1.1) {
      r.phase = 'drag'
      r.t = 0
      r.startQ = new THREE.Quaternion(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
      r.endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yawOf(c), 0))
      r.start = { x: c.position.x, y: c.position.y, z: c.position.z }
      const drop = { x: r.firm.x + Math.sin(yawOf(c)) * 4, z: r.firm.z + Math.cos(yawOf(c)) * 4 }
      r.end = { x: drop.x, y: world.height(drop.x, drop.z) + 1.2, z: drop.z }
    }
  } else if (r.phase === 'drag') {
    r.t += dt
    const u = Math.min(1, r.t / 2.6)
    const e = u * u * (3 - 2 * u)
    const q = r.startQ.clone().slerp(r.endQ, e)
    c.quaternion.set(q.x, q.y, q.z, q.w)
    c.position.set(r.start.x + (r.end.x - r.start.x) * e, r.start.y + (r.end.y - r.start.y) * e, r.start.z + (r.end.z - r.start.z) * e)
    c.velocity.set(0, 0, 0)
    c.angularVelocity.set(0, 0, 0)
    updateCable()
    if (u >= 1) {
      r.phase = 'leave'
      r.t = 0
      r.line.visible = false
      hazard.stuck = ''
      hazard.mud = 0
      hazard.sink = 0
      toast('Back on firm ground.')
    }
  } else if (r.phase === 'leave') {
    r.t += dt
    r.rig.position.x += Math.sin(r.rig.rotation.y) * dt * 5
    r.rig.position.z += Math.cos(r.rig.rotation.y) * dt * 5
    r.rig.position.y = world.height(r.rig.position.x, r.rig.position.z) + 0.2
    if (r.t > 2.4) {
      scene.remove(r.rig)
      scene.remove(r.line)
      recovery = null
    }
  }
}
function refreshRecover() {
  const box = $('recover')
  if (!box) return
  const need = !!(recovery || rolled() || hazard.stuck)
  box.hidden = !need || mode === 'title'
  const title = $('recover-title')
  const sub = $('recover-sub')
  const time = $('recover-time')
  const btn = $('btn-call')
  const reset = $('btn-reset')
  if (reset) reset.disabled = !!(rolled() || hazard.stuck || recovery)
  if (!need) return
  if (!recovery) {
    if (time) time.hidden = true
    const copy = recoveryCopy(sim.upright(), hazard.stuck) || { title: 'Call for recovery', reason: 'roll' }
    const flooded = copy.reason === 'water'
    const bogged = copy.reason === 'mud'
    if (title) title.textContent = copy.title
    const winchHint = anchor ? ' A tree or rock is in winch range.' : ''
    if (sub) sub.textContent = (flooded ? 'The intake is under. You will not restart it here.' : bogged ? 'You will not crawl out of this.' : 'You are on your side. A yard truck can roll you back.') + winchHint
    if (btn) { btn.hidden = false; btn.textContent = 'Call' }
  } else if (recovery.phase === 'drive') {
    if (time) { time.hidden = false; time.textContent = String(Math.max(0, Math.ceil(recovery.left))) }
    if (title) title.textContent = 'Recovery on the way'
    if (sub) sub.textContent = 'Keep the radio on. Cancel if you get out yourself.'
    if (btn) { btn.hidden = false; btn.textContent = 'Cancel' }
  } else if (recovery.phase === 'hook' || recovery.phase === 'drag') {
    if (time) time.hidden = true
    if (title) title.textContent = 'Hooked up'
    if (sub) sub.textContent = recovery.reason === 'roll' ? 'Rolling you back onto the wheels.' : 'Dragging you to firm ground.'
    if (btn) btn.hidden = true
  } else {
    if (btn) btn.hidden = true
    if (time) time.hidden = true
    if (title) title.textContent = 'Recovery leaving'
    if (sub) sub.textContent = ''
  }
}
function doReset() {
  if (rolled() || hazard.stuck) { startRecovery(rolled() ? 'roll' : hazard.stuck); return }
  if (recovery) return
  noteAssist(save)
  sim.reset()
  toast('Back on your wheels')
}
function cycleLights() {
  save.lights = save.lights === 'auto' ? 'on' : save.lights === 'on' ? 'off' : 'auto'
  persist()
}
function hold(id, key) {
  const el = $(id)
  const down = e => { e.preventDefault(); pad[key] = 1 }
  const up = e => { e.preventDefault(); pad[key] = 0 }
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('pointerleave', up)
}
hold('btn-gas', 'gas')
hold('btn-brake', 'brake')
hold('btn-left', 'left')
hold('btn-right', 'right')
hold('btn-winch', 'winch')
hold('btn-hand', 'hand')
$('btn-lock').onclick = () => { lockOn = !lockOn }
$('btn-low').onclick = () => { lowOn = !lowOn }
$('btn-reset').onclick = () => doReset()
$('btn-call').onclick = () => { if (recovery && recovery.phase === 'drive') cancelRecovery(); else startRecovery() }
$('btn-lights').onclick = () => cycleLights()
$('btn-beam').onclick = () => { save.highbeam = !save.highbeam; persist() }
$('btn-store').onclick = () => { if (nearStore() && mode === 'play') { fillStore(); showPanel('store') } }
$('btn-jerry').onclick = () => { const n = useJerry(save); if (!n) return; save = n; toast('Poured 5 gal'); persist() }
$('btn-cam').onclick = () => {
  camMode = camMode === 'chase' ? 'hood' : camMode === 'hood' ? 'orbit' : 'chase'
  toast(camMode === 'chase' ? 'Chase' : camMode === 'hood' ? 'Hood' : 'Orbit')
}
$('btn-map').onclick = () => { if (mode === 'play') { showPanel('mapfull'); drawMap($('mapbig'), true) } }
$('btn-menu').onclick = () => { if (mode === 'play') showPanel('pause') }
$('btn-resume').onclick = closePanels
$('btn-quit').onclick = () => { capturePose(); persist(); enterTitle() }
$('btn-jobs').onclick = () => { fillAdventures(); showPanel('jobs') }
$('btn-garage').onclick = () => { fillGarage(); showPanel('garage') }
$('btn-jobs-close').onclick = () => showPanel('pause')
$('btn-garage-close').onclick = () => showPanel('pause')
$('btn-store-close').onclick = () => closePanels()
$('btn-map-close').onclick = closePanels
$('btn-help').onclick = () => showPanel('help')
$('btn-pause-help').onclick = () => showPanel('help')
$('btn-help-close').onclick = () => { if (mode === 'title') { document.querySelectorAll('.panel').forEach(p => p.classList.remove('show')) } else showPanel('pause') }
$('btn-settings').onclick = () => { syncSettings(); showPanel('settings') }
$('btn-pause-settings').onclick = () => { syncSettings(); showPanel('settings') }
$('btn-settings-close').onclick = () => { if (mode === 'title') { document.querySelectorAll('.panel').forEach(p => p.classList.remove('show')) } else showPanel('pause') }
$('gfx').onchange = () => {
  save.settings.gfx = $('gfx').value
  capturePose(); persist()
  sessionStorage.setItem('oxbow_hot', mode === 'play' || mode === 'pause' ? '1' : '0')
  location.reload()
}
$('cycle').onchange = () => { save.settings.cycle = Number($('cycle').value); persist() }
$('tilt').onchange = () => { save.settings.tilt = $('tilt').checked; persist() }
$('sound').onchange = () => { save.settings.sound = $('sound').checked; persist() }
$('shake').onchange = () => { save.settings.shake = $('shake').checked; persist() }
$('btn-wipe').onclick = () => {
  if (!wiped) { wiped = true; $('btn-wipe').textContent = 'Tap again to erase'; return }
  localStorage.removeItem(SAVE_KEY)
  save = freshSave({ settings: save.settings })
  enterTitle()
  toast('Run erased')
}
$('btn-new').onclick = () => {
  const settings = save.settings
  save = freshSave({ settings })
  save.x = yard.x; save.z = yard.z + 8; save.y = yard.y + 2
  startPlay(null)
  toast('Hollow Creek. The yard is behind you.')
}
$('btn-continue').onclick = () => {
  const loaded = loadSave()
  if (loaded) startPlay(loaded)
}
document.addEventListener('keydown', e => {
  const map = { KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyA: 'a', ArrowLeft: 'a', KeyD: 'd', ArrowRight: 'd', Space: 'space', KeyF: 'f' }
  if (map[e.code]) { keys[map[e.code]] = 1; e.preventDefault() }
  if (e.code === 'KeyC') { $('btn-cam').click() }
  if (e.code === 'KeyR') doReset()
  if (e.code === 'KeyL') lockOn = !lockOn
  if (e.code === 'KeyK') lowOn = !lowOn
  if (e.code === 'KeyH') cycleLights()
  if (e.code === 'KeyB') { save.highbeam = !save.highbeam; persist() }
  if (e.code === 'KeyM') $('btn-map').click()
  if (e.code === 'KeyE' && nearStore() && mode === 'play') { fillStore(); showPanel('store') }
  if (e.code === 'KeyJ' && mode === 'play') { fillAdventures(); showPanel('jobs') }
  if (e.code === 'KeyG' && mode === 'play') { fillGarage(); showPanel('garage') }
  if (e.code === 'Escape') { if (mode === 'play') showPanel('pause'); else if (mode === 'pause') closePanels() }
})
document.addEventListener('keyup', e => {
  const map = { KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyA: 'a', ArrowLeft: 'a', KeyD: 'd', ArrowRight: 'd', Space: 'space', KeyF: 'f' }
  if (map[e.code]) keys[map[e.code]] = 0
})
let drag = null
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false } })
window.addEventListener('pointermove', e => {
  if (!drag) return
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y
  if (Math.hypot(dx, dy) > 6) drag.moved = true
  if (!drag.moved || mode === 'title') return
  camMode = 'orbit'
  orbitYaw -= dx * 0.008
  orbitPitch = Math.max(-0.2, Math.min(1.1, orbitPitch + dy * 0.006))
  drag.x = e.clientX; drag.y = e.clientY
})
window.addEventListener('pointerup', () => { drag = null })
canvas.addEventListener('wheel', e => { orbitDist = Math.max(4, Math.min(22, orbitDist + Math.sign(e.deltaY))) }, { passive: true })
window.addEventListener('deviceorientation', e => {
  const ang = (screen.orientation && screen.orientation.angle) || 0
  let t = e.gamma || 0
  if (ang === 90) t = e.beta || 0
  else if (ang === 270 || ang === -90) t = -(e.beta || 0)
  tiltV = Math.max(-1, Math.min(1, t / 28))
})
let audio
function ensureAudio() {
  if (audio || save.settings.sound === false) return
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return
  const ctx = new Ctx()
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  filter.type = 'lowpass'
  filter.frequency.value = 420
  gain.gain.value = 0
  osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
  osc.start()
  audio = { ctx, osc, gain }
}
function rev() {
  if (!audio) return
  const throttle = mode === 'play' ? Math.max(keys.w, pad.gas) : 0
  const freq = 42 + Math.abs(lastSpeed) * 3 + throttle * 36
  audio.osc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.08)
  const vol = save.settings.sound && mode === 'play' ? 0.012 + throttle * 0.02 : 0
  audio.gain.gain.setTargetAtTime(vol, audio.ctx.currentTime, 0.08)
}
window.addEventListener('pointerdown', () => { try { ensureAudio() } catch (e) {} }, { once: false })

const dust = []
if (gfx().dust) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xc4a27a, transparent: true, opacity: 0.35, depthWrite: false })
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), mat.clone())
    m.visible = false
    scene.add(m)
    dust.push({ m, life: 0, vx: 0, vz: 0 })
  }
}
let dustN = 0
function puff(x, y, z, mud) {
  if (!dust.length) return
  const d = dust[dustN++ % dust.length]
  d.life = mud ? 0.9 : 0.7
  d.m.visible = true
  d.m.material.color.set(mud ? 0x4a3018 : 0xc4a27a)
  d.m.position.set(x, y + (mud ? 0.2 : 0), z)
  d.m.scale.setScalar(mud ? 0.7 : 0.4)
  d.vx = (Math.random() - 0.5) * (mud ? 2.4 : 1.5)
  d.vz = (Math.random() - 0.5) * (mud ? 2.4 : 1.5)
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight
  const pr = Math.min(gfx().dpr, window.devicePixelRatio || 1) * dprScale
  renderer.setPixelRatio(Math.max(0.6, pr))
  renderer.setSize(w, h, false)
  camera.aspect = w / Math.max(1, h)
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

await preloadRigs()
buildTerrain()
scatter()
buildCamps()
sim.spawn('mule', { x: yard.x, z: yard.z + 8 }, save.upgrades)
buildTruck(sim.spec)
for (let i = 0; i < 40; i++) sim.step(1 / 60, zeroInput())
enterTitle()
if (sessionStorage.getItem('oxbow_hot') === '1') {
  sessionStorage.removeItem('oxbow_hot')
  const loaded = loadSave()
  if (loaded) startPlay(loaded)
}

let campOn = false
const firePos = new THREE.Vector3()
let campGroup = null
let fireLight = null
let play = null
const embers = new Float32Array(18 * 3)
const emberLife = new Float32Array(18)
function pitchCamp() {
  const c = sim.chassis
  if (!c) return
  if (!canPitch(world, c.position.x, c.position.z, sim.upright(), lastSpeed)) { toast('Too steep, or still rolling.'); return }
  packCamp(true)
  campOn = true
  mode = 'camp'
  app.classList.add('camping')
  q.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  firePos.set(c.position.x + right.x * 3.4, world.height(c.position.x + right.x * 3.4, c.position.z + right.z * 3.4), c.position.z + right.z * 3.4)
  campGroup = new THREE.Group()
  const tentMat = new THREE.MeshStandardMaterial({ color: save.camp.tent >= 1 ? 0xd8c7a2 : 0xc4552e, roughness: 0.85 })
  const tent = save.camp.tent >= 2
    ? new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.55, 4), tentMat)
    : new THREE.Mesh(new THREE.ConeGeometry(save.camp.tent ? 1.5 : 1.05, save.camp.tent ? 1.3 : 0.9, 4), tentMat)
  if (save.camp.tent >= 2) { tent.position.set(0, 1.25, -0.15); truck.add(tent); tent.userData.roof = true }
  else { tent.position.set(firePos.x - right.x * 1.6, firePos.y + 0.45, firePos.z - right.z * 1.6); campGroup.add(tent) }
  const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x4a3424 }))
  logs.rotation.z = Math.PI / 2
  logs.position.copy(firePos)
  logs.position.y += 0.08
  campGroup.add(logs)
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x6e675f }))
  pit.position.copy(firePos); pit.position.y += 0.02
  campGroup.add(pit)
  if (save.camp.chairs) {
    for (const s of [-1, 1]) {
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), new THREE.MeshStandardMaterial({ color: 0x2a241c }))
      chair.position.set(firePos.x + s * 1.1, firePos.y + 0.25, firePos.z + 0.4)
      campGroup.add(chair)
    }
  }
  if (save.camp.lights) {
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffe7a0, emissiveIntensity: 1.4 }))
      lamp.position.set(firePos.x - 1.2 + i * 0.8, firePos.y + 1.6, firePos.z - 0.4)
      campGroup.add(lamp)
    }
  }
  fireLight = new THREE.PointLight(0xff7a2a, 6, 14, 2)
  fireLight.position.copy(firePos); fireLight.position.y += 0.4
  campGroup.add(fireLight)
  scene.add(campGroup)
  save.respawn = { x: c.position.x, y: c.position.y, z: c.position.z }
  const adv = tickAdventure(save, { x: c.position.x, z: c.position.z, speed: 0, clock: save.clock, dt: 0, water: false, ford: world.ford, pois: poiById, camped: true })
  if (adv && adv.advanced) toast(adv.step.text)
  if (adv && adv.done) toast(adv.adv.name + '  +' + adv.gain + ' rep')
  const bar = $('campbar'); if (bar) bar.hidden = false
  refreshCampActs()
  persist()
  toast('Camp is set. The fire is yours.')
}
function refreshCampActs() {
  const c = sim.chassis
  if (!c) return
  const st = activityState(world, c.position.x, c.position.z, save)
  for (const id of ['fish', 'hunt', 'cook']) {
    const b = $('camp-' + id)
    if (!b) continue
    const label = id === 'fish' ? 'Fish' : id === 'hunt' ? 'Hunt' : 'Cook'
    b.classList.toggle('locked', !st[id].ok)
    b.dataset.reason = st[id].reason || ''
    b.replaceChildren(document.createTextNode(label))
    if (!st[id].ok) {
      const small = document.createElement('small')
      small.textContent = st[id].reason
      b.appendChild(small)
    }
  }
}
function campBlocked(kind) {
  const c = sim.chassis
  if (!c) return 'Camp is not set.'
  const st = activityState(world, c.position.x, c.position.z, save)
  return st[kind] && st[kind].ok ? '' : (st[kind] && st[kind].reason) || 'Not here'
}
function packCamp(silent) {
  if (campGroup) { scene.remove(campGroup); campGroup = null; fireLight = null }
  if (truck) truck.children.filter(ch => ch.userData && ch.userData.roof).forEach(ch => truck.remove(ch))
  campOn = false
  if (mode === 'camp') mode = 'play'
  app.classList.remove('camping')
  const bar = $('campbar'); if (bar) bar.hidden = true
  const playEl = $('play'); if (playEl) playEl.hidden = true
  play = null
  if (!silent) toast('Camp packed.')
}
function restCamp(which) {
  save.clock = which === 'morning' ? 0.3 : 0.73
  const adv = tickAdventure(save, { x: sim.chassis.position.x, z: sim.chassis.position.z, speed: 0, clock: save.clock, dt: 0, water: false, ford: world.ford, pois: poiById, rested: which, camped: true })
  if (adv && adv.done) toast(adv.adv.name + '  +' + adv.gain + ' rep')
  else toast(which === 'morning' ? 'Morning on the ridge.' : 'Evening settles in.')
  persist()
}
function flickerFire(dt) {
  if (!fireLight) return
  fireLight.intensity = 4.2 + Math.sin(performance.now() * 0.012) * 0.7 + Math.random() * 0.5
}
function noteCatch(fish) {
  save.log.fish[fish.id] = save.log.fish[fish.id] || { n: 0, best: 0 }
  save.log.fish[fish.id].n++
  save.log.fish[fish.id].best = Math.max(save.log.fish[fish.id].best, fish.cm)
  if (fish.id === 'trout') save.pantry.trout++
  else save.pantry.fish++
  const adv = tickAdventure(save, { x: sim.chassis.position.x, z: sim.chassis.position.z, speed: 0, clock: save.clock, dt: 0, water: false, ford: world.ford, pois: poiById, catch: fish.id })
  if (adv && adv.done) toast(adv.adv.name + '  +' + adv.gain + ' rep')
}
function openPlay(kind) {
  if (!campOn) return
  const why = campBlocked(kind)
  if (why) { toast(why); return }
  const region = world.regionAt(sim.chassis.position.x, sim.chassis.position.z).id
  const animals = gameFor(region)
  play = { kind, phase: kind === 'cook' ? 'pick' : kind === 'hunt' ? 'stalk' : 'cast', t: 0, mark: 0, dir: 1, good: 0, animals: animals.map((g, i) => ({ ...g, x: 0.15 + i * 0.28 })) }
  const recipes = $('play-recipes')
  recipes.replaceChildren()
  recipes.hidden = kind !== 'cook'
  if (kind === 'cook') {
    for (const r of RECIPES) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = r.name + (canCook(save.pantry, r) ? '' : ' — need ingredients')
      b.disabled = !canCook(save.pantry, r)
      b.onclick = () => { play.recipe = r.id; play.phase = 'heat'; play.mark = 0; play.dir = 1; recipes.hidden = true }
      recipes.appendChild(b)
    }
  }
  $('play').hidden = false
  $('play-title').textContent = kind === 'fish' ? 'Fishing' : kind === 'hunt' ? 'The quiet hunt' : 'Cook fire'
  $('play-canvas').hidden = kind !== 'hunt'
  $('play-bar').hidden = kind === 'hunt' || kind === 'cook' && play.phase === 'pick'
  drawPlay()
}
function drawPlay() {
  if (!play) return
  const title = $('play-text')
  const bar = $('play-bar')
  const mark = $('play-mark')
  const sweet = $('play-sweet')
  if (play.kind === 'fish' && play.phase === 'cast') title.textContent = 'Tap as the mark crosses the bright band.'
  if (play.kind === 'fish' && play.phase === 'wait') title.textContent = 'The line is out. Wait for the bite.'
  if (play.kind === 'fish' && play.phase === 'bite') title.textContent = 'Bite. Tap now.'
  if (play.kind === 'fish' && play.phase === 'reel') title.textContent = 'Hold to lift the mark. Keep it in the band.'
  if (play.kind === 'cook' && play.phase === 'pick') title.textContent = 'Salt and oil are free at a store. Fish and meat come from the creek and the field.'
  if (play.kind === 'cook' && play.phase === 'heat') title.textContent = 'Tap while the mark sits in the gold.'
  if (play.kind === 'hunt') title.textContent = save.camp.hunt >= 3 ? 'A fair shot. Tap when the sight covers the animal.' : 'Photos only. Tap when the sight covers the animal.'
  if (mark) mark.style.left = (play.mark * 100) + '%'
  if (sweet && play.kind !== 'hunt') {
    const w = play.kind === 'fish' && play.phase === 'reel' ? reelBand(save.camp.rod) : 0.09 + save.camp.pit * 0.04
    const c = play.kind === 'fish' && play.phase === 'reel' ? (play.zone || 0.5) : play.phase === 'cast' ? 0.62 : 0.66
    sweet.style.left = ((c - w / 2) * 100) + '%'
    sweet.style.width = (w * 100) + '%'
  }
  bar.hidden = play.kind === 'hunt' || (play.kind === 'cook' && play.phase === 'pick')
  if (play.kind === 'hunt') drawHunt()
}
function drawHunt() {
  const cv = $('play-canvas')
  const g = cv.getContext('2d')
  g.fillStyle = '#1c2418'; g.fillRect(0, 0, cv.width, cv.height)
  g.fillStyle = '#3d4a32'; g.fillRect(0, 150, cv.width, 130)
  play.animals.forEach(a => {
    const x = a.x * cv.width
    g.fillStyle = a.id === 'deer' || a.id === 'goat' ? '#c4b49a' : a.id === 'turkey' || a.id === 'quail' ? '#6a4030' : '#d9d3c4'
    g.fillRect(x, 168, a.size * cv.width, 28)
  })
  const ax = play.mark * cv.width
  g.strokeStyle = '#f0c14a'; g.strokeRect(ax - 14, 160, 28, 40)
}
function tickPlay(dt) {
  if (!play) return
  if (play.phase === 'cast' || play.phase === 'heat') {
    play.mark += play.dir * dt * (play.phase === 'heat' ? 0.55 - save.camp.pit * 0.08 : 0.7)
    if (play.mark > 1) { play.mark = 1; play.dir = -1 }
    if (play.mark < 0) { play.mark = 0; play.dir = 1 }
  }
  if (play.phase === 'wait') {
    play.t += dt
    if (play.t > 1.1 + Math.random() * 0.2) { play.phase = 'bite'; play.t = 0 }
  }
  if (play.phase === 'bite') {
    play.t += dt
    if (play.t > biteSeconds(save.camp.rod)) { play = null; $('play').hidden = true; toast('The fish slipped off.'); return }
  }
  if (play.phase === 'reel') {
    play.zone += play.dir * dt * 0.35
    if (play.zone > 0.85) play.dir = -1
    if (play.zone < 0.15) play.dir = 1
    play.mark += ((play.hold ? 1 : 0) - 0.35) * dt * 0.8
    play.mark = Math.max(0, Math.min(1, play.mark))
    if (Math.abs(play.mark - play.zone) < reelBand(save.camp.rod) / 2) play.good += dt
    else play.good = Math.max(0, play.good - dt * 0.5)
    if (play.good > 2.2) {
      const fish = rollFish(world, sim.chassis.position.x, sim.chassis.position.z, save.clock, save.camp.rod, Math.random)
      noteCatch(fish)
      toast(fish.name + ', ' + fish.cm + ' cm')
      play = null; $('play').hidden = true; persist(); return
    }
  }
  if (play.phase === 'stalk') {
    play.animals.forEach(a => { a.x += a.speed * dt * 0.15; if (a.x > 1.05) a.x = -0.05 })
    play.mark = 0.5 + Math.sin(performance.now() * 0.0015) * 0.28
  }
  drawPlay()
}
function playTap() {
  if (!play) return
  if (play.phase === 'cast') {
    const ok = Math.abs(play.mark - 0.62) < 0.12
    play.phase = 'wait'; play.t = ok ? 0.6 : 0
    return
  }
  if (play.phase === 'bite') {
    play.phase = 'reel'; play.zone = 0.5; play.mark = 0.3; play.good = 0; play.dir = 1
    return
  }
  if (play.phase === 'heat') {
    const grade = cookJudge(play.mark, save.camp.pit)
    const recipe = RECIPES.find(r => r.id === play.recipe)
    const res = applyCook(save, recipe, grade)
    save = res.save
    toast(res.text)
    play = null; $('play').hidden = true; persist()
    return
  }
  if (play.phase === 'stalk') {
    let best = null
    for (const a of play.animals) {
      const hit = aimHit(play.mark, a.x, a.size, save.camp.hunt)
      if (hit.hit && (!best || a.size > best.size)) best = { a, hit }
    }
    if (!best) { toast('The grass moved. Nothing else.'); return }
    save.log.photos[best.a.id] = (save.log.photos[best.a.id] || 0) + 1
    if (best.hit.meat) { save.pantry.meat++; toast('A fair shot. ' + best.a.name + ' for the fire.') }
    else toast('A clean photo of a ' + best.a.name.toLowerCase() + '.')
    best.a.x = 1.2
    persist()
  }
}
$('btn-camp').onclick = () => pitchCamp()
$('camp-pack').onclick = () => packCamp(false)
$('camp-morn').onclick = () => restCamp('morning')
$('camp-eve').onclick = () => restCamp('evening')
$('camp-fish').onclick = () => openPlay('fish')
$('camp-hunt').onclick = () => openPlay('hunt')
$('camp-cook').onclick = () => openPlay('cook')
$('play-close').onclick = () => { play = null; $('play').hidden = true }
$('play-act').addEventListener('pointerdown', e => { e.preventDefault(); if (play) play.hold = 1; playTap() })
$('play-act').addEventListener('pointerup', () => { if (play) play.hold = 0 })
$('btn-return').onclick = () => {
  if (!save.respawn) return
  sim.place(save.respawn.x, save.respawn.z, 0)
  closePanels()
  toast('Back at camp.')
}

let last = performance.now()
let acc = 0
const errors = []
window.addEventListener('error', e => errors.push(String(e.message || e.error || 'error')))
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (save.buff && save.buff.left > 0 && mode !== 'title') {
    save.buff.left -= dt
    if (save.buff.left <= 0) save.buff = null
  }
  if (mode === 'camp') tickPlay(dt)
  const dragging = recovery && recovery.phase === 'drag'
  if (!freeze && !dragging && (mode === 'play' || mode === 'title')) {
    acc += dt
    let steps = 0
    const input = mode === 'play' ? sampleInput(dt) : zeroInput()
    while (acc >= 1 / 60 && steps < 3) {
      const r = sim.step(1 / 60, input)
      if (r) {
        lastSpeed = r.speed
        lastSurf = r.surf
        if (!recovery || recovery.phase === 'drive') hazard = { stuck: r.stuck || '', mud: r.mud || 0, water: r.water || 0, sink: r.sink || 0, wade: r.wade || 0.7, bogAt: r.bogAt || 0.6 }
      }
      if (mode === 'play') sim.syncSolids(world.trees, world.rocks)
      acc -= 1 / 60
      steps++
    }
    if (mode === 'play') {
      const throttle = input.fuel > 0 ? input.throttle : 0
      const sip = (save.buff && save.buff.fuel) || 1
      save.fuel = burnFuel(save.fuel, Math.max(throttle, input.brake > 0 && lastSpeed < 0.4 ? input.brake : 0) * sip, dt)
    }
  }
  tickRecovery(dt)
  if (hazard.mud > 0.18 && (keys.w || pad.gas) && wheels[0]) {
    const w = wheels[Math.floor(Math.random() * wheels.length)]
    if (w) puff(w.position.x, w.position.y, w.position.z, true)
  }
  if (blades) blades.rotation.z += dt * 0.7
  if (dust.length && mode === 'play' && Math.abs(lastSpeed) > 4 && lastSurf !== 4 && lastSurf !== 5) {
    const w = wheels[2]
    if (w && Math.random() < 0.6) puff(w.position.x, w.position.y, w.position.z)
  }
  for (const d of dust) {
    if (d.life <= 0) continue
    d.life -= dt
    d.m.position.x += d.vx * dt
    d.m.position.y += dt * 0.8
    d.m.position.z += d.vz * dt
    d.m.scale.setScalar(0.4 + (0.7 - d.life))
    d.m.material.opacity = Math.max(0, d.life) * 0.4
    d.m.lookAt(camera.position)
    if (d.life <= 0) d.m.visible = false
  }
  syncTruck()
  updateLamps()
  tickMotes(dt)
  updateCamera(dt)
  if (mode === 'play' || mode === 'camp') updateGame(dt)
  if (mode === 'camp') flickerFire(dt)
  renderer.render(scene, camera)
  if (mode === 'play' || mode === 'camp') updateHud()
  rev()
  adaptAcc += dt
  if (adaptAcc > 2.5 && mode === 'play') {
    adaptAcc = 0
    if (dt > 0.022 && dprScale > 0.65) {
      dprScale *= 0.85
      resize()
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

window.OX = {
  OFFROAD_V2,
  get mode() { return mode },
  get speed() { return lastSpeed },
  get pos() { const c = sim.chassis; return c ? { x: c.position.x, y: c.position.y, z: c.position.z } : null },
  get ready() { return !!sim.chassis },
  get errors() { return errors },
  get gfx() { return save.settings.gfx },
  get clock() { return save.clock },
  get lights() { return { mode: save.lights, high: !!save.highbeam, on: !!(truck && truck.userData && truck.userData.lamps[0].intensity > 0) } },
  setClock(t) { save.clock = t; applyTime(t) },
  setCam(kind, dist, yaw, pitch) { camMode = kind; if (dist) orbitDist = dist; if (yaw != null) orbitYaw = yaw; if (pitch != null) orbitPitch = pitch },
  open(id) { if (id === 'jobs') fillAdventures(); if (id === 'garage') fillGarage(); if (id === 'store') fillStore(); showPanel(id) },
  use(id) { save.vehicle = id; if (!save.owned.includes(id)) save.owned.push(id); sim.spawn(id, { x: sim.chassis.position.x, y: sim.chassis.position.y + 0.4, z: sim.chassis.position.z }, save.upgrades); buildTruck(sim.spec) },
  goto(id) { const p = poiById[id]; if (!p) return; sim.place(p.x + 4, p.z + 6, 0) },
  region() { const c = sim.chassis; return c ? world.regionAt(c.position.x, c.position.z) : null },
  acts() { const c = sim.chassis; return c ? activityState(world, c.position.x, c.position.z, save) : null },
  vista(x, z, yaw, dist) {
    holdCam = true
    freeze = true
    recovery = null
    hazard = { stuck: '', mud: 0, water: 0, sink: 0, wade: 0.7, bogAt: 0.6 }
    mode = 'play'
    app.classList.add('playing')
    app.classList.remove('title', 'camping')
    const bar = $('campbar'); if (bar) bar.hidden = true
    const rec = $('recover'); if (rec) rec.hidden = true
    $('fliphint').classList.remove('show')
    sim.place(x, z, yaw || 0)
    const y = world.height(x, z)
    const d = dist || 18
    const yawN = yaw || 0
    const camX = x - Math.sin(yawN) * d
    const camZ = z - Math.cos(yawN) * d * 0.45
    const camY = Math.max(y, world.height(camX, camZ)) + 6.4
    camera.position.set(camX, camY, camZ)
    camera.lookAt(x + Math.sin(yawN) * 28, y + 2.2, z + Math.cos(yawN) * 28)
    applyTime(save.clock)
  },
  pitch() { pitchCamp() },
  showPlay(kind) { openPlay(kind) },
  get hazard() { return hazard },
  get rolled() { return rolled() },
  get recovery() { return recovery ? recovery.phase : '' },
  lean(deg) {
    const c = sim.chassis
    const yaw = yawOf(c)
    c.quaternion.setFromEuler((deg || 28) * Math.PI / 180, yaw, (deg || 28) * 0.25 * Math.PI / 180)
    c.velocity.set(0, 0, 0)
    c.angularVelocity.set(0, 0, 0)
  },
  tip() {
    const c = sim.chassis
    c.quaternion.setFromEuler(Math.PI * 0.55, yawOf(c), 0.2)
    c.velocity.set(0, 0, 0)
  },
  bogHere() {
    let best = null
    for (let i = 0; i < world.gridN; i += 3) {
      for (let j = 0; j < world.gridN; j += 3) {
        const x = -HALF + (i / (world.gridN - 1)) * WORLD_SIZE
        const z = HALF - (j / (world.gridN - 1)) * WORLD_SIZE
        const d = world.mudDepth(x, z)
        if (!best || d > best.d) best = { x, z, d }
      }
    }
    sim.place(best.x, best.z, 0)
    return best
  },
  hold() { freeze = true; this.level() },
  level() {
    const c = sim.chassis
    c.quaternion.setFromEuler(0, yawOf(c), 0)
    c.angularVelocity.set(0, 0, 0)
    c.velocity.set(0, 0, 0)
  },
  deepWater() {
    let best = null
    for (let i = 0; i < world.gridN; i += 3) {
      for (let j = 0; j < world.gridN; j += 3) {
        const x = -HALF + (i / (world.gridN - 1)) * WORLD_SIZE
        const z = HALF - (j / (world.gridN - 1)) * WORLD_SIZE
        const d = world.waterDepth(x, z)
        if (d > 1.2 && (!best || d > best.d)) best = { x, z, d }
      }
    }
    if (best) sim.place(best.x, best.z, 0)
    return best
  },
  call() { return startRecovery() },
  rush() { if (recovery && recovery.phase === 'drive') recovery.left = 0.2 },
  frameTow() {
    if (!recovery) return
    holdCam = true
    const p = recovery.rig.position
    const c = sim.chassis.position
    camera.position.set((p.x + c.x) / 2 + 3, Math.max(p.y, c.y) + 4.5, (p.z + c.z) / 2 + 12)
    camera.lookAt((p.x + c.x) / 2, c.y + 0.8, (p.z + c.z) / 2)
  },
  frameRig(yaw) {
    holdCam = true
    freeze = true
    mode = 'play'
    app.classList.add('playing')
    app.classList.remove('title')
    const c = sim.chassis
    const p = c.position
    const dist = 5.6
    camera.position.set(p.x + Math.sin(yaw) * dist, p.y + 2.15, p.z + Math.cos(yaw) * dist)
    camera.lookAt(p.x, p.y + 0.65, p.z)
    applyTime(0.48)
  },
  lineup() {
    const ids = Object.keys(VEHICLES)
    const detail = save.settings.gfx === 'high' ? 4 : 3
    const zFront = yard.z + 16
    ids.forEach((id, i) => {
      const spec = specWithUpgrades(id, save.upgrades)
      const built = buildRig(THREE, spec, { livery: i % spec.liveries.length, rack: rigLook(id).rack, shadow: false, detail, env: envTex })
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = (col - 1) * 5.2
      const z = zFront + row * 7.4
      const gy = world.height(x, z)
      const wy = -0.05 - spec.rest
      built.group.position.set(x, gy + spec.wheelR - wy, z)
      built.group.rotation.y = Math.PI - 0.42
      built.wheels.forEach((w, wi) => {
        const side = wi % 2 === 0 ? -1 : 1
        const front = wi < 2 ? 1 : -1
        w.position.set(side * spec.track, wy, front * spec.wheelbase)
        built.group.add(w)
      })
      scene.add(built.group)
    })
    if (truck) truck.visible = false
    wheels.forEach(w => w.visible = false)
    const gy = world.height(0, zFront)
    camera.fov = 62
    camera.updateProjectionMatrix()
    camera.position.set(1.6, gy + 3.6, zFront - 9.2)
    camera.lookAt(0, gy + 0.9, zFront + 2.4)
    holdCam = true
  },
  prep(camp, pantry) { if (camp) Object.assign(save.camp, camp); if (pantry) Object.assign(save.pantry, pantry) }
}
