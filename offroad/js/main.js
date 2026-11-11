// Oxbow — Hollow Creek. OFFROAD_V2
import * as THREE from '../vendor/three.module.js'
import { createWorld, WORLD_SIZE, HALF, SURF, SURF_NAME } from './world.js'
import { OFFROAD_V2, OFFROAD_V3, freshSave, SAVE_KEY, VEHICLES, UPGRADES, AUX, JERRY, ADVENTURES, TANK, coerceSave, buyUpgrade, buyVehicle, buyAux, buyJerry, useJerry, refuel, burnFuel, specWithUpgrades, tankCapacity, jerrySlots, rankFor, isDark, clockLabel, tickAdventure } from './economy.js'
import { CAMP, campLevel, buyCamp, canPitch, nearWater, rollFish, reelBand, biteSeconds, GAME, aimHit, RECIPES, canCook, cookJudge, applyCook } from './camp.js'
import { createSim } from './physics.js'

export { OFFROAD_V2, OFFROAD_V3 }

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
let lastSpeed = 0
let lastSurf = 0
let steerSm = 0
let orbit = 0.8
let orbitYaw = 0.4
let orbitPitch = 0.35
let orbitDist = 11
let dprScale = 1
let adaptAcc = 0
let saveAcc = 0
let wiped = false
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
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  toneMapped: false,
  uniforms: { sun: { value: new THREE.Vector3(0, 0.2, 0) }, elev: { value: 0.6 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    varying vec3 vP; uniform vec3 sun; uniform float elev;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 d = normalize(vP);
      float h = clamp(d.y, -0.05, 1.0);
      float day = smoothstep(-0.05, 0.35, elev);
      vec3 nightTop = vec3(0.02, 0.03, 0.07);
      vec3 dayTop = vec3(0.34, 0.52, 0.78);
      vec3 setTop = vec3(0.16, 0.24, 0.46);
      vec3 horDay = vec3(0.72, 0.82, 0.9);
      vec3 horSet = vec3(0.95, 0.48, 0.22);
      vec3 horNight = vec3(0.04, 0.05, 0.09);
      float low = smoothstep(0.05, 0.55, elev);
      vec3 hor = mix(horSet, horDay, low);
      hor = mix(horNight, hor, smoothstep(-0.35, 0.15, elev));
      vec3 top = mix(nightTop, setTop, smoothstep(-0.2, 0.25, elev));
      top = mix(top, dayTop, day);
      vec3 col = mix(hor, top, smoothstep(0.0, 0.55, h));
      float sd = pow(max(dot(d, normalize(sun)), 0.0), mix(40.0, 90.0, day));
      col += vec3(1.0, 0.62, 0.28) * sd * smoothstep(-0.15, 0.2, elev);
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

const PAL = ['#6e4b32', '#8d6844', '#3c342b', '#c6a36b', '#6a6763', '#243833'].map(h => new THREE.Color(h))
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
    const c = PAL[world.surface(x, z)] || PAL[0]
    const n = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1
    const shade = 0.86 + n * 0.22
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
  const n = world.gridN
  const es = WORLD_SIZE / (n - 1)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (world.surf[j * n + i] !== 5) continue
      const x = -HALF + (i / (n - 1)) * WORLD_SIZE
      const z = HALF - (j / (n - 1)) * WORLD_SIZE
      const y = world.heights[j * n + i] + 0.42
      water.push(x - es * 0.5, y, z - es * 0.5, x + es * 0.5, y, z - es * 0.5, x + es * 0.5, y, z + es * 0.5)
      water.push(x - es * 0.5, y, z - es * 0.5, x + es * 0.5, y, z + es * 0.5, x - es * 0.5, y, z + es * 0.5)
    }
  }
  const wg = new THREE.BufferGeometry()
  wg.setAttribute('position', new THREE.Float32BufferAttribute(water, 3))
  wg.computeVertexNormals()
  const wmesh = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({
    color: 0x2f6d84, transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.15, depthWrite: false
  }))
  scene.add(wmesh)
}
function scatter() {
  const dummy = new THREE.Object3D()
  const trees = world.trees.slice(0, gfx().trees)
  const trunkG = new THREE.CylinderGeometry(0.16, 0.28, 2.1, 5)
  trunkG.translate(0, 1.05, 0)
  const pineG = new THREE.ConeGeometry(1.25, 3.1, 6)
  pineG.translate(0, 2.7, 0)
  const roundG = new THREE.SphereGeometry(1.05, 6, 5)
  roundG.translate(0, 2.35, 0)
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.9 }), trees.length)
  const pines = []
  const rounds = []
  trees.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z)
    dummy.scale.setScalar(t.s)
    dummy.rotation.y = t.x * 0.17
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)
    ;(t.k ? rounds : pines).push(dummy.matrix.clone())
  })
  trunks.instanceMatrix.needsUpdate = true
  trunks.frustumCulled = false
  scene.add(trunks)
  function tops(list, geo, color) {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), list.length)
    list.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    scene.add(mesh)
  }
  tops(pines, pineG, 0x2f4a2c)
  tops(rounds, roundG, 0x5a6a32)
  const rockG = new THREE.DodecahedronGeometry(1, 0)
  const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: 0x6e675f, roughness: 0.95 }), world.rocks.length)
  world.rocks.forEach((r, i) => {
    dummy.position.set(r.x, world.height(r.x, r.z) + r.h * 0.2, r.z)
    dummy.scale.set(r.rad * 0.5, r.h * 0.65, r.rad * 0.48)
    dummy.rotation.set(r.h, r.x * 0.2, 0.4)
    dummy.updateMatrix()
    rocks.setMatrixAt(i, dummy.matrix)
  })
  rocks.instanceMatrix.needsUpdate = true
  rocks.frustumCulled = false
  scene.add(rocks)
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

let truck, wheels = []
function buildTruck(spec) {
  if (truck) scene.remove(truck)
  wheels.forEach(w => scene.remove(w))
  wheels = []
  truck = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.48, metalness: 0.34 })
  const dirt = new THREE.MeshStandardMaterial({ color: spec.mud || 0x4a3828, roughness: 0.94, metalness: 0.04 })
  const dark = new THREE.MeshStandardMaterial({ color: spec.dark, roughness: 0.58, metalness: 0.42 })
  const glass = new THREE.MeshStandardMaterial({ color: spec.glass, roughness: 0.06, metalness: 0.12, transparent: true, opacity: 0.5 })
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffe7b0, emissiveIntensity: 0.15, roughness: 0.28 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x6e1612, emissive: 0xff2a18, emissiveIntensity: 0.3 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xfff8ee, emissive: 0xfff1c8, emissiveIntensity: 0.08 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.92 })
  const steel = new THREE.MeshStandardMaterial({ color: 0xc5c0b6, roughness: 0.32, metalness: 0.72 })
  const L = spec.half[2], W = spec.half[0]
  const scout = spec.id === 'scout'
  const box = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    truck.add(m)
    return m
  }
  box(dirt, W * 1.72, 0.2, L * 1.92, 0, -0.04, 0)
  box(dirt, 0.14, 0.16, L * 1.45, -W * 0.92, 0.06, 0)
  box(dirt, 0.14, 0.16, L * 1.45, W * 0.92, 0.06, 0)
  box(paint, W * 1.5, 0.2, L * 0.7, 0, 0.28, L * 0.46)
  box(paint, W * 1.46, 0.58, scout ? L * 0.72 : L * 0.58, 0, 0.68, scout ? 0.02 : -0.12)
  const wind = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.22, 0.4), glass)
  wind.position.set(0, 0.74, L * 0.2)
  wind.rotation.x = -0.42
  truck.add(wind)
  const cabZ = scout ? 0.02 : -0.12
  const cabD = scout ? L * 0.72 : L * 0.58
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(cabD * 0.62, 0.28), glass)
    side.position.set(s * W * 0.74, 0.78, cabZ)
    side.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2
    truck.add(side)
    box(dark, 0.05, 0.1, 0.18, s * (W * 0.86), 0.82, L * 0.02)
  }
  if (!scout) {
    box(dark, W * 1.52, 0.2, L * 0.78, 0, 0.26, -L * 0.62)
    box(paint, 0.08, 0.32, L * 0.78, -W * 0.76, 0.46, -L * 0.62)
    box(paint, 0.08, 0.32, L * 0.78, W * 0.76, 0.46, -L * 0.62)
    box(paint, W * 1.52, 0.28, 0.08, 0, 0.46, -L * 0.98)
  } else box(dark, W * 1.35, 0.18, L * 0.42, 0, 0.26, -L * 0.72)
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) box(paint, W * 0.52, 0.14, 0.62, sx * W * 0.7, 0.22, sz * (scout ? L * 0.55 : L * 0.62))
  box(steel, W * 1.85, 0.14, 0.12, 0, 0.1, L * 0.96)
  box(dark, W * 1.65, 0.12, 0.1, 0, 0.12, -L * 1.0)
  box(dark, W * 0.62, 0.26, 0.05, 0, 0.32, L * 0.86)
  for (let i = -1; i <= 1; i++) box(steel, W * 0.55, 0.025, 0.03, 0, 0.32 + i * 0.07, L * 0.9)
  for (const s of [-1, 1]) {
    box(dark, 0.2, 0.16, 0.08, s * W * 0.46, 0.32, L * 0.9)
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.065, 12), lampMat)
    lens.position.set(s * W * 0.46, 0.32, L * 0.95)
    truck.add(lens)
    box(tailMat, 0.16, 0.09, 0.05, s * W * 0.58, 0.3, -L * 1.02)
  }
  box(dark, W * 1.15, 0.04, cabD * 0.75, 0, 1.02, cabZ)
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), roofMat)
    lamp.position.set(s * 0.28, 1.1, cabZ + 0.05)
    truck.add(lamp)
  }
  if (!scout) {
    const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), dark)
    sn.position.set(-W * 0.82, 0.7, L * 0.22)
    truck.add(sn)
  }
  const spare = new THREE.Mesh(new THREE.TorusGeometry(spec.wheelR * 0.62, 0.08, 6, 12), rubber)
  spare.rotation.y = Math.PI / 2
  spare.position.set(0, 0.55, -L * 1.02)
  truck.add(spare)
  const axleMat = steel
  box(axleMat, W * 1.7, 0.06, 0.06, 0, 0.02, L * 0.55)
  box(axleMat, W * 1.7, 0.06, 0.06, 0, 0.02, -L * 0.55)
  const lamps = []
  for (const s of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff4d4, 0, 40, 0.5, 0.42, 1)
    spot.position.set(s * W * 0.42, 0.4, L * 0.9)
    const tgt = new THREE.Object3D()
    tgt.position.set(s * W * 0.12, -0.55, L + 24)
    truck.add(spot, tgt)
    spot.target = tgt
    if (gfx().shadow) {
      spot.castShadow = true
      spot.shadow.mapSize.set(512, 512)
      spot.shadow.camera.near = 0.4
      spot.shadow.camera.far = 55
      spot.shadow.bias = -0.0012
    }
    lamps.push(spot)
  }
  truck.userData = { lampMat, tailMat, roofMat, lamps }
  scene.add(truck)
  const geo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.3, 16)
  geo.rotateZ(Math.PI / 2)
  const tread = new THREE.TorusGeometry(spec.wheelR * 0.9, 0.045, 4, 16)
  tread.rotateY(Math.PI / 2)
  const rimGeo = new THREE.CylinderGeometry(spec.wheelR * 0.42, spec.wheelR * 0.42, 0.32, 10)
  rimGeo.rotateZ(Math.PI / 2)
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(geo, rubber)
    wheel.add(new THREE.Mesh(tread, rubber))
    const rim = new THREE.Mesh(rimGeo, steel)
    wheel.add(rim)
    wheel.castShadow = true
    scene.add(wheel)
    wheels.push(wheel)
  }
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
  }
  ud.lampMat.emissiveIntensity = on ? (hi ? 3.2 : 2.1) : 0.12
  ud.roofMat.emissiveIntensity = on ? 1.8 : 0.05
  ud.tailMat.emissiveIntensity = dark ? 1.4 : 0.28
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
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const h = world.heights[j * n + i]
      const col = rgb[world.surf[j * n + i]] || rgb[0]
      const shade = 0.75 + Math.max(-0.15, Math.min(0.35, h / 48))
      const o = (j * n + i) * 4
      img.data[o] = col[0] * shade
      img.data[o + 1] = col[1] * shade
      img.data[o + 2] = col[2] * shade
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
}
const mapBake = document.createElement('canvas')
mapBake.width = mapBake.height = world.gridN
paintMap(mapBake)

function applyTime(t) {
  const ang = (t - 0.25) * Math.PI * 2
  const elev = Math.sin(ang)
  const day = Math.max(0, elev)
  const fogC = new THREE.Color('#070b14')
  if (elev > -0.2) fogC.lerp(new THREE.Color('#e39a6a'), Math.min(1, (elev + 0.2) / 0.45))
  if (elev > 0.35) fogC.lerp(new THREE.Color('#c5d6e4'), (elev - 0.35) / 0.65)
  scene.fog.color.copy(fogC)
  scene.fog.near = 18 + day * 12
  scene.fog.far = gfx().fog * (0.55 + day * 0.45)
  renderer.setClearColor(fogC)
  renderer.toneMappingExposure = 0.72 + day * 0.38
  sun.color.copy(new THREE.Color('#9db4ff').lerp(new THREE.Color('#ffb068'), Math.min(1, day * 1.4 + 0.2)))
  if (day > 0.45) sun.color.lerp(new THREE.Color('#fff4dc'), (day - 0.45) / 0.55)
  sun.intensity = day * 2.7
  hemi.color.set(day < 0.25 ? '#1a2740' : '#ffd0a8')
  hemi.groundColor.set(day < 0.2 ? '#100e0c' : '#3a2a22')
  hemi.intensity = 0.05 + day * 0.55
  fill.intensity = 0.05 + day * 0.62
  const dir = new THREE.Vector3(Math.cos(ang), Math.max(-0.05, elev), Math.sin(ang) * 0.55).normalize()
  skyMat.uniforms.sun.value.copy(dir)
  skyMat.uniforms.elev.value = elev
  moon.intensity = Math.max(0, -elev) * 0.42
  moon.color.set('#c5d4ff')
  stars.material.opacity = Math.max(0, Math.min(1, -elev * 1.3))
  return dir
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
  steerSm += (target - steerSm) * Math.min(1, dt * 7)
  return {
    throttle: Math.max(keys.w, pad.gas),
    brake: Math.max(keys.s, pad.brake),
    steer: steerSm,
    handbrake: !!(keys.space || pad.hand),
    lock: lockOn,
    winch: !!(keys.f || pad.winch),
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
  truck.position.set(c.position.x, c.position.y, c.position.z)
  truck.quaternion.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
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
    const back = 7.4
    desired.set(p.x - fwd.x * back, p.y + 2.9, p.z - fwd.z * back)
    if (save.settings.shake) desired.y += Math.sin(performance.now() * 0.02) * Math.min(0.08, Math.abs(lastSpeed) * 0.004)
    lookAt.set(p.x + fwd.x * 5, p.y + 1.15, p.z + fwd.z * 5)
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
  $('fliphint').classList.toggle('show', sim.upright() < 0.32)
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
function updateHud() {
  const mph = Math.abs(lastSpeed) * 2.237
  $('speed').textContent = String(Math.round(mph))
  $('gear').textContent = lastSpeed < -0.5 ? 'R' : 'D'
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
  $('btn-lock').classList.toggle('on', lockOn)
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
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = adv.name + ' · ' + adv.diff + ' · ' + adv.rep + ' rep' + (cleared ? '  ' + '★'.repeat(cleared.stars) : '')
    const stepNote = active ? ' Now: ' + adv.steps[save.active.step].text + '.' : ''
    row.querySelector('span').textContent = adv.text + stepNote
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = active ? 'Under way' : cleared ? 'Ride it again' : 'Take adventure'
    btn.disabled = !!active
    btn.onclick = () => {
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
    row.querySelector('span').textContent = owned ? 'In the shed.' : 'Lighter, quicker, worse in the mud. Needs ' + v.need + ' rep.'
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
function doReset() {
  if (save.active) save.active.resets = (save.active.resets || 0) + 1
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
$('btn-reset').onclick = () => doReset()
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
function puff(x, y, z) {
  if (!dust.length) return
  const d = dust[dustN++ % dust.length]
  d.life = 0.7
  d.m.visible = true
  d.m.position.set(x, y, z)
  d.m.scale.setScalar(0.4)
  d.vx = (Math.random() - 0.5) * 1.5
  d.vz = (Math.random() - 0.5) * 1.5
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
  persist()
  toast('Camp is set. The fire is yours.')
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
  if (kind === 'fish' && !nearWater(world, sim.chassis.position.x, sim.chassis.position.z)) { toast('The creek is too far.'); return }
  if (kind === 'fish' && !save.camp.rod) { toast('The garage has a rod, once you have the name for it.'); return }
  if (kind === 'hunt' && !save.camp.hunt) { toast('A camera or a bow waits on your reputation.'); return }
  play = { kind, phase: kind === 'cook' ? 'pick' : kind === 'hunt' ? 'stalk' : 'cast', t: 0, mark: 0, dir: 1, good: 0, animals: GAME.map((g, i) => ({ ...g, x: 0.15 + i * 0.28 })) }
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
    g.fillStyle = a.id === 'deer' ? '#c4b49a' : a.id === 'turkey' ? '#6a4030' : '#d9d3c4'
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
  if (mode === 'play' || mode === 'title') {
    acc += dt
    let steps = 0
    const input = mode === 'play' ? sampleInput(dt) : zeroInput()
    while (acc >= 1 / 60 && steps < 3) {
      const r = sim.step(1 / 60, input)
      if (r) { lastSpeed = r.speed; lastSurf = r.surf }
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
  pitch() { pitchCamp() },
  showPlay(kind) { openPlay(kind) },
  prep(camp, pantry) { if (camp) Object.assign(save.camp, camp); if (pantry) Object.assign(save.pantry, pantry) }
}
