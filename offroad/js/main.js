// Oxbow — Hollow Creek. OFFROAD_V1
import * as THREE from '../vendor/three.module.js'
import { OFFROAD_V1, createWorld, WORLD_SIZE, HALF, SURF_NAME } from './world.js'
import { freshSave, SAVE_KEY, VEHICLES, UPGRADES, JOBS, TANK, buyUpgrade, buyVehicle, refuelQuote, burnFuel, jobPay, specWithUpgrades } from './economy.js'
import { createSim } from './physics.js'

export { OFFROAD_V1 }

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
    const s = JSON.parse(raw)
    if (!s || s.v !== 1 || !s.upgrades) return null
    s.settings = Object.assign({ gfx: defaultGfx(), tilt: false, sound: true, shake: true, time: 0.36 }, s.settings)
    return s
  } catch (e) { return null }
}
let save = loadSave() || freshSave({ settings: { gfx: defaultGfx(), tilt: false, sound: true, shake: true, time: 0.36 } })
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
  uniforms: { sun: { value: new THREE.Vector3(0, 0.2, 0) }, elev: { value: 0.2 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    varying vec3 vP; uniform vec3 sun; uniform float elev;
    void main(){
      vec3 d = normalize(vP);
      float h = clamp(d.y, -0.05, 1.0);
      vec3 nightTop = vec3(0.05, 0.07, 0.12);
      vec3 dayTop = vec3(0.34, 0.52, 0.78);
      vec3 setTop = vec3(0.18, 0.28, 0.48);
      vec3 hor = mix(vec3(0.95, 0.45, 0.22), vec3(0.72, 0.82, 0.9), smoothstep(0.2, 0.85, elev));
      hor = mix(vec3(0.08, 0.1, 0.16), hor, smoothstep(-0.05, 0.25, elev));
      vec3 top = mix(nightTop, setTop, smoothstep(0.0, 0.35, elev));
      top = mix(top, dayTop, smoothstep(0.35, 0.9, elev));
      vec3 col = mix(hor, top, smoothstep(0.0, 0.55, h));
      float sd = pow(max(dot(d, normalize(sun)), 0.0), 90.0);
      col += vec3(1.0, 0.62, 0.28) * sd * smoothstep(-0.1, 0.2, elev);
      gl_FragColor = vec4(col, 1.0);
    }`
})
const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), skyMat)
scene.add(sky)
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
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 1.4, 46, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffc14a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
)
scene.add(beam)
beam.visible = false

let truck, wheels = [], cargo, spot
function buildTruck(spec) {
  if (truck) scene.remove(truck)
  wheels.forEach(w => scene.remove(w))
  wheels = []
  truck = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.52, metalness: 0.12 })
  const dark = new THREE.MeshStandardMaterial({ color: spec.dark, roughness: 0.72, metalness: 0.25 })
  const glass = new THREE.MeshStandardMaterial({ color: spec.glass, roughness: 0.12, metalness: 0.45 })
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe1a8, emissive: 0xffb45a, emissiveIntensity: 1.6 })
  const tail = new THREE.MeshStandardMaterial({ color: 0xff4a3a, emissive: 0xff2a22, emissiveIntensity: 1.2 })
  const L = spec.half[2], W = spec.half[0]
  const add = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    truck.add(m)
    return m
  }
  add(dark, W * 1.85, 0.42, L * 1.85, 0, 0.02, 0)
  add(paint, W * 1.7, 0.32, L * 0.55, 0, 0.38, L * 0.52)
  add(paint, W * 1.6, 0.72, L * 0.62, 0, 0.72, -L * 0.02)
  add(glass, W * 1.42, 0.38, L * 0.48, 0, 0.9, L * 0.02)
  add(dark, W * 1.72, 0.28, L * 0.7, 0, 0.42, -L * 0.62)
  add(dark, W * 1.95, 0.18, 0.16, 0, 0.04, L * 0.96)
  add(glow, 0.22, 0.14, 0.08, -W * 0.55, 0.28, L * 0.98)
  add(glow, 0.22, 0.14, 0.08, W * 0.55, 0.28, L * 0.98)
  add(tail, 0.18, 0.14, 0.08, -W * 0.62, 0.32, -L * 0.94)
  add(tail, 0.18, 0.14, 0.08, W * 0.62, 0.32, -L * 0.94)
  const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), dark)
  snorkel.position.set(-W * 0.95, 0.7, L * 0.35)
  truck.add(snorkel)
  cargo = add(new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 }), 0.7, 0.55, 0.7, 0, 0.78, -L * 0.6)
  cargo.visible = false
  spot = new THREE.SpotLight(0xfff1d0, gfx().shadow ? 12 : 0, 26, 0.55, 0.45, 1.2)
  spot.position.set(0, 0.7, L * 0.9)
  const tgt = new THREE.Object3D()
  tgt.position.set(0, 0.2, L * 0.9 + 12)
  truck.add(spot, tgt)
  spot.target = tgt
  scene.add(truck)
  const geo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.28, 14)
  geo.rotateZ(Math.PI / 2)
  const tire = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 })
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(geo, tire)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(spec.wheelR * 0.45, spec.wheelR * 0.45, 0.3, 8), dark)
    hub.rotation.z = Math.PI / 2
    wheel.add(hub)
    wheel.castShadow = true
    scene.add(wheel)
    wheels.push(wheel)
  }
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
  const elev = -0.05 + t * 0.95
  const fogC = new THREE.Color().setRGB(0.1, 0.12, 0.16).lerp(new THREE.Color('#e39a6a'), Math.min(1, t / 0.4))
  if (t > 0.4) fogC.lerp(new THREE.Color('#c5d6e4'), (t - 0.4) / 0.6)
  scene.fog.color.copy(fogC)
  scene.fog.far = gfx().fog
  renderer.setClearColor(fogC)
  const sunC = new THREE.Color('#9db4d4').lerp(new THREE.Color('#ffb068'), Math.min(1, t / 0.45))
  if (t > 0.45) sunC.lerp(new THREE.Color('#fff4dc'), (t - 0.45) / 0.55)
  sun.color.copy(sunC)
  sun.intensity = 0.35 + t * 2.3
  hemi.color.set(t < 0.3 ? '#203048' : '#ffd0a8')
  hemi.intensity = 0.25 + t * 0.45
  const dir = new THREE.Vector3(-0.9, Math.max(0.08, elev), 0.35).normalize()
  skyMat.uniforms.sun.value.copy(dir)
  skyMat.uniforms.elev.value = elev
  return dir
}
let sunDir = applyTime(save.settings.time)

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
    fuel: save.fuel
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
  if (cargo) {
    const job = JOBS.find(j => j.id === save.active)
    cargo.visible = !!(job && job.kind === 'deliver')
  }
}
function updateCamera(dt) {
  const c = sim.chassis
  if (!c) return
  q.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
  fwd.set(0, 0, 1).applyQuaternion(q)
  const p = c.position
  if (mode === 'title') {
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
  sunDir = applyTime(save.settings.time)
  sun.position.set(p.x + sunDir.x * 42, p.y + 10 + Math.max(0, sunDir.y) * 36, p.z + sunDir.z * 42)
  sun.target.position.set(p.x, p.y, p.z)
  sky.position.copy(camera.position)
}
function activePoi() {
  const job = JOBS.find(j => j.id === save.active)
  if (!job) return null
  return world.pois.find(p => p.id === job.poi)
}
function updateGame(dt) {
  const c = sim.chassis
  if (!c) return
  for (const p of world.pois) {
    if (save.discovered.includes(p.id)) continue
    if (Math.hypot(c.position.x - p.x, c.position.z - p.z) < 20) {
      save.discovered.push(p.id)
      save.money += 25
      toast('Discovered ' + p.name + '  +$25')
      persist()
    }
  }
  const poi = activePoi()
  if (poi && Math.hypot(c.position.x - poi.x, c.position.z - poi.z) < poi.r && Math.abs(lastSpeed) < 6) {
    const job = JOBS.find(j => j.id === save.active)
    const pay = jobPay(save, job)
    save.money += pay
    if (!save.done.includes(job.id)) save.done.push(job.id)
    save.active = null
    toast(job.name + ' complete  +$' + pay)
    persist()
  }
  if (mode === 'play') {
    saveAcc += dt
    if (saveAcc > 4) { saveAcc = 0; capturePose(); persist() }
  }
  const job = JOBS.find(j => j.id === save.active)
  if (job && poi) {
    const dist = Math.hypot(c.position.x - poi.x, c.position.z - poi.z)
    $('objective').textContent = job.name + ' · ' + Math.round(dist) + ' m'
    beam.visible = true
    beam.position.set(poi.x, poi.y + 24, poi.z)
  } else {
    $('objective').textContent = atYard() ? 'At the yard — J opens jobs' : 'Pick up a job — press J'
    beam.visible = false
  }
  $('fliphint').classList.toggle('show', sim.upright() < 0.32)
}
function drawMap(canvas, big) {
  const g = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  g.drawImage(mapBake, 0, 0, w, h)
  const px = (x, z) => [(x + HALF) / WORLD_SIZE * w, (HALF - z) / WORLD_SIZE * h]
  for (const p of world.pois) {
    const [x, y] = px(p.x, p.z)
    const known = save.discovered.includes(p.id)
    g.fillStyle = p.id === (activePoi() && activePoi().id) ? '#ffb000' : known ? '#f4efe6' : '#888'
    g.beginPath()
    g.arc(x, y, big ? 7 : 3.5, 0, Math.PI * 2)
    g.fill()
    if (big) {
      g.fillStyle = '#f4efe6'
      g.font = '16px sans-serif'
      g.fillText(known ? p.name : '?', x + 8, y + 4)
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
  const fuelPct = Math.max(0, save.fuel / TANK) * 100
  $('fuelbar').style.width = fuelPct + '%'
  $('fuelbar').classList.toggle('low', save.fuel < TANK * 0.2)
  $('fuellabel').textContent = save.fuel.toFixed(1) + ' gal'
  $('money').textContent = '$' + save.money
  $('surface').textContent = (SURF_NAME[Math.round(lastSurf)] || 'dirt').toUpperCase()
  $('btn-lock').classList.toggle('on', lockOn)
  drawMap($('minimap'), false)
  if ($('mapfull').classList.contains('show')) drawMap($('mapbig'), true)
  const poi = activePoi()
  const label = $('poi-label')
  if (!poi || mode !== 'play') { label.style.display = 'none'; return }
  const v = new THREE.Vector3(poi.x, poi.y + 4, poi.z)
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
  label.textContent = (clamped ? '▸ ' : '') + poi.name
}
function fillJobs() {
  const box = $('job-list')
  box.replaceChildren()
  for (const job of JOBS) {
    const row = document.createElement('div')
    row.className = 'job'
    const pay = jobPay(save, job)
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = job.name + (save.active === job.id ? ' · active' : '') + '  $' + pay
    row.querySelector('span').textContent = job.text
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = save.active === job.id ? 'On the board' : 'Take job'
    btn.disabled = save.active === job.id
    btn.onclick = () => { save.active = job.id; toast(job.name); persist(); fillJobs() }
    row.appendChild(btn)
    box.appendChild(row)
  }
}
function fillGarage() {
  const here = atYard()
  $('garage-note').textContent = here ? 'The yard pumps are open.' : 'You can look. Buying and fuel wait until you roll back to Oxbow Yard.'
  const box = $('garage-body')
  box.replaceChildren()
  const fuel = refuelQuote(save.fuel)
  const ref = document.createElement('button')
  ref.type = 'button'
  ref.textContent = fuel.missing < 0.05 ? 'Tank is full' : 'Fill the tank — $' + fuel.cost
  ref.disabled = !here || fuel.missing < 0.05 || save.money < fuel.cost
  ref.onclick = () => {
    save.money -= fuel.cost
    save.fuel = TANK
    toast('Tank full')
    persist(); fillGarage()
  }
  box.appendChild(ref)
  for (const id of Object.keys(UPGRADES)) {
    const u = UPGRADES[id]
    const level = save.upgrades[id] || 0
    const cost = level >= u.max ? null : u.cost[level + 1]
    const row = document.createElement('div')
    row.className = 'up'
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = u.name + '  ' + level + '/' + u.max
    row.querySelector('span').textContent = u.blurb
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = cost == null ? 'Maxed' : 'Buy — $' + cost
    btn.disabled = !here || cost == null || save.money < cost
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
    row.className = 'up'
    row.innerHTML = '<b></b><span></span>'
    row.querySelector('b').textContent = v.name + (save.vehicle === id ? ' · out' : '')
    row.querySelector('span').textContent = owned ? 'In the shed.' : 'A lighter truck. Quicker, worse in the mud. $' + v.price
    const btn = document.createElement('button')
    btn.type = 'button'
    if (!owned) btn.textContent = 'Buy — $' + v.price
    else btn.textContent = save.vehicle === id ? 'Driving it' : 'Take it out'
    btn.disabled = !here || (!owned && save.money < v.price) || (owned && save.vehicle === id)
    btn.onclick = () => {
      let next = save
      if (!owned) {
        next = buyVehicle(save, id)
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
  const tow = document.createElement('button')
  tow.type = 'button'
  tow.className = 'ghost'
  tow.textContent = 'Tow to the yard — $60'
  tow.disabled = save.money < 60
  tow.onclick = () => {
    save.money -= 60
    sim.place(yard.x, yard.z + 8, 0)
    toast('Back at the yard')
    persist(); fillGarage()
  }
  box.appendChild(tow)
}
function syncSettings() {
  $('gfx').value = save.settings.gfx
  $('time').value = String(Math.round(save.settings.time * 100))
  $('tilt').checked = !!save.settings.tilt
  $('sound').checked = save.settings.sound !== false
  $('shake').checked = save.settings.shake !== false
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
$('btn-reset').onclick = () => { sim.reset(); toast('Back on your wheels') }
$('btn-cam').onclick = () => {
  camMode = camMode === 'chase' ? 'hood' : camMode === 'hood' ? 'orbit' : 'chase'
  toast(camMode === 'chase' ? 'Chase' : camMode === 'hood' ? 'Hood' : 'Orbit')
}
$('btn-map').onclick = () => { if (mode === 'play') { showPanel('mapfull'); drawMap($('mapbig'), true) } }
$('btn-menu').onclick = () => { if (mode === 'play') showPanel('pause') }
$('btn-resume').onclick = closePanels
$('btn-quit').onclick = () => { capturePose(); persist(); enterTitle() }
$('btn-jobs').onclick = () => { fillJobs(); showPanel('jobs') }
$('btn-garage').onclick = () => { fillGarage(); showPanel('garage') }
$('btn-jobs-close').onclick = () => showPanel('pause')
$('btn-garage-close').onclick = () => showPanel('pause')
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
$('time').oninput = () => { save.settings.time = Number($('time').value) / 100; sunDir = applyTime(save.settings.time) }
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
  if (e.code === 'KeyR') sim.reset()
  if (e.code === 'KeyL') lockOn = !lockOn
  if (e.code === 'KeyM') $('btn-map').click()
  if (e.code === 'KeyJ' && mode === 'play') { fillJobs(); showPanel('jobs') }
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

let last = performance.now()
let acc = 0
const errors = []
window.addEventListener('error', e => errors.push(String(e.message || e.error || 'error')))
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (mode === 'play' || mode === 'title') {
    acc += dt
    let steps = 0
    const input = mode === 'play' ? sampleInput(dt) : zeroInput()
    while (acc >= 1 / 60 && steps < 3) {
      const r = sim.step(1 / 60, input)
      if (r) { lastSpeed = r.speed; lastSurf = r.surf }
      if (mode === 'play') sim.pushTrees(world.trees)
      acc -= 1 / 60
      steps++
    }
    if (mode === 'play') {
      const throttle = input.fuel > 0 ? input.throttle : 0
      save.fuel = burnFuel(save.fuel, Math.max(throttle, input.brake > 0 && lastSpeed < 0.4 ? input.brake : 0), dt)
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
  updateCamera(dt)
  if (mode === 'play') updateGame(dt)
  renderer.render(scene, camera)
  if (mode === 'play') updateHud()
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
  OFFROAD_V1,
  get mode() { return mode },
  get speed() { return lastSpeed },
  get pos() { const c = sim.chassis; return c ? { x: c.position.x, y: c.position.y, z: c.position.z } : null },
  get ready() { return !!sim.chassis },
  get errors() { return errors },
  get gfx() { return save.settings.gfx }
}
