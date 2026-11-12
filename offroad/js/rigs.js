// Licensed rigs. GlTF bodies, physics-driven wheels, live paint. OFFROAD_V9
import { GLTFLoader } from '../vendor/GLTFLoader.js'

const STYLES = ['pickup', 'jeep', 'bronco', 'wagon', 'utility', 'van', 'crawler']
const WHEEL_ORDER = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR']
const templates = new Map()
const extras = new Map()
let woodMap = null

export function setWoodMap(tex) { woodMap = tex }

export const PAINT_SWATCHES = [
  '#f4f1ea', '#e4d8c4', '#c4b49a', '#8a6a42', '#6a4a32', '#5c4632',
  '#d21f1a', '#e25a22', '#e4572e', '#d6a21f', '#e6c15a',
  '#2f6fbe', '#1d4e5a', '#2f4a34', '#3f6a3a', '#5d7c92',
  '#1c1c1c', '#d8d8d8'
]

export const FINISH = {
  gloss: { roughness: 0.22, metalness: 0.16 },
  satin: { roughness: 0.48, metalness: 0.05 },
  matte: { roughness: 0.84, metalness: 0 }
}

export async function preloadRigs() {
  const loader = new GLTFLoader()
  await Promise.all(STYLES.map(async style => {
    const gltf = await loader.loadAsync('models/' + style + '.glb')
    templates.set(style, gltf.scene)
  }))
  await Promise.all([['spare', 'spare'], ['kayak', 'kayak'], ['gascan', 'gascan']].map(async ([key, file]) => {
    const gltf = await loader.loadAsync('models/accessories/' + file + '.glb')
    extras.set(key, gltf.scene)
  }))
}

export function factoryPaint(spec) {
  const p = spec.paint || {}
  return {
    body: p.body || '#f4f1ea',
    accent: p.accent || '#6a4a32',
    wheel: p.wheel || '#2a2a2a',
    cage: p.cage || '#e4e4e4',
    finish: p.finish || 'satin',
    mud: p.mud || 0
  }
}

function cloneMat(mat) {
  const c = mat.clone()
  c.userData = Object.assign({}, mat.userData)
  return c
}

function lumaOf(mat) {
  const c = mat.color
  if (!c) return 0.5
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

function roleFor(mat, meshRole) {
  const n = (mat.name || '').toLowerCase()
  if (meshRole === 'wheel') return /ban|tire|rubber|wheelmat/.test(n) ? 'tire' : 'rim'
  if (meshRole === 'accent') return 'accent'
  if (meshRole === 'cage') return 'cage'
  if (/glass|lamp|light|license|brake|head|black|a05|d05/.test(n)) return 'keep'
  if (/ban|tire|rubber/.test(n)) return 'tire'
  if (meshRole === 'body' && lumaOf(mat) < 0.015 && !mat.map) return 'keep'
  return 'body'
}

function bindPaintShader(mat) {
  if (mat.userData.paintBound) return
  mat.userData.paintBound = true
  mat.onBeforeCompile = (shader) => {
    const want = mat.userData.paintWant || { col: mat.color.clone(), mix: 0 }
    shader.uniforms.uBody = { value: want.col.clone() }
    shader.uniforms.uMix = { value: want.mix || 0 }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBody;\nuniform float uMix;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          float luma = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float mask = smoothstep(0.02, 0.18, luma);
          vec3 painted = uBody * (0.82 + luma * 0.28);
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, painted, mask * uMix);
          diffuseColor *= sampledDiffuseColor;
        #endif
      `)
    mat.userData.shader = shader
  }
  mat.needsUpdate = true
}

function setRoleColor(mat, color, finish, mud, mix) {
  const fin = FINISH[finish] || FINISH.satin
  const mudC = mat.color.clone().set('#5c4632')
  const tint = color.clone().lerp(mudC, Math.min(0.7, mud || 0))
  mat.roughness = Math.min(1, fin.roughness + (mud || 0) * 0.35)
  mat.metalness = fin.metalness * (1 - Math.min(1, mud || 0))
  if (mat.map && mat.userData.paintMix != null) {
    bindPaintShader(mat)
    mat.color.set('#ffffff')
    const apply = () => {
      const sh = mat.userData.shader
      if (!sh) return
      sh.uniforms.uBody.value.copy(tint)
      sh.uniforms.uMix.value = mix
    }
    apply()
    mat.userData.afterPaint = apply
  } else {
    mat.color.copy(tint)
  }
}

export function applyPaint(root, paint) {
  if (!root || !paint) return
  const mixBody = paint.repaint ? 1 : 0
  root.traverse(o => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    for (const mat of list) {
      if (!mat) continue
      const role = mat.userData.paintRole || 'body'
      if (role === 'keep') continue
      if (role === 'tire') {
        mat.color.set('#1a1a1a')
        mat.roughness = Math.min(1, 0.9 + (paint.mud || 0) * 0.08)
        mat.metalness = 0
        continue
      }
      const col = role === 'accent' ? paint.accent
        : role === 'rim' ? paint.wheel
        : role === 'cage' ? paint.cage
        : paint.body
      const mix = role === 'body' ? mixBody : 0
      setRoleColor(mat, root.userData._c || (root.userData._c = new (mat.color.constructor)(col)), paint.finish, paint.mud, mix)
      // setRoleColor used a cached color that we must reset
    }
  })
  // The cache above is wrong if constructor path reused. Do a clean second pass.
  const C = paint._C || (paint._C = null)
  root.traverse(o => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    for (const mat of list) {
      if (!mat || !mat.color) continue
      const role = mat.userData.paintRole || 'body'
      if (role === 'keep' || role === 'tire') continue
      const hex = role === 'accent' ? paint.accent : role === 'rim' ? paint.wheel : role === 'cage' ? paint.cage : paint.body
      const col = new mat.color.constructor(hex)
      const mudC = new mat.color.constructor('#5c4632')
      col.lerp(mudC, Math.min(0.65, paint.mud || 0) * (role === 'body' ? 1 : 0.45))
      const fin = FINISH[paint.finish] || FINISH.satin
      mat.roughness = Math.min(1, fin.roughness + (paint.mud || 0) * 0.35)
      mat.metalness = fin.metalness * (1 - Math.min(1, (paint.mud || 0) * 0.8))
      if (role === 'body' && paint.repaint) mat.vertexColors = false
      if (mat.map && (role === 'body' || role === 'accent')) {
        const mix = paint.repaint && role === 'body' ? 1 : 0
        mat.userData.paintWant = { col: col.clone(), mix }
        if (!mat.userData.paintBound) bindPaintShader(mat)
        mat.color.set('#ffffff')
        const sh = mat.userData.shader
        if (sh) {
          sh.uniforms.uBody.value.copy(col)
          sh.uniforms.uMix.value = mix
        } else {
          mat.userData.pending = { col, mix }
        }
      } else if (!mat.map) {
        mat.color.copy(col)
      } else if (role === 'rim') {
        mat.color.copy(col)
      }
    }
  })
}

function tagMaterials(mesh, meshRole) {
  const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const next = src.map(m => {
    const c = cloneMat(m)
    c.userData.paintRole = roleFor(c, meshRole)
    c.userData.baseLuma = lumaOf(c)
    return c
  })
  mesh.material = Array.isArray(mesh.material) ? next : next[0]
}

let chevronMap = null
function vanChevronTexture(THREE) {
  if (chevronMap) return chevronMap
  const W = 1024
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const data = img.data
  const zRear = -1.92
  const zFront = 1.72
  const yLow = 0.42
  const yHigh = 1.34
  const orange = [240, 160, 74]
  const mid = [226, 90, 34]
  const red = [196, 50, 42]
  for (let py = 0; py < H; py++) {
    const v = 1 - (py + 0.5) / H
    const y = yLow + v * (yHigh - yLow)
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W
      const z = zRear + u * (zFront - zRear)
      const yc = 0.50 + (1.60 - z) * (0.86 / 2.75)
      const p = y - yc
      const o = (py * W + px) * 4
      if (p < -0.22 || p > 0.22) continue
      const col = p < -0.073 ? orange : p < 0.073 ? mid : red
      let a = 1
      if (p < -0.20) a = (p + 0.22) / 0.02
      else if (p > 0.20) a = (0.22 - p) / 0.02
      data[o] = col[0]
      data[o + 1] = col[1]
      data[o + 2] = col[2]
      data[o + 3] = Math.max(0, Math.min(255, Math.round(a * 255)))
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  chevronMap = tex
  return tex
}

function vanChevron(THREE, body) {
  body.updateWorldMatrix(true, true)
  const invBody = new THREE.Matrix4().copy(body.matrixWorld).invert()
  const toBody = new THREE.Matrix4()
  const A = new THREE.Vector3()
  const B = new THREE.Vector3()
  const C = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  const mid = new THREE.Vector3()
  const positions = []
  const normals = []
  const uvs = []
  const zRear = -1.92
  const zFront = 1.72
  const yLow = 0.42
  const yHigh = 1.34
  const meshes = []
  body.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) meshes.push(o)
  })
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, true)
    toBody.copy(invBody).multiply(mesh.matrixWorld)
    const pos = mesh.geometry.attributes.position
    const index = mesh.geometry.index
    const triCount = index ? index.count / 3 : Math.floor(pos.count / 3)
    const read = (i, out) => {
      out.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(toBody)
    }
    for (let t = 0; t < triCount; t++) {
      read(t * 3, A)
      read(t * 3 + 1, B)
      read(t * 3 + 2, C)
      ab.subVectors(B, A)
      ac.subVectors(C, A)
      nrm.crossVectors(ab, ac)
      if (nrm.lengthSq() < 1e-8) continue
      nrm.normalize()
      mid.copy(A).add(B).add(C).multiplyScalar(1 / 3)
      if (Math.abs(nrm.x) < 0.9 || Math.abs(nrm.y) > 0.22) continue
      if (mid.y < 0.48 || mid.y > 1.32) continue
      if (Math.abs(mid.x) < 0.78 || Math.abs(mid.x) > 1.02) continue
      if (mid.z < -1.95 || mid.z > 1.75) continue
      let v1 = B
      let v2 = C
      if (nrm.x * mid.x < 0) {
        nrm.negate()
        v1 = C
        v2 = B
      }
      const push = 0.01
      for (const v of [A, v1, v2]) {
        positions.push(v.x + nrm.x * push, v.y + nrm.y * push, v.z + nrm.z * push)
        normals.push(nrm.x, nrm.y, nrm.z)
        uvs.push((v.z - zRear) / (zFront - zRear), (v.y - yLow) / (yHigh - yLow))
      }
    }
  }
  if (positions.length < 9) return
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  const mat = new THREE.MeshStandardMaterial({
    map: vanChevronTexture(THREE),
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0.02,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8
  })
  mat.userData.paintRole = 'keep'
  const mesh = new THREE.Mesh(g, mat)
  mesh.name = 'van-chevron'
  mesh.userData.paintRole = 'keep'
  mesh.renderOrder = 2
  body.add(mesh)
}

function accessory(key, scale, role) {
  const src = extras.get(key)
  if (!src) return null
  const g = src.clone(true)
  g.traverse(o => {
    if (o.isMesh) {
      tagMaterials(o, role || 'accent')
      o.castShadow = true
    }
  })
  if (scale) g.scale.setScalar(scale)
  return g
}

function keepMat(THREE, color, rough, metal) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
  mat.userData.paintRole = 'keep'
  return mat
}

function tubeBetween(THREE, mat, ax, ay, az, bx, by, bz, r) {
  const a = new THREE.Vector3(ax, ay, az)
  const b = new THREE.Vector3(bx, by, bz)
  const dir = b.clone().sub(a)
  const len = Math.max(0.04, dir.length())
  dir.multiplyScalar(1 / len)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  mesh.castShadow = true
  mesh.userData.paintRole = 'keep'
  mesh.userData.hardware = true
  return mesh
}

function addKnobs(THREE, wheel, level) {
  const box = new THREE.Box3()
  wheel.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.visible) return
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
    box.union(o.geometry.boundingBox)
  })
  if (box.isEmpty()) return
  const r = Math.max(Math.abs(box.max.y), Math.abs(box.max.z), Math.abs(box.min.y), Math.abs(box.min.z))
  const halfW = Math.max(0.04, Math.abs(box.max.x), Math.abs(box.min.x))
  const mat = keepMat(THREE, '#161616', 0.94, 0)
  mat.userData.paintRole = 'tire'
  const nubs = 10 + level * 2
  const depth = 0.028 + level * 0.008
  const stick = 0.004 + level * 0.004
  const band = halfW * 2 * (0.62 + level * 0.08)
  for (let i = 0; i < nubs; i++) {
    const a = (i / nubs) * Math.PI * 2
    const nub = new THREE.Mesh(new THREE.BoxGeometry(band, depth, 0.06 + level * 0.01), mat)
    const rad = r - depth * 0.4 + stick
    nub.position.set(0, Math.cos(a) * rad, Math.sin(a) * rad)
    nub.rotation.x = a
    nub.castShadow = true
    wheel.add(nub)
  }
}

function jerryCan(THREE, olive) {
  const paint = keepMat(THREE, olive ? '#5c6b32' : '#c4322a', 0.52, 0.06)
  const dark = keepMat(THREE, '#1c1c1c', 0.6, 0.25)
  const g = new THREE.Group()
  g.userData.hardware = true
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.12), paint)
  body.position.y = 0.16
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.018, 0.125), dark)
  band.position.y = 0.1
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.045, 6), dark)
  cap.position.set(0.045, 0.345, 0)
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), dark)
  postL.position.set(-0.05, 0.36, 0)
  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), dark)
  postR.position.set(0.05, 0.36, 0)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.02), dark)
  grip.position.set(0, 0.4, 0)
  g.add(body, band, cap, postL, postR, grip)
  g.traverse(o => { if (o.isMesh) o.castShadow = true })
  g.userData.canH = 0.42
  g.userData.canD = 0.12
  g.userData.canW = 0.2
  return g
}

function collectPoints(THREE, body) {
  const pts = []
  body.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert()
  const m = new THREE.Matrix4()
  const v = new THREE.Vector3()
  body.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return
    if (o.userData && o.userData.hardware) return
    o.updateWorldMatrix(true, true)
    m.copy(inv).multiply(o.matrixWorld)
    const pos = o.geometry.attributes.position
    const stride = Math.max(1, Math.floor(pos.count / 1100))
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m)
      pts.push([v.x, v.y, v.z])
    }
  })
  return pts
}

function surveyBody(pts) {
  let minX = 9, maxX = -9, minY = 9, maxY = -9, minZ = 9, maxZ = -9
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[1] > maxY) maxY = p[1]
    if (p[2] < minZ) minZ = p[2]
    if (p[2] > maxZ) maxZ = p[2]
  }
  let roofY = minY
  for (const p of pts) if (Math.abs(p[0]) < (maxX - minX) * 0.28 && p[1] > roofY) roofY = p[1]
  const front = pts.filter(p => p[2] > maxZ - 0.25 && p[1] < roofY * 0.58 && p[1] > minY + 0.15)
  const bumperZ = front.length ? Math.max(...front.map(p => p[2])) : maxZ
  const ys = front.map(p => p[1]).sort((a, b) => a - b)
  const bumperY = ys.length ? ys[ys.length >> 1] : minY + 0.4
  const rear = pts.filter(p => p[2] < minZ + 0.25 && p[1] < roofY * 0.62 && p[1] > minY + 0.12)
  const tailZ = rear.length ? Math.min(...rear.map(p => p[2])) : minZ
  const rys = rear.map(p => p[1]).sort((a, b) => a - b)
  const tailY = rys.length ? rys[rys.length >> 1] : bumperY
  let pillar = null
  for (const p of pts) {
    if (p[0] > -0.15) continue
    if (p[2] < bumperZ - 1.7 || p[2] > bumperZ - 0.12) continue
    if (!pillar || p[1] > pillar[1]) pillar = p
  }
  if (!pillar) pillar = [minX, roofY * 0.85, bumperZ - 0.6]
  const outerAt = (z, y, rz, ry) => {
    let best = null
    for (const p of pts) {
      if (Math.abs(p[2] - z) > rz || Math.abs(p[1] - y) > ry) continue
      if (!best || p[0] < best[0]) best = p
    }
    return best
  }
  let cabBack = (minZ + maxZ) * 0.5
  let seenRoof = false
  for (let z = maxZ; z > minZ; z -= 0.12) {
    let slice = -9
    let n = 0
    for (const p of pts) {
      if (p[2] > z || p[2] < z - 0.12 || Math.abs(p[0]) > 0.5) continue
      if (p[1] > slice) slice = p[1]
      n++
    }
    if (n > 6 && slice > roofY - 0.28) seenRoof = true
    else if (seenRoof && n > 6 && slice < roofY - 0.4) { cabBack = z; break }
  }
  const bed = []
  for (const p of pts) {
    if (p[2] > cabBack - 0.2 || p[2] < tailZ + 0.35) continue
    if (Math.abs(p[0]) > (maxX - minX) * 0.22) continue
    if (p[1] < minY + 0.22 || p[1] > roofY * 0.82) continue
    bed.push(p[1])
  }
  const hist = new Map()
  for (const y of bed) {
    const b = Math.round(y * 10) / 10
    hist.set(b, (hist.get(b) || 0) + 1)
  }
  let bestN = 0
  hist.forEach(n => { if (n > bestN) bestN = n })
  let floorY = bumperY
  const keys = [...hist.keys()].sort((a, b) => a - b)
  for (const k of keys) if (hist.get(k) >= bestN * 0.35) { floorY = k; break }
  return { minX, maxX, minY, maxY, minZ, maxZ, roofY, bumperZ, bumperY, tailZ, tailY, pillar, outerAt, cabBack, floorY }
}

function addBox(THREE, parent, mat, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.userData.hardware = true
  parent.add(mesh)
  return mesh
}

function jerryRack(THREE, parent, spots, floorY) {
  const steel = keepMat(THREE, '#3a3a3a', 0.45, 0.5)
  const strap = keepMat(THREE, '#1a1a1a', 0.7, 0.1)
  spots.forEach((spot, i) => {
    const can = jerryCan(THREE, i === 2)
    can.position.set(spot[0], floorY, spot[2])
    parent.add(can)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.13), strap)
    band.position.set(spot[0], floorY + 0.2, spot[2])
    band.userData.hardware = true
    parent.add(band)
  })
  if (!spots.length) return
  const xs = spots.map(s => s[0])
  const zs = spots.map(s => s[2])
  const minX = Math.min(...xs) - 0.12
  const maxX = Math.max(...xs) + 0.12
  const z = spots[0][2]
  addBox(THREE, parent, steel, maxX - minX, 0.02, 0.16, (minX + maxX) / 2, floorY + 0.01, z)
}

function fitGear(THREE, body, spec, paint, rack, kit) {
  kit = kit || {}
  rack = rack || {}
  if (spec.style === 'crawler') return buildCrawler(THREE, body, spec, kit)
  const pts = collectPoints(THREE, body)
  if (pts.length < 20) return { coils: null, winchLocal: null }
  const info = surveyBody(pts)
  const black = keepMat(THREE, '#1a1a1a', 0.5, 0.3)
  const steel = keepMat(THREE, '#c5c8cc', 0.32, 0.7)
  const tankMat = keepMat(THREE, '#3f6a3a', 0.6, 0.08)
  const root = body
  if (kit.snorkel) {
    const r = 0.034
    const fender = info.outerAt(info.bumperZ - 0.4, info.bumperY + 0.12, 0.22, 0.28) || [info.minX, info.bumperY, info.bumperZ - 0.4]
    const mid = info.outerAt((fender[2] + info.pillar[2]) * 0.5, (fender[1] + info.pillar[1]) * 0.5, 0.28, 0.35) || fender
    const top = info.pillar
    const stations = [fender, mid, top].map(p => [p[0] - r, p[1], p[2]])
    stations[2] = [top[0] - r, Math.max(top[1], info.roofY * 0.92), top[2]]
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i]
      const b = stations[i + 1]
      root.add(tubeBetween(THREE, black, a[0], a[1], a[2], b[0], b[1], b[2], r))
    }
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 8), steel)
    flange.rotation.z = Math.PI / 2
    flange.position.set(fender[0] - 0.01, fender[1], fender[2])
    flange.userData.hardware = true
    root.add(flange)
    stations.forEach((p, i) => {
      if (i === 0) return
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(r + 0.03, 0.02, 0.045), steel)
      bracket.position.set(p[0] + (r + 0.015) * 0.5, p[1], p[2])
      bracket.userData.hardware = true
      root.add(bracket)
    })
    const headY = stations[2][1] + 0.03
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.16, 8), black)
    head.rotation.x = Math.PI / 2
    head.position.set(stations[2][0], headY, stations[2][2] + 0.08)
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.025, 8), steel)
    lip.rotation.x = Math.PI / 2
    lip.position.set(stations[2][0], headY, stations[2][2] + 0.16)
    root.add(head, lip)
  }
  let winchLocal = null
  if ((kit.winch || 0) >= 1) {
    const width = (info.maxX - info.minX) * 0.98
    const thick = kit.winch >= 2 ? 0.2 : 0.15
    const depth = kit.winch >= 2 ? 0.16 : 0.12
    const y = info.bumperY
    const zFace = info.bumperZ
    if (kit.winchShow !== false) {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(width, thick, depth), black)
      bumper.position.set(0, y, zFace + depth * 0.5)
      bumper.userData.hardware = true
      bumper.castShadow = true
      root.add(bumper)
      for (const x of [-width * 0.28, width * 0.28]) {
        const mount = new THREE.Mesh(new THREE.BoxGeometry(0.08, thick * 0.7, 0.22), steel)
        mount.position.set(x, y, zFace - 0.06)
        mount.userData.hardware = true
        root.add(mount)
      }
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 10), steel)
      drum.rotation.z = Math.PI / 2
      drum.position.set(0, y + thick * 0.5 + 0.04, zFace + depth * 0.35)
      drum.castShadow = true
      const fair = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.03), steel)
      fair.position.set(0, y, zFace + depth + 0.01)
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 8), steel)
      hook.position.set(0, y - 0.08, zFace + depth + 0.02)
      hook.rotation.y = Math.PI / 2
      root.add(drum, fair, hook)
    }
    winchLocal = new THREE.Vector3(0, y, zFace + depth + 0.04).add(body.position)
  }
  const bed = spec.style === 'pickup' || spec.style === 'utility'
  const cans = Math.max(0, kit.jerry || 0)
  const deco = !cans && rack.jerry && (spec.style === 'pickup' || spec.style === 'bronco')
  const canCount = cans || (deco ? 2 : 0)
  if (canCount) {
    if (bed) {
      const spots = []
      const z = info.cabBack - 0.1
      for (let i = 0; i < canCount; i++) spots.push([-0.42 + i * 0.24, 0, z])
      jerryRack(THREE, root, spots, info.floorY)
    } else {
      const steel = keepMat(THREE, '#3a3a3a', 0.45, 0.5)
      const z = info.tailZ - 0.07
      addBox(THREE, root, steel, 0.08, 0.5, 0.03, -0.28, info.tailY + 0.28, z)
      addBox(THREE, root, steel, 0.08, 0.5, 0.03, 0.28, info.tailY + 0.28, z)
      addBox(THREE, root, steel, 0.64, 0.03, 0.03, 0, info.tailY + 0.08, z)
      for (let i = 0; i < canCount; i++) {
        const can = jerryCan(THREE, i === 2)
        can.position.set(-0.22 + i * 0.22, info.tailY + 0.1, z - 0.02)
        root.add(can)
      }
    }
  }
  if ((kit.aux || 0) >= 1) {
    const scale = [0, 0.78, 1, 1.28][Math.min(3, kit.aux)]
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.11 * scale, 0.42 * scale, 8), tankMat)
    tank.rotation.z = Math.PI / 2
    tank.castShadow = true
    const strap = keepMat(THREE, '#1a1a1a', 0.7, 0.1)
    if (bed) {
      const y = info.floorY + 0.11 * scale
      tank.position.set(0.42, y, info.cabBack - 0.28)
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.44 * scale, 0.015, 0.16 * scale), strap)
      band.position.set(0.42, y + 0.06, info.cabBack - 0.28)
      root.add(tank, band)
    } else {
      const y = info.tailY
      const z = info.tailZ - 0.28
      addBox(THREE, root, black, 0.5, 0.03, 0.36, 0, y, z)
      addBox(THREE, root, steel, 0.06, 0.06, 0.22, -0.16, y + 0.02, info.tailZ - 0.08)
      addBox(THREE, root, steel, 0.06, 0.06, 0.22, 0.16, y + 0.02, info.tailZ - 0.08)
      tank.position.set(0, y + 0.03 + 0.11 * scale, z)
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scale, 0.015, 0.16), strap)
      band.position.copy(tank.position)
      root.add(tank, band)
    }
  }
  if (rack.kayak && (spec.style === 'jeep' || spec.style === 'bronco' || spec.style === 'wagon' || spec.style === 'van' || spec.style === 'pickup')) {
    const rail = keepMat(THREE, '#d7d2c6', 0.45, 0.35)
    const y = info.roofY
    const z0 = info.cabBack + 0.15
    const z1 = Math.min(info.bumperZ - 0.4, z0 + 1.3)
    for (const x of [-0.42, 0.42]) {
      root.add(tubeBetween(THREE, rail, x, y + 0.05, z0, x, y + 0.05, z1, 0.02))
      for (const z of [z0 + 0.05, (z0 + z1) / 2, z1 - 0.05]) {
        addBox(THREE, root, rail, 0.04, 0.05, 0.04, x, y + 0.025, z)
      }
    }
    for (const z of [z0 + 0.25, z1 - 0.25]) {
      root.add(tubeBetween(THREE, rail, -0.42, y + 0.05, z, 0.42, y + 0.05, z, 0.018))
      const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.08), black)
      cradle.position.set(0, y + 0.09, z)
      cradle.rotation.z = 0.4
      root.add(cradle)
    }
    const kayak = accessory('kayak', spec.style === 'jeep' ? 0.5 : 0.46)
    if (kayak) {
      kayak.position.set(0, y + 0.16, (z0 + z1) / 2)
      kayak.rotation.y = 0.1
      root.add(kayak)
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.03), black)
      strap.position.set(0, y + 0.2, (z0 + z1) / 2)
      root.add(strap)
    }
  }
  if (rack.spare) mountSpare(THREE, root, info, spec)
  if (rack.bike) mountBike(THREE, root, info)
  let coils = null
  if (kit.shocks) {
    const level = kit.susp || 0
    const thick = 1 + level * 0.18
    const shockMat = keepMat(THREE, '#d5d8dc', 0.32, 0.55)
    const springMat = keepMat(THREE, '#1a1a1a', 0.7, 0.1)
    const drop = body.position
    coils = []
    spec.axles.forEach((a, i) => {
      const near = []
      for (const p of pts) {
        if (Math.abs(p[0] - a[0] * 0.72) < 0.4 && Math.abs(p[2] - a[2]) < 0.45) near.push(p)
      }
      near.sort((u, v) => u[1] - v[1])
      const pick = near[Math.min(near.length - 1, Math.floor(near.length * 0.18))] || [a[0] * 0.55, a[1] + 0.3, a[2]]
      const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * thick, 0.032 * thick, 1, 8), shockMat)
      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * thick, 0.055 * thick, 1, 7), springMat)
      shock.castShadow = true
      body.parent.add(shock, spring)
      coils.push({
        shock, spring, index: i,
        mount: new THREE.Vector3(pick[0] + drop.x, pick[1] + drop.y - 0.02, pick[2] + drop.z)
      })
    })
  }
  return { coils, winchLocal }
}

function mountSpare(THREE, root, info, spec) {
  const tire = accessory('spare', 1, 'wheel')
  if (!tire) return
  const box = new THREE.Box3().setFromObject(tire)
  const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) || 1
  const target = spec.style === 'van' ? 0.72 : 0.62
  tire.scale.setScalar(target / size)
  tire.rotation.z = Math.PI / 2
  const bed = spec.style === 'pickup' || spec.style === 'utility'
  if (bed) {
    tire.position.set(-0.55, info.floorY + target * 0.5, info.cabBack - target * 0.55)
  } else if (spec.style === 'van') {
    tire.position.set(0, info.roofY + 0.06 + target * 0.5, (info.cabBack + info.bumperZ) * 0.15)
    const rail = keepMat(THREE, '#f4f1ea', 0.4, 0.2)
    addBox(THREE, root, rail, 0.06, 0.06, 0.06, -0.4, info.roofY + 0.03, tire.position.z)
    addBox(THREE, root, rail, 0.06, 0.06, 0.06, 0.4, info.roofY + 0.03, tire.position.z)
  } else {
    tire.position.set(0.15, info.tailY + target * 0.55, info.tailZ - target * 0.15)
    const plate = keepMat(THREE, '#2a2a2a', 0.5, 0.4)
    addBox(THREE, root, plate, 0.28, 0.5, 0.04, 0.15, info.tailY + 0.35, info.tailZ - 0.02)
  }
  root.add(tire)
}

function mountBike(THREE, root, info) {
  const dark = keepMat(THREE, '#1c1c1c', 0.55, 0.2)
  const steel = keepMat(THREE, '#c8ccd0', 0.35, 0.6)
  const z = info.tailZ - 0.35
  const y = info.tailY
  addBox(THREE, root, steel, 0.08, 0.08, 0.4, 0, y + 0.04, info.tailZ - 0.16)
  addBox(THREE, root, steel, 0.5, 0.04, 0.08, 0, y + 0.1, z)
  for (const x of [-0.22, 0.22]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 10), dark)
    wheel.position.set(x, y + 0.2, z)
    wheel.userData.hardware = true
    root.add(wheel)
  }
  addBox(THREE, root, dark, 0.36, 0.03, 0.03, 0, y + 0.34, z)
  addBox(THREE, root, dark, 0.03, 0.22, 0.03, 0, y + 0.24, z)
}

function buildCrawler(THREE, body, spec, kit) {
  const root = body.parent
  const R = spec.wheelR
  const drop = spec.visualDrop || 0
  const hub = spec.axles[0][1] + drop + spec.rest * 0.4
  const zF = spec.axles[0][2]
  const zR = spec.axles[2][2]
  const xW = Math.abs(spec.axles[0][0])
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#d21f1a', roughness: 0.48, metalness: 0.08 })
  bodyMat.userData.paintRole = 'body'
  const cageMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.42, metalness: 0.5 })
  cageMat.userData.paintRole = 'cage'
  const steel = keepMat(THREE, '#2c2c2c', 0.45, 0.55)
  const glass = keepMat(THREE, '#14181c', 0.18, 0.35)
  const white = keepMat(THREE, '#f3f4f6', 0.32, 0.2)
  const half = 0.5
  const railY = hub + 0.02
  const deckY = hub + 0.36
  const roofY = hub + 1.2
  const cabF = zF - 0.02
  const cabB = zF - 1.02
  const nose = zF + 0.5
  const tail = zR - 0.42
  const add = (mesh) => { mesh.castShadow = true; mesh.userData.hardware = true; root.add(mesh); return mesh }
  add(new THREE.Mesh(new THREE.BoxGeometry(half * 2, roofY - railY, cabF - cabB), bodyMat)).position.set(0, (roofY + railY) / 2, (cabF + cabB) / 2)
  const hood = add(new THREE.Mesh(new THREE.BoxGeometry(half * 1.7, 0.42, nose - cabF + 0.05), bodyMat))
  hood.position.set(0, railY + 0.21, (nose + cabF) / 2)
  const glassBox = add(new THREE.Mesh(new THREE.BoxGeometry(half * 1.7, 0.42, 0.04), glass))
  glassBox.position.set(0, roofY - 0.32, cabF + 0.01)
  for (const s of [-1, 1]) {
    const win = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.42), glass))
    win.position.set(s * (half + 0.01), roofY - 0.38, (cabF + cabB) / 2 + 0.05)
  }
  for (const x of [-0.36, 0.36]) {
    root.add(tubeBetween(THREE, cageMat, x, railY, nose, x, railY, tail, 0.045))
  }
  root.add(tubeBetween(THREE, cageMat, -0.36, railY, zF, 0.36, railY, zF, 0.04))
  root.add(tubeBetween(THREE, cageMat, -0.36, railY, zR, 0.36, railY, zR, 0.04))
  const deck = add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, cabB - tail), steel))
  deck.position.set(0, deckY, (cabB + tail) / 2)
  for (const x of [-0.4, 0.4]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, deckY - railY, 0.06), steel)).position.set(x, (deckY + railY) / 2, cabB - 0.15)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, deckY - railY, 0.06), steel)).position.set(x, (deckY + railY) / 2, tail + 0.15)
  }
  const batt = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.32), cageMat))
  batt.position.set(0.05, deckY + 0.16, tail + 0.45)
  for (const s of [-1, 1]) {
    const x = s * (half + 0.04)
    root.add(tubeBetween(THREE, cageMat, x, railY + 0.35, cabF + 0.02, x, roofY + 0.04, cabF - 0.12, 0.04))
    root.add(tubeBetween(THREE, cageMat, x, roofY + 0.04, cabF - 0.12, x, roofY + 0.04, cabB - 0.15, 0.038))
    root.add(tubeBetween(THREE, cageMat, x, roofY + 0.04, cabB - 0.05, x, deckY + 0.08, cabB - 0.35, 0.038))
    root.add(tubeBetween(THREE, cageMat, x, railY + 0.45, cabF - 0.2, x, roofY + 0.02, cabB - 0.05, 0.028))
    root.add(tubeBetween(THREE, cageMat, x * 0.7, roofY + 0.02, cabB + 0.05, x * 0.7, deckY + 0.2, cabB - 0.15, 0.03))
  }
  root.add(tubeBetween(THREE, cageMat, -(half + 0.04), roofY + 0.04, cabF - 0.12, half + 0.04, roofY + 0.04, cabF - 0.12, 0.036))
  root.add(tubeBetween(THREE, cageMat, -(half + 0.04), roofY + 0.04, cabB - 0.05, half + 0.04, roofY + 0.04, cabB - 0.05, 0.036))
  root.add(tubeBetween(THREE, cageMat, -(half + 0.04), roofY + 0.04, (cabF + cabB) / 2, half + 0.04, roofY + 0.04, (cabF + cabB) / 2, 0.03))
  const bumperZ = nose + 0.08
  root.add(tubeBetween(THREE, cageMat, -0.72, railY + 0.1, bumperZ, 0.72, railY + 0.1, bumperZ, 0.05))
  root.add(tubeBetween(THREE, cageMat, -0.36, railY, nose - 0.05, -0.62, railY + 0.1, bumperZ, 0.04))
  root.add(tubeBetween(THREE, cageMat, 0.36, railY, nose - 0.05, 0.62, railY + 0.1, bumperZ, 0.04))
  const spare = beadlock(THREE, 0.28, 0)
  spare.rotation.x = Math.PI / 2
  spare.position.set(-0.42, deckY + 0.3, tail + 0.2)
  root.add(spare)
  const links = []
  const linkMat = keepMat(THREE, '#d8dbe0', 0.35, 0.65)
  const coils = []
  const shockMat = keepMat(THREE, '#f4f6f8', 0.3, 0.25)
  const springMat = keepMat(THREE, '#222', 0.65, 0.15)
  spec.axles.forEach((a, i) => {
    const mount = new THREE.Vector3(a[0] * 0.62, roofY - 0.15, a[2])
    const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), shockMat)
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1, 8), springMat)
    shock.castShadow = true
    root.add(shock, spring)
    coils.push({ shock, spring, index: i, mount, inboard: 0.72 })
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 6), linkMat)
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), linkMat)
    root.add(arm, upper)
    links.push({
      mesh: arm,
      mount: new THREE.Vector3(a[0] * 0.22, railY + 0.04, a[2] - Math.sign(a[2] || 1) * 0.45),
      index: i,
      inboard: 0.55
    })
    links.push({
      mesh: upper,
      mount: new THREE.Vector3(a[0] * 0.18, railY + 0.32, a[2] - Math.sign(a[2] || 1) * 0.2),
      index: i,
      inboard: 0.42
    })
  })
  const axles = []
  for (const pair of [[0, 1, false], [2, 3, true]]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 8), steel)
    const diff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), pair[2] ? white : steel)
    root.add(bar, diff)
    axles.push({ bar, diff, i0: pair[0], i1: pair[1] })
  }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), steel)
  root.add(shaft)
  if (kit.snorkel) {
    const x = -(half + 0.06)
    root.add(tubeBetween(THREE, keepMat(THREE, '#1a1a1a', 0.5, 0.3), x, railY + 0.45, cabF + 0.12, x, roofY + 0.02, cabF - 0.08, 0.036))
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.16, 8), keepMat(THREE, '#1a1a1a', 0.5, 0.3))
    head.rotation.x = Math.PI / 2
    head.position.set(x, roofY + 0.06, cabF + 0.02)
    root.add(head)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), steel)).position.set(x + 0.03, railY + 0.7, cabF)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), steel)).position.set(x + 0.03, roofY - 0.25, cabF - 0.02)
  }
  let winchLocal = null
  if ((kit.winch || 0) >= 1) {
    const y = railY + 0.12
    const show = kit.winchShow !== false
    if (show) {
      const plate = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, kit.winch >= 2 ? 0.2 : 0.14, 0.12), cageMat))
      plate.position.set(0, y, bumperZ + 0.04)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), steel)
      drum.rotation.z = Math.PI / 2
      drum.position.set(0, y + 0.12, bumperZ)
      const fair = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.03), steel)
      fair.position.set(0, y, bumperZ + 0.1)
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 8), steel)
      hook.rotation.y = Math.PI / 2
      hook.position.set(0, y - 0.1, bumperZ + 0.1)
      root.add(drum, fair, hook)
    }
    winchLocal = new THREE.Vector3(0, y, bumperZ + 0.12)
  }
  if ((kit.aux || 0) >= 1) {
    const scale = [0, 0.78, 1, 1.22][Math.min(3, kit.aux)]
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.4 * scale, 8), keepMat(THREE, '#3f6a3a', 0.6, 0.08))
    tank.rotation.z = Math.PI / 2
    tank.position.set(0.28, deckY + 0.04 + 0.12 * scale, cabB - 0.35)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale, 0.015, 0.16), keepMat(THREE, '#1a1a1a', 0.7, 0.1))
    band.position.copy(tank.position)
    root.add(tank, band)
  }
  const cans = Math.max(0, kit.jerry || 0)
  if (cans) {
    const spots = []
    for (let i = 0; i < cans; i++) spots.push([-0.55 + (i % 2) * 0.26, 0, tail + 0.35 + Math.floor(i / 2) * 0.2])
    jerryRack(THREE, root, spots, deckY + 0.02)
  }
  return { coils, winchLocal, links, axles, shaft }
}

function beadlock(THREE, radius, level) {
  const g = new THREE.Group()
  g.userData.hardware = true
  const tire = keepMat(THREE, '#161616', 0.92, 0)
  tire.userData.paintRole = 'tire'
  const width = radius * 0.78
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, width, 14), tire)
  cyl.rotation.z = Math.PI / 2
  g.add(cyl)
  const n = 12 + (level || 0) * 2
  const depth = radius * 0.08 + (level || 0) * 0.01
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const nub = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, depth, radius * 0.16), tire)
    const rad = radius * 0.94 - depth * 0.35
    nub.position.set(0, Math.cos(a) * rad, Math.sin(a) * rad)
    nub.rotation.x = a
    g.add(nub)
  }
  const ringMat = new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.35, metalness: 0.65 })
  ringMat.userData.paintRole = 'rim'
  const hubMat = keepMat(THREE, '#d21f1a', 0.4, 0.2)
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.12, 14), ringMat)
    ring.rotation.z = Math.PI / 2
    ring.position.x = s * width * 0.46
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, width * 0.1, 12), tire)
    dish.rotation.z = Math.PI / 2
    dish.position.x = s * width * 0.5
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width * 0.16, 8), hubMat)
    hub.rotation.z = Math.PI / 2
    hub.position.x = s * width * 0.54
    g.add(ring, dish, hub)
  }
  return g
}

function dress(THREE, body, spec, paint, rack, kit) {
  rack = rack || {}
  const add = (mesh, x, y, z, role) => {
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    tagMaterials(mesh, role || 'accent')
    body.add(mesh)
    return mesh
  }
  if (spec.style === 'bronco') {
    const roof = 2.05
    const railMat = new THREE.MeshStandardMaterial({ color: '#d7d2c6', roughness: 0.45, metalness: 0.35 })
    railMat.userData.paintRole = 'keep'
    for (const x of [-0.72, 0.72]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.15, 8), railMat)
      rail.rotation.x = Math.PI / 2
      rail.position.set(x, roof, -0.05)
      rail.userData.paintRole = 'keep'
      rail.castShadow = true
      body.add(rail)
    }
    for (const z of [-0.85, 0.15, 0.85]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 8), railMat)
      bar.rotation.z = Math.PI / 2
      bar.position.set(0, roof, z)
      bar.castShadow = true
      body.add(bar)
    }
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.34),
      new THREE.MeshStandardMaterial({ color: '#6a4a32', roughness: 0.8 })
    )
    bag.position.set(-0.15, roof + 0.2, -0.35)
    bag.castShadow = true
    body.add(bag)
  }
  if (spec.style === 'wagon') {
    const wood = new THREE.MeshStandardMaterial({
      color: '#c4a06a',
      map: woodMap,
      roughness: 0.84,
      metalness: 0.02
    })
    wood.userData.paintRole = 'keep'
    if (woodMap) woodMap.colorSpace = woodMap.colorSpace
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 1.15), wood)
      panel.position.set(side * 0.96, 1.22, 0.2)
      panel.userData.paintRole = 'keep'
      panel.material.userData.paintRole = 'keep'
      panel.castShadow = true
      body.add(panel)
    }
  }
  if (spec.style === 'van') {
    vanChevron(THREE, body)
    const railMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4, metalness: 0.2 })
    railMat.userData.paintRole = 'keep'
    for (const x of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), railMat)
      rail.rotation.x = Math.PI / 2
      rail.position.set(x, 2.08, 0.05)
      body.add(rail)
    }
  }
  return fitGear(THREE, body, spec, paint, rack, kit)
}

export function buildRig(THREE, spec, opts) {
  opts = opts || {}
  const src = templates.get(spec.style || 'pickup')
  if (!src) throw new Error('rig not loaded: ' + spec.style)
  const paint = Object.assign(factoryPaint(spec), opts.paint || {})
  if (opts.paint) paint.repaint = true
  else if (spec.paint && spec.paint.repaint) paint.repaint = true
  const group = src.clone(true)
  const drop = spec.visualDrop || 0
  const body = group.getObjectByName('body')
  if (body) {
    body.position.y += drop
    if (spec.bodyNudge) body.position.z += spec.bodyNudge
    if (spec.style === 'crawler') body.traverse(o => { if (o.isMesh) o.visible = false })
  }
  group.traverse(o => {
    if (!o.isMesh) return
    const wheel = WHEEL_ORDER.includes(o.name) || (o.parent && WHEEL_ORDER.includes(o.parent.name))
    tagMaterials(o, wheel ? 'wheel' : 'body')
    if (o.name === 'body') o.castShadow = !!opts.shadow
  })
  const wheels = []
  for (const name of WHEEL_ORDER) {
    const w = group.getObjectByName(name)
    if (!w) continue
    if (spec.style === 'crawler') {
      w.scale.set(1, 1, 1)
      w.traverse(o => { if (o.isMesh) o.visible = false })
      const level = (opts.kit && opts.kit.tires) || 0
      w.add(beadlock(THREE, spec.wheelR, level))
      if (level) w.scale.x = 1 + 0.06 * level
      applyPaint(w, paint)
    } else {
      if (spec.wheelScale && spec.wheelScale !== 1) w.scale.multiplyScalar(spec.wheelScale)
      if (opts.kit && opts.kit.tires) {
        w.scale.x *= 1 + 0.07 * opts.kit.tires
        addKnobs(THREE, w, opts.kit.tires)
      }
    }
    if (w.parent) w.parent.remove(w)
    wheels.push(w)
  }
  const dressed = body ? dress(THREE, body, spec, paint, opts.rack, opts.kit) : null
  const coils = dressed && dressed.coils
  applyPaint(group, paint)
  const lamps = []
  const nose = (spec.axleF || spec.wheelbase) + spec.wheelR * 0.35
  for (const s of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff4d4, 0, 40, 0.5, 0.42, 1)
    spot.position.set(s * Math.abs(spec.axles ? spec.axles[0][0] : spec.track) * 0.55, 0.35, nose)
    const tgt = new THREE.Object3D()
    tgt.position.set(s * 0.15, -0.35, nose + 22)
    group.add(spot, tgt)
    spot.target = tgt
    lamps.push(spot)
  }
  group.userData = {
    lamps, high: body ? [body] : [], lod: [], detail: [],
    coils: coils || [],
    links: (dressed && dressed.links) || [],
    axles: (dressed && dressed.axles) || [],
    shaft: dressed && dressed.shaft,
    winchLocal: dressed && dressed.winchLocal,
    paint
  }
  return { group, wheels }
}

function spanPart(THREE, mesh, mount, lower, up, scratch) {
  scratch.span.copy(lower).sub(mount)
  const d = Math.max(0.15, scratch.span.length())
  scratch.span.multiplyScalar(1 / d)
  scratch.mid.copy(mount).add(lower).multiplyScalar(0.5)
  mesh.position.copy(scratch.mid)
  mesh.quaternion.setFromUnitVectors(up, scratch.span)
  mesh.scale.set(1, d, 1)
  mesh.visible = true
}

export function poseRig(THREE, group, wheels) {
  const ud = group && group.userData
  if (!ud || !wheels) return
  const coils = ud.coils || []
  const links = ud.links || []
  const axles = ud.axles || []
  if (!coils.length && !links.length && !axles.length) return
  if (!ud._pose) {
    ud._pose = {
      inv: new THREE.Quaternion(),
      local: new THREE.Vector3(),
      lower: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      span: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      a: new THREE.Vector3(),
      b: new THREE.Vector3()
    }
  }
  const p = ud._pose
  p.inv.copy(group.quaternion).invert()
  const endOf = (index, inboard) => {
    const w = wheels[index]
    if (!w) return null
    p.local.copy(w.position).sub(group.position).applyQuaternion(p.inv)
    if (inboard) {
      p.lower.copy(p.local)
      p.lower.x *= inboard
      return p.lower
    }
    return p.local
  }
  for (const coil of coils) {
    const lower = endOf(coil.index, coil.inboard)
    if (!lower) continue
    spanPart(THREE, coil.shock, coil.mount, lower, p.up, p)
    if (coil.spring) {
      const d = coil.shock.scale.y
      coil.spring.position.copy(coil.shock.position)
      coil.spring.quaternion.copy(coil.shock.quaternion)
      coil.spring.scale.set(1, d * 0.78, 1)
    }
  }
  for (const link of links) {
    const lower = endOf(link.index, link.inboard)
    if (!lower) continue
    spanPart(THREE, link.mesh, link.mount, lower, p.up, p)
  }
  for (const axle of axles) {
    const w0 = wheels[axle.i0]
    const w1 = wheels[axle.i1]
    if (!w0 || !w1) continue
    p.a.copy(w0.position).sub(group.position).applyQuaternion(p.inv)
    p.b.copy(w1.position).sub(group.position).applyQuaternion(p.inv)
    p.a.x *= 0.82
    p.b.x *= 0.82
    spanPart(THREE, axle.bar, p.a, p.b, p.up, p)
    axle.diff.position.copy(p.a).add(p.b).multiplyScalar(0.5)
  }
  if (ud.shaft && axles.length === 2) {
    spanPart(THREE, ud.shaft, axles[0].diff.position, axles[1].diff.position, p.up, p)
  }
}

export function applyLod() {}
