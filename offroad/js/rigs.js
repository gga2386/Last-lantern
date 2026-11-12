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

function dress(THREE, body, spec, paint, rack) {
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
  if ((spec.style === 'jeep' || spec.style === 'bronco') && rack.kayak) {
    const kayak = accessory('kayak', spec.style === 'jeep' ? 0.55 : 0.5)
    if (kayak) {
      kayak.position.set(0, spec.style === 'jeep' ? 1.85 : 2.05, 0.1)
      kayak.rotation.y = 0.15
      body.add(kayak)
    }
  }
  if ((spec.style === 'bronco' || spec.style === 'pickup') && rack.jerry) {
    for (const x of spec.style === 'pickup' ? [-0.35, 0.15] : [-0.28, 0.22]) {
      const can = accessory('gascan', 0.55)
      if (!can) continue
      can.position.set(x, spec.style === 'pickup' ? 1.35 : 2.22, spec.style === 'pickup' ? -0.15 : 0.42)
      can.scale.setScalar(0.22)
      body.add(can)
    }
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
  if (spec.style === 'utility' && rack.spare) {
    for (const x of [-0.32, 0.32]) {
      const tire = accessory('spare', 0.9, 'wheel')
      if (!tire) continue
      tire.position.set(x, 1.05, -1.55)
      tire.rotation.z = Math.PI / 2
      body.add(tire)
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
    if (rack.spare) for (const z of [-0.7, -0.15, 0.4, 0.95]) {
      const tire = accessory('spare', 0.42, 'wheel')
      if (!tire) continue
      tire.position.set(0, 2.22, z)
      tire.rotation.x = Math.PI / 2
      body.add(tire)
    }
  }
  if (spec.style === 'crawler') {
    const cageMat = new THREE.MeshStandardMaterial({ color: paint.cage, roughness: 0.32, metalness: 0.55 })
    cageMat.userData.paintRole = 'cage'
    const up = new THREE.Vector3(0, 1, 0)
    const span = (ax, ay, az, bx, by, bz, r) => {
      const a = new THREE.Vector3(ax, ay, az)
      const b = new THREE.Vector3(bx, by, bz)
      const dir = b.clone().sub(a)
      const len = dir.length()
      if (len < 0.05) return
      dir.multiplyScalar(1 / len)
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), cageMat)
      m.position.copy(a).add(b).multiplyScalar(0.5)
      m.quaternion.setFromUnitVectors(up, dir)
      m.userData.paintRole = 'cage'
      m.castShadow = true
      body.add(m)
    }
    const X = 1.30
    const roofY = 3.92
    for (const s of [-1, 1]) {
      const x = s * X
      span(x, roofY, 0.78, x, roofY, -0.68, 0.05)
      span(x, 2.55, 1.05, x, roofY, 0.72, 0.048)
      span(x, 2.15, -0.82, x, roofY, -0.62, 0.048)
      span(x, 2.55, 1.05, x, 2.15, -0.82, 0.036)
      span(x, roofY, 0.55, x, 2.35, -0.55, 0.034)
      span(x, roofY, -0.62, s * 1.22, 2.40, -1.65, 0.046)
      span(s * 1.22, 2.40, -0.82, s * 1.22, 2.40, -1.65, 0.036)
      span(x, 2.15, -0.82, s * 1.22, 2.40, -1.55, 0.032)
    }
    span(-X, roofY, 0.78, X, roofY, 0.78, 0.05)
    span(-X, roofY, -0.68, X, roofY, -0.68, 0.05)
    span(-X, roofY, 0.05, X, roofY, 0.05, 0.038)
    span(-1.22, 2.40, -1.65, 1.22, 2.40, -1.65, 0.042)
    span(-X, 2.62, 1.02, X, 2.62, 1.02, 0.036)
    const coils = []
    const shockMat = new THREE.MeshStandardMaterial({ color: paint.cage, roughness: 0.3, metalness: 0.35 })
    shockMat.userData.paintRole = 'cage'
    const springMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7, metalness: 0.1 })
    springMat.userData.paintRole = 'tire'
    spec.axles.forEach((a, i) => {
      const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), shockMat)
      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 7), springMat)
      shock.userData.paintRole = 'cage'
      spring.userData.paintRole = 'tire'
      body.parent.add(shock, spring)
      coils.push({
        shock, spring, index: i,
        mount: new THREE.Vector3(a[0] * 0.55, a[1] + spec.visualDrop + 0.72, a[2] * 0.82)
      })
    })
    return coils
  }
  return null
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
    if (spec.wheelScale && spec.wheelScale !== 1) w.scale.multiplyScalar(spec.wheelScale)
    if (w.parent) w.parent.remove(w)
    wheels.push(w)
  }
  const coils = body ? dress(THREE, body, spec, paint, opts.rack) : null
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
  group.userData = { lamps, high: body ? [body] : [], lod: [], detail: [], coils: coils || [], paint }
  return { group, wheels }
}

export function poseRig(THREE, group, wheels) {
  const coils = group && group.userData && group.userData.coils
  if (!coils || !coils.length || !wheels) return
  const ud = group.userData
  if (!ud._pose) {
    ud._pose = {
      inv: new THREE.Quaternion(),
      local: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      span: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0)
    }
  }
  const p = ud._pose
  p.inv.copy(group.quaternion).invert()
  for (const coil of coils) {
    const w = wheels[coil.index]
    if (!w) continue
    p.local.copy(w.position).sub(group.position).applyQuaternion(p.inv)
    p.span.copy(p.local).sub(coil.mount)
    const d = Math.max(0.2, p.span.length())
    p.span.multiplyScalar(1 / d)
    p.mid.copy(coil.mount).add(p.local).multiplyScalar(0.5)
    coil.shock.position.copy(p.mid)
    coil.shock.quaternion.setFromUnitVectors(p.up, p.span)
    coil.shock.scale.set(1, d, 1)
    coil.spring.position.copy(p.mid)
    coil.spring.quaternion.copy(coil.shock.quaternion)
    coil.spring.scale.set(1, d * 0.62, 1)
    coil.shock.visible = true
  }
}

export function applyLod() {}
