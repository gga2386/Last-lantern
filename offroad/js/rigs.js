// Stylized bevelled 4x4s. Smooth rounded shells, glossy paint, shared wheels. OFFROAD_V4_1
const geoCache = new Map()

function weld(THREE, src) {
  const pos = src.attributes.position
  const eps = 1e-3
  const map = new Map()
  const remap = new Array(pos.count)
  const out = []
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const k = Math.round(x / eps) + ',' + Math.round(y / eps) + ',' + Math.round(z / eps)
    let id = map.get(k)
    if (id == null) {
      id = out.length / 3
      map.set(k, id)
      out.push(x, y, z)
    }
    remap[i] = id
  }
  const idx = []
  const srcIdx = src.index
  const n = srcIdx ? srcIdx.count : pos.count
  for (let i = 0; i < n; i++) idx.push(remap[srcIdx ? srcIdx.getX(i) : i])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function roundedBox(THREE, w, h, d, rad, seg) {
  const r = Math.max(0.001, Math.min(rad, w * 0.5 - 0.001, h * 0.5 - 0.001, d * 0.5 - 0.001))
  const s = Math.max(2, seg | 0)
  const key = ['rb', w.toFixed(3), h.toFixed(3), d.toFixed(3), r.toFixed(3), s].join(':')
  if (geoCache.has(key)) return geoCache.get(key)
  const box = new THREE.BoxGeometry(w, h, d, s, s, s)
  const pos = box.attributes.position
  const hw = w * 0.5 - r, hh = h * 0.5 - r, hd = d * 0.5 - r
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const cx = Math.max(-hw, Math.min(hw, v.x))
    const cy = Math.max(-hh, Math.min(hh, v.y))
    const cz = Math.max(-hd, Math.min(hd, v.z))
    let dx = v.x - cx, dy = v.y - cy, dz = v.z - cz
    const len = Math.hypot(dx, dy, dz)
    if (len > 1e-5) {
      v.set(cx + dx / len * r, cy + dy / len * r, cz + dz / len * r)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
  }
  const geo = weld(THREE, box)
  box.dispose()
  geoCache.set(key, geo)
  return geo
}

function sphere(THREE, r, n) {
  const key = 'sp' + r.toFixed(3) + ':' + n
  if (geoCache.has(key)) return geoCache.get(key)
  const geo = new THREE.SphereGeometry(r, n, Math.max(8, n - 4))
  geoCache.set(key, geo)
  return geo
}

function torus(THREE, r, t, n) {
  const key = 'to' + r.toFixed(3) + ':' + t.toFixed(3) + ':' + n
  if (geoCache.has(key)) return geoCache.get(key)
  const geo = new THREE.TorusGeometry(r, t, 6, n)
  geoCache.set(key, geo)
  return geo
}

function unitSphere(THREE) {
  if (geoCache.has('us')) return geoCache.get('us')
  const geo = new THREE.SphereGeometry(1, 12, 8)
  geoCache.set('us', geo)
  return geo
}

function chevron(THREE, flip) {
  const key = 'ch' + (flip ? '1' : '0')
  if (geoCache.has(key)) return geoCache.get(key)
  const s = new THREE.Shape()
  s.moveTo(0, -0.55)
  s.lineTo(0.95, 0)
  s.lineTo(0, 0.55)
  s.lineTo(0, 0.32)
  s.lineTo(0.48, 0)
  s.lineTo(0, -0.32)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 1 })
  geo.translate(0, 0, -0.03)
  geo.rotateY(Math.PI / 2)
  if (flip) {
    geo.scale(-1, 1, 1)
    if (geo.index) {
      const idx = geo.index.array
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i]
        idx[i] = idx[i + 2]
        idx[i + 2] = t
      }
    } else {
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i += 3) {
        const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i)
        pos.setXYZ(i, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2))
        pos.setXYZ(i + 2, ax, ay, az)
      }
    }
    geo.computeVertexNormals()
  }
  geoCache.set(key, geo)
  return geo
}

function mergeParts(THREE, parts, shadow) {
  const groups = new Map()
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const e = new THREE.Euler()
  for (const part of parts) {
    let g = part.geo
    if (g.index) g = g.toNonIndexed()
    else g = g.clone()
    e.set(part.rx || 0, part.ry || 0, part.rz || 0)
    q.setFromEuler(e)
    p.set(part.x, part.y, part.z)
    sc.set(part.sx || 1, part.sy || 1, part.sz || 1)
    m4.compose(p, q, sc)
    g.applyMatrix4(m4)
    if (!groups.has(part.mat)) groups.set(part.mat, [])
    groups.get(part.mat).push(g)
  }
  const meshes = []
  for (const [mat, geos] of groups) {
    let count = 0
    for (const g of geos) count += g.attributes.position.count
    const pos = new Float32Array(count * 3)
    const nor = new Float32Array(count * 3)
    let o = 0
    for (const g of geos) {
      const pa = g.attributes.position.array
      const na = g.attributes.normal.array
      pos.set(pa, o)
      nor.set(na, o)
      o += pa.length
      g.dispose()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    const mesh = new THREE.Mesh(geo, mat)
    if (shadow && mat.userData.cast) mesh.castShadow = true
    meshes.push(mesh)
  }
  return meshes
}

function wheelGeos(THREE, R, seg) {
  const key = 'w' + R.toFixed(3) + ':' + seg
  if (geoCache.has(key)) return geoCache.get(key)
  const n = seg >= 4 ? 22 : 16
  const tire = new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.3, n)
  tire.rotateZ(Math.PI / 2)
  const tread = new THREE.CylinderGeometry(R * 1.045, R * 1.045, 0.2, n)
  tread.rotateZ(Math.PI / 2)
  const side = new THREE.TorusGeometry(R * 0.86, R * 0.07, 6, n)
  side.rotateY(Math.PI / 2)
  const rim = new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.32, n)
  rim.rotateZ(Math.PI / 2)
  const cap = new THREE.CylinderGeometry(R * 0.22, R * 0.22, 0.36, 12)
  cap.rotateZ(Math.PI / 2)
  const spoke = new THREE.BoxGeometry(0.045, R * 0.55, 0.05)
  const pack = { tire, tread, side, rim, cap, spoke, n }
  geoCache.set(key, pack)
  return pack
}

function makeWheel(THREE, R, seg, rubber, treadMat, sideMat, rimMat, hubMat, shadow) {
  const pack = wheelGeos(THREE, R, seg)
  const g = new THREE.Group()
  const bits = []
  const push = (geo, mat, x, y, z, rx) => bits.push({ geo, mat, x: x || 0, y: y || 0, z: z || 0, rx: rx || 0 })
  push(pack.tire, rubber)
  push(pack.tread, treadMat)
  push(pack.side, sideMat, -0.13, 0, 0)
  push(pack.side, sideMat, 0.13, 0, 0)
  push(pack.rim, rimMat)
  push(pack.cap, hubMat)
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2
    push(pack.spoke, rimMat, 0.02, Math.sin(a) * R * 0.3, Math.cos(a) * R * 0.3, Math.PI / 2 - a)
  }
  for (const mesh of mergeParts(THREE, bits, false)) {
    if (shadow && mesh.material === rubber) mesh.castShadow = true
    g.add(mesh)
  }
  return g
}

export function buildRig(THREE, spec, opts) {
  opts = opts || {}
  const seg = opts.detail || 3
  const rack = Object.assign({ jerry: false, spare: false, kayak: false, bike: false }, opts.rack)
  const liv = (spec.liveries && spec.liveries[(opts.livery || 0) % spec.liveries.length]) || { color: '#b84322', stripe: '#f2e2c4', kind: 'stripe' }
  const kind = liv.kind || 'stripe'
  const env = opts.env || null
  const paint = new THREE.MeshPhysicalMaterial({
    color: liv.color, roughness: 0.26, metalness: 0.02,
    clearcoat: 0.92, clearcoatRoughness: 0.16, envMap: env, envMapIntensity: 0.72
  })
  paint.userData.cast = true
  const accent = new THREE.MeshStandardMaterial({
    color: liv.stripe, roughness: 0.34, metalness: 0.04, envMap: env, envMapIntensity: 0.45
  })
  const accent2 = new THREE.MeshStandardMaterial({
    color: kind === 'chevron' ? '#ff9a2e' : liv.stripe, roughness: 0.36, metalness: 0.04, envMap: env, envMapIntensity: 0.4
  })
  const dark = new THREE.MeshStandardMaterial({ color: spec.dark || 0x1a1c1e, roughness: 0.48, metalness: 0.18, envMapIntensity: 0.35 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x102026, roughness: 0.05, metalness: 0.12, envMap: env, envMapIntensity: 1.15
  })
  glass.userData.role = 'glass'
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff8ea, emissive: 0xfff3c8, emissiveIntensity: 0.55, roughness: 0.18, metalness: 0
  })
  lampMat.userData.role = 'lamp'
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x8a1c16, emissive: 0xff2a22, emissiveIntensity: 0.55, roughness: 0.3
  })
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd9d6ce, roughness: 0.22, metalness: 0.9, envMap: env, envMapIntensity: 1
  })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.72, metalness: 0.02 })
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.95 })
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.62 })
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf3f1ea, roughness: 0.28, metalness: 0.42, envMap: env, envMapIntensity: 0.65
  })
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 })
  const mud = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 1, metalness: 0 })
  const gearGreen = new THREE.MeshStandardMaterial({ color: 0x3e8a34, roughness: 0.55, metalness: 0.05 })
  const kayakMat = new THREE.MeshPhysicalMaterial({
    color: 0xc6e23a, roughness: 0.32, metalness: 0.02, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.5
  })
  const kayakRed = new THREE.MeshPhysicalMaterial({
    color: 0xd24a32, roughness: 0.34, metalness: 0.02, clearcoat: 0.6, clearcoatRoughness: 0.22
  })

  const style = spec.style || 'pickup'
  const R = spec.wheelR
  const track = spec.track
  const wb = spec.wheelbase
  const L = spec.half[2]
  const wy = -0.05 - spec.rest
  const nose = Math.min(L * 0.98, wb + R * 1.2)
  const tail = (style === 'wagon' || style === 'van' || style === 'pickup') ? -L * 0.96 : Math.max(-L * 0.96, -(wb + R * 0.8))
  const bodyW = {
    jeep: track * 1.55,
    van: track * 1.78,
    wagon: track * 1.62,
    utility: track * 1.55,
    bronco: track * 1.58,
    pickup: track * 1.56
  }[style] || track * 1.56
  const parts = []
  const extras = []
  const add = (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) => {
    parts.push({ geo, mat, x, y, z, rx: rx || 0, ry: ry || 0, rz: rz || 0, sx: sx || 1, sy: sy || 1, sz: sz || 1 })
  }
  const rb = (w, h, d, rad) => roundedBox(THREE, w, h, d, rad == null ? 0.08 : rad, seg)
  const ball = r => sphere(THREE, r, seg >= 4 ? 18 : 14)

  const fenders = (flare) => {
    for (const sx of [-1, 1]) {
      for (const sz of [1, -1]) {
        const z = sz * wb
        add(rb(bodyW * 0.34 + 0.28, 0.24, R * 2.05, 0.1), paint, sx * (bodyW * 0.34), wy + R + 0.04, z)
        add(rb(0.16, 0.18, R * 1.55, 0.06), flare, sx * (track + 0.14), wy + R * 0.82, z)
      }
    }
  }

  const face = (lampY, lampR, count, spread) => {
    add(rb(bodyW * 0.72, 0.1, 0.12, 0.04), chrome, 0, 0.28, nose - 0.16)
    add(rb(Math.min(0.78, bodyW * 0.5), style === 'jeep' ? 0.36 : 0.42, 0.1, 0.04), dark, 0, 0.5, nose - 0.02)
    const bars = style === 'jeep' ? 5 : 4
    for (let i = 0; i < bars; i++) {
      add(rb(Math.min(0.66, bodyW * 0.42), 0.028, 0.04, 0.01), chrome, 0, 0.36 + i * 0.075, nose + 0.02)
    }
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * spread
      add(ball(lampR), lampMat, x, lampY, nose + 0.04)
      add(torus(THREE, lampR * 0.92, lampR * 0.18, 16), chrome, x, lampY, nose + 0.02)
    }
    add(rb(bodyW * 0.86, 0.16, 0.18, 0.06), chrome, 0, 0.32, tail - 0.02)
    for (const sx of [-1, 1]) add(ball(0.075), tailMat, sx * bodyW * 0.32, 0.4, tail - 0.06)
  }

  const windows = (y, z0, len, h, count) => {
    const gap = len / count
    for (let i = 0; i < count; i++) {
      const z = z0 - len * 0.5 + gap * (i + 0.5)
      for (const sx of [-1, 1]) {
        add(rb(0.05, h, gap * 0.72, 0.02), glass, sx * (bodyW * 0.5 + 0.012), y, z)
      }
    }
  }

  const mirrors = (y, z) => {
    for (const sx of [-1, 1]) {
      add(rb(0.16, 0.04, 0.04, 0.015), dark, sx * (bodyW * 0.5 + 0.1), y, z)
      add(rb(0.14, 0.1, 0.07, 0.02), dark, sx * (bodyW * 0.5 + 0.18), y, z + 0.02)
    }
  }

  const antenna = (x, y, z) => add(rb(0.025, 1.15, 0.025, 0.012), dark, x, y, z)
  const snorkel = (x, z) => {
    add(rb(0.07, 0.95, 0.07, 0.03), dark, x, 0.7, z)
    add(rb(0.08, 0.08, 0.22, 0.03), dark, x, 1.15, z + 0.08)
  }

  const mudSplat = () => {
    const spots = [
      [0.62, 0.18, 0.35, 0.26],
      [-0.7, 0.16, -0.2, 0.22],
      [0.55, 0.2, -0.85, 0.3],
      [-0.5, 0.15, 0.7, 0.2],
      [0.2, 0.14, nose * 0.7, 0.16],
      [-0.85, 0.22, -0.55, 0.24],
      [0.78, 0.18, 0.15, 0.18]
    ]
    for (const [x, y, z, s] of spots) add(unitSphere(THREE), mud, x, y, z, 0, 0.4, 0, s, s * 0.35, s * 0.72)
  }

  const band = (y, h) => {
    for (const sx of [-1, 1]) add(rb(0.05, h, (nose - tail) * 0.72, 0.02), accent, sx * (bodyW * 0.5 + 0.02), y, (nose + tail) * 0.05)
  }

  if (style === 'jeep') {
    add(rb(bodyW, 0.32, nose - tail - 0.2, 0.09), paint, 0, 0.26, (nose + tail) * 0.08)
    add(rb(bodyW * 0.62, 0.14, nose * 0.62, 0.05), paint, 0, 0.5, nose * 0.28, 0.12, 0, 0)
    for (const sx of [-1, 1]) {
      add(rb(0.38, 0.24, wb * 0.95, 0.1), paint, sx * track * 0.9, wy + R * 0.95, wb * 0.55)
      add(rb(0.36, 0.22, R * 1.85, 0.1), paint, sx * track * 0.9, wy + R * 0.9, -wb * 0.85)
    }
    add(rb(bodyW * 0.86, 0.5, 0.05, 0.02), dark, 0, 0.78, 0.12, -0.42, 0, 0)
    add(rb(bodyW * 0.72, 0.4, 0.04, 0.015), glass, 0, 0.8, 0.16, -0.42, 0, 0)
    for (const sx of [-1, 1]) {
      add(rb(0.06, 0.48, 0.06, 0.025), dark, sx * bodyW * 0.38, 0.85, -0.25)
      add(rb(bodyW * 0.7, 0.06, 0.06, 0.02), dark, 0, 1.08, -0.25)
    }
    face(0.48, 0.11, 2, bodyW * 0.42)
    mirrors(0.72, 0.05)
    antenna(bodyW * 0.2, 1.15, -0.15)
    snorkel(-bodyW * 0.62, 0.15)
  } else if (style === 'van') {
    const h = 1.42
    const bottom = wy + 0.06
    add(rb(bodyW, h, nose - tail - 0.15, 0.2), paint, 0, bottom + h * 0.5, (nose + tail) * 0.02)
    add(rb(bodyW * 0.78, 0.5, 0.06, 0.03), glass, 0, bottom + h * 0.72, nose - 0.12, -0.22, 0, 0)
    windows(bottom + h * 0.7, 0.1, (nose - tail) * 0.55, 0.32, 2)
    add(rb(bodyW * 0.6, 0.34, 0.05, 0.02), glass, 0, bottom + h * 0.7, tail + 0.12)
    face(0.62, 0.1, 2, bodyW * 0.46)
    add(rb(bodyW * 0.7, 0.08, 0.1, 0.03), dark, 0, 0.22, nose + 0.06)
    for (let i = 0; i < 4; i++) add(ball(0.045), lampMat, -0.3 + i * 0.2, 0.2, nose + 0.1)
    mirrors(0.95, nose * 0.45)
    antenna(0.2, bottom + h + 0.55, 0.2)
    if (kind === 'chevron') {
      for (const flip of [0, 1]) {
        add(chevron(THREE, flip), accent, (flip ? 1 : -1) * (bodyW * 0.5 + 0.03), 0.72, 0.15, 0, 0, 0, 1.2, 1.45, 1.2)
        add(chevron(THREE, flip), accent2, (flip ? 1 : -1) * (bodyW * 0.5 + 0.045), 0.64, -0.45, 0, 0, 0, 0.9, 1.1, 0.9)
      }
    } else band(0.7, kind === 'thick' ? 0.34 : 0.16)
  } else if (style === 'wagon') {
    add(rb(bodyW, 0.46, nose - tail - 0.25, 0.12), paint, 0, 0.36, (nose + tail) * 0.05)
    add(rb(bodyW * 0.92, 0.62, (nose - tail) * 0.62, 0.1), paint, 0, 0.82, tail * 0.15)
    add(rb(bodyW * 0.7, 0.16, nose * 0.55, 0.06), paint, 0, 0.58, nose * 0.48, 0.16, 0, 0)
    add(rb(bodyW * 0.72, 0.4, 0.05, 0.02), glass, 0, 0.9, nose * 0.22, -0.48, 0, 0)
    windows(0.9, -0.15, (nose - tail) * 0.48, 0.32, 3)
    add(rb(bodyW * 0.62, 0.36, 0.05, 0.02), glass, 0, 0.88, tail + 0.16, 0.35, 0, 0)
    face(0.46, 0.12, 2, bodyW * 0.4)
    mirrors(0.85, nose * 0.15)
    antenna(bodyW * 0.22, 1.35, -0.2)
    if (kind === 'wood') {
      for (const sx of [-1, 1]) {
        add(rb(0.06, 0.36, 1.55, 0.02), accent, sx * (bodyW * 0.5 + 0.02), 0.46, tail * 0.15)
        for (let i = 0; i < 4; i++) add(rb(0.02, 0.36, 0.025, 0.008), dark, sx * (bodyW * 0.5 + 0.05), 0.46, tail * 0.15 - 0.55 + i * 0.38)
        add(rb(0.04, 0.045, 1.6, 0.015), chrome, sx * (bodyW * 0.5 + 0.04), 0.66, tail * 0.15)
      }
    } else band(0.62, kind === 'thick' ? 0.3 : 0.14)
  } else if (style === 'utility') {
    add(rb(bodyW, 0.5, nose - tail - 0.2, 0.08), paint, 0, 0.38, 0.05)
    add(rb(bodyW * 0.96, 0.7, (nose - tail) * 0.48, 0.07), paint, 0, 0.9, -0.25)
    add(rb(bodyW * 0.88, 0.18, nose * 0.5, 0.05), paint, 0, 0.58, nose * 0.42, 0.08, 0, 0)
    add(rb(bodyW * 0.8, 0.42, 0.05, 0.015), glass, 0, 0.95, 0.22, -0.12, 0, 0)
    windows(0.95, -0.35, 0.9, 0.34, 2)
    face(0.55, 0.085, 4, 0.3)
    mirrors(0.9, 0.15)
    antenna(0.15, 1.45, -0.35)
    snorkel(-bodyW * 0.58, 0.25)
    for (let i = 0; i < 4; i++) add(ball(0.05), lampMat, -0.33 + i * 0.22, 1.32, 0.05)
    if (kind !== 'chevron') band(0.62, kind === 'thick' ? 0.26 : 0.12)
  } else if (style === 'bronco') {
    add(rb(bodyW, 0.48, nose - tail - 0.3, 0.13), paint, 0, 0.38, 0.02)
    add(rb(bodyW * 0.94, 0.58, (nose - tail) * 0.42, 0.1), paint, 0, 0.86, -0.2)
    add(rb(bodyW * 0.86, 0.18, nose * 0.62, 0.07), paint, 0, 0.58, nose * 0.38, 0.18, 0, 0)
    add(rb(bodyW * 0.72, 0.38, 0.045, 0.02), glass, 0, 0.9, 0.12, -0.46, 0, 0)
    windows(0.9, -0.22, 0.85, 0.3, 1)
    add(rb(bodyW * 0.55, 0.28, 0.04, 0.015), glass, 0, 0.88, tail * 0.35 + 0.1)
    face(0.48, 0.125, 2, bodyW * 0.4)
    mirrors(0.86, 0.05)
    antenna(bodyW * 0.15, 1.4, -0.45)
    if (kind === 'thick') {
      band(0.7, 0.22)
      add(rb(bodyW * 0.9, 0.08, (nose - tail) * 0.4, 0.03), accent, 0, 1.18, -0.2)
    } else if (kind === 'chevron') {
      for (const flip of [0, 1]) add(chevron(THREE, flip), accent, (flip ? 1 : -1) * (bodyW * 0.5 + 0.03), 0.55, 0.1, 0, 0, 0, 0.8, 0.7, 0.8)
    } else band(0.66, 0.13)
  } else {
    add(rb(bodyW, 0.42, nose - tail - 0.35, 0.11), paint, 0, 0.34, 0)
    add(rb(bodyW * 0.9, 0.16, nose * 0.58, 0.06), paint, 0, 0.52, nose * 0.42, 0.2, 0, 0)
    add(rb(bodyW * 0.92, 0.62, nose * 0.48, 0.09), paint, 0, 0.82, 0.12)
    add(rb(bodyW * 0.72, 0.08, Math.abs(tail) * 0.62, 0.03), dark, 0, 0.46, tail * 0.52)
    for (const sx of [-1, 1]) add(rb(0.1, 0.32, Math.abs(tail) * 0.62, 0.04), paint, sx * (bodyW * 0.4), 0.64, tail * 0.52)
    add(rb(bodyW * 0.72, 0.28, 0.08, 0.03), paint, 0, 0.58, tail * 0.82)
    add(rb(bodyW * 0.7, 0.36, 0.045, 0.02), glass, 0, 0.88, 0.42, -0.5, 0, 0)
    add(rb(0.05, 0.28, 0.42, 0.02), glass, bodyW * 0.46, 0.84, 0.05)
    add(rb(0.05, 0.28, 0.42, 0.02), glass, -bodyW * 0.46, 0.84, 0.05)
    face(0.46, 0.12, 2, bodyW * 0.4)
    mirrors(0.82, 0.28)
    antenna(0.25, 1.35, -0.05)
    snorkel(-bodyW * 0.55, 0.35)
    if (kind === 'wood') {
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) add(rb(0.04, 0.32, 0.28, 0.012), accent, sx * (bodyW * 0.5 + 0.02), 0.42, -0.15 - i * 0.34)
      }
    } else band(0.58, kind === 'thick' ? 0.24 : 0.12)
  }

  if (style !== 'jeep') fenders(style === 'utility' ? accent : paint)
  mudSplat()

  const roofY = style === 'van' ? (wy + 1.56) : style === 'jeep' ? 1.16 : style === 'utility' ? 1.32 : style === 'pickup' ? 1.22 : 1.26
  const roofLoad = rack.jerry || rack.kayak || (rack.spare && style === 'van')
  if (roofLoad) {
    for (const sx of [-1, 1]) add(rb(0.06, 0.05, (nose - tail) * 0.42, 0.02), dark, sx * 0.38, roofY, style === 'pickup' ? tail * 0.35 : 0)
    add(rb(0.9, 0.04, 0.06, 0.015), dark, 0, roofY, 0.35)
    add(rb(0.9, 0.04, 0.06, 0.015), dark, 0, roofY, -0.45)
  }
  if (rack.jerry) {
    for (const x of [-0.42, 0, 0.42]) {
      add(rb(0.42, 0.26, 0.26, 0.06), gearGreen, x, roofY + 0.2, style === 'wagon' ? 0.15 : -0.15, 0, 0, Math.PI / 2)
      add(rb(0.18, 0.08, 0.12, 0.02), dark, x, roofY + 0.36, style === 'wagon' ? 0.15 : -0.15)
    }
    add(rb(0.7, 0.22, 0.38, 0.08), accent, 0, roofY + 0.16, 0.45)
  }
  if (rack.kayak) {
    const hull = new THREE.CapsuleGeometry(0.1, 2.15, 3, 8)
    hull.rotateX(Math.PI / 2)
    add(hull, kayakMat, -0.08, roofY + 0.2, 0.05)
    const hull2 = new THREE.CapsuleGeometry(0.08, 1.95, 3, 8)
    hull2.rotateX(Math.PI / 2)
    add(hull2, kayakRed, 0.16, roofY + 0.22, -0.08)
  }
  if (rack.bike) {
    const wheel = torus(THREE, 0.32, 0.04, 18)
    add(wheel, rubber, 0.34, 0.78, tail - 0.15)
    add(wheel, rubber, 0.34, 0.78, tail - 0.72)
    add(rb(0.05, 0.05, 0.7, 0.02), kayakRed, 0.34, 0.98, tail - 0.42)
    add(rb(0.32, 0.04, 0.04, 0.015), dark, 0.34, 1.12, tail - 0.12)
    add(rb(0.55, 0.08, 0.28, 0.03), dark, 0.1, 0.62, tail - 0.02)
  }
  if (rack.spare && style === 'van') {
    for (let i = 0; i < 4; i++) {
      const w = makeWheel(THREE, R * 0.78, seg, rubber, treadMat, sideMat, rimMat, hubMat, false)
      w.position.set(0.02, roofY + 0.08, -0.55 + i * 0.38)
      extras.push(w)
    }
  } else if (rack.spare && style === 'utility') {
    const w = makeWheel(THREE, R * 0.9, seg, rubber, treadMat, sideMat, rimMat, hubMat, false)
    w.position.set(0, 0.72, nose * 0.42)
    w.rotation.order = 'YXZ'
    w.rotation.y = Math.PI / 2
    w.rotation.x = -1.05
    extras.push(w)
  } else if (rack.spare) {
    const w = makeWheel(THREE, R * 0.92, seg, rubber, treadMat, sideMat, rimMat, hubMat, false)
    w.position.set(0, 0.48, tail + 0.02)
    w.rotation.y = Math.PI / 2
    extras.push(w)
  }

  const g = new THREE.Group()
  g.name = spec.id
  for (const mesh of mergeParts(THREE, parts, !!opts.shadow)) g.add(mesh)
  for (const extra of extras) g.add(extra)

  const lamps = []
  for (const s of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff4d4, 0, 40, 0.5, 0.42, 1)
    spot.position.set(s * track * 0.45, 0.48, nose * 0.85)
    const tgt = new THREE.Object3D()
    tgt.position.set(s * 0.2, -0.35, nose + 24)
    g.add(spot, tgt)
    spot.target = tgt
    if (opts.shadow) {
      spot.castShadow = false
      spot.shadow.mapSize.set(256, 256)
      spot.shadow.camera.near = 0.4
      spot.shadow.camera.far = 48
      spot.shadow.bias = -0.001
    }
    lamps.push(spot)
  }
  g.userData = { lampMat, tailMat, lamps }

  const wheels = []
  for (let i = 0; i < 4; i++) wheels.push(makeWheel(THREE, R, seg, rubber, treadMat, sideMat, rimMat, hubMat, !!opts.shadow))
  return { group: g, wheels }
}
