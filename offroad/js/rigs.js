// Stylized low-poly 4x4s. Bevelled bodies, canvas paint, shared wheels. OFFROAD_V4
const geoCache = new Map()
const texCache = new Map()

function shapeBox(THREE, w, h, d, r) {
  const key = [w, h, d, r].map(n => n.toFixed(3)).join(':')
  if (geoCache.has(key)) return geoCache.get(key)
  const rr = Math.min(r, w * 0.45, h * 0.45)
  const s = new THREE.Shape()
  const x = -w / 2, y = -h / 2
  s.moveTo(x + rr, y)
  s.lineTo(x + w - rr, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rr)
  s.lineTo(x + w, y + h - rr)
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  s.lineTo(x + rr, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rr)
  s.lineTo(x, y + rr)
  s.quadraticCurveTo(x, y, x + rr, y)
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: d, bevelEnabled: true, bevelThickness: rr * 0.45, bevelSize: rr * 0.28,
    bevelSegments: 1, curveSegments: 2
  })
  geo.translate(0, 0, -d / 2)
  geo.computeVertexNormals()
  geoCache.set(key, geo)
  return geo
}

function paintMap(THREE, base, stripe, kind) {
  const key = base + '|' + stripe + '|' + kind
  if (texCache.has(key)) return texCache.get(key)
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, 256, 256)
  if (kind === 'wood') {
    g.fillStyle = stripe
    for (let i = 0; i < 8; i++) g.fillRect(8 + i * 32, 150, 22, 106)
    g.globalAlpha = 0.35
    g.fillStyle = '#5a3a22'
    for (let i = 0; i < 8; i++) g.fillRect(8 + i * 32, 150, 4, 106)
    g.globalAlpha = 1
  } else if (kind === 'chevron') {
    g.fillStyle = stripe
    g.beginPath()
    g.moveTo(0, 40); g.lineTo(90, 128); g.lineTo(0, 216); g.lineTo(0, 170); g.lineTo(40, 128); g.lineTo(0, 86); g.closePath()
    g.fill()
    g.fillStyle = '#e4572e'
    g.beginPath()
    g.moveTo(0, 70); g.lineTo(50, 128); g.lineTo(0, 186); g.lineTo(0, 150); g.lineTo(18, 128); g.lineTo(0, 106); g.closePath()
    g.fill()
  } else {
    g.fillStyle = stripe
    g.fillRect(0, 78, 256, kind === 'thick' ? 54 : 28)
  }
  g.fillStyle = 'rgba(42,32,24,0.55)'
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 256
    const y = 150 + Math.random() * 106
    const rad = 4 + Math.random() * 14
    g.beginPath(); g.ellipse(x, y, rad, rad * 0.6, Math.random(), 0, 6.3); g.fill()
  }
  g.fillStyle = 'rgba(90,90,90,0.35)'
  for (let i = 0; i < 18; i++) {
    g.beginPath()
    g.arc(Math.random() * 256, 170 + Math.random() * 80, 2 + Math.random() * 5, 0, 6.3)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  texCache.set(key, tex)
  return tex
}

function wheelGeos(THREE, R) {
  const key = 'w' + R.toFixed(3)
  if (geoCache.has(key)) return geoCache.get(key)
  const tire = new THREE.CylinderGeometry(R, R * 1.02, 0.36, 12)
  tire.rotateZ(Math.PI / 2)
  const tread = new THREE.TorusGeometry(R * 0.9, R * 0.11, 4, 12)
  tread.rotateY(Math.PI / 2)
  const rim = new THREE.CylinderGeometry(R * 0.46, R * 0.5, 0.38, 8)
  rim.rotateZ(Math.PI / 2)
  const pack = { tire, tread, rim }
  geoCache.set(key, pack)
  return pack
}

export function buildRig(THREE, spec, opts) {
  opts = opts || {}
  const rack = Object.assign({ jerry: false, spare: false, kayak: false, bike: false }, opts.rack)
  const g = new THREE.Group()
  const liv = (spec.liveries && spec.liveries[(opts.livery || 0) % spec.liveries.length]) || { color: '#b84322', stripe: '#f2e2c4', kind: 'stripe' }
  const map = paintMap(THREE, liv.color, liv.stripe, liv.kind || 'stripe')
  const paint = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.55, metalness: 0.22 })
  const dark = new THREE.MeshStandardMaterial({ color: spec.dark || 0x1b2126, roughness: 0.5, metalness: 0.45 })
  const glass = new THREE.MeshStandardMaterial({ color: spec.glass || 0x9ec9d4, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 })
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffe7b0, emissiveIntensity: 0.2 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x6e1612, emissive: 0xff2a18, emissiveIntensity: 0.35 })
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8c2b6, roughness: 0.35, metalness: 0.7 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92 })
  const W = spec.half[0], L = spec.half[2]
  const body = (mat, w, h, d, x, y, z, rad) => {
    const m = new THREE.Mesh(shapeBox(THREE, w, h, d, rad == null ? 0.12 : rad), mat)
    m.position.set(x, y, z)
    if (opts.shadow) m.castShadow = true
    g.add(m)
    return m
  }
  const bar = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    g.add(m)
    return m
  }
  const style = spec.style || 'pickup'
  if (style === 'jeep') {
    body(paint, W * 1.85, 0.42, L * 1.7, 0, 0.12, 0, 0.1)
    body(paint, W * 1.55, 0.22, L * 0.7, 0, 0.38, L * 0.42, 0.06)
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.35, 0.48), glass)
    wind.position.set(0, 0.72, L * 0.05); wind.rotation.x = -0.55; g.add(wind)
    bar(dark, 0.06, 0.5, 0.06, -W * 0.62, 0.7, L * 0.02)
    bar(dark, 0.06, 0.5, 0.06, W * 0.62, 0.7, L * 0.02)
  } else if (style === 'van') {
    body(paint, W * 1.9, 1.35, L * 1.75, 0, 0.72, -0.05, 0.16)
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, 0.55), glass)
    wind.position.set(0, 0.95, L * 0.78); wind.rotation.x = -0.18; g.add(wind)
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.7, 0.32), glass)
      side.position.set(s * W * 0.96, 0.95, -0.1)
      side.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2
      g.add(side)
    }
  } else if (style === 'wagon') {
    body(paint, W * 1.9, 0.48, L * 1.85, 0, 0.16, 0, 0.12)
    body(paint, W * 1.75, 0.62, L * 1.35, 0, 0.68, -0.15, 0.1)
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.4, 0.42), glass)
    wind.position.set(0, 0.78, L * 0.48); wind.rotation.x = -0.4; g.add(wind)
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.85, 0.28), glass)
      side.position.set(s * W * 0.9, 0.78, -0.15)
      side.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2
      g.add(side)
    }
  } else if (style === 'utility') {
    body(paint, W * 1.85, 0.5, L * 1.7, 0, 0.2, 0.05, 0.08)
    body(paint, W * 1.7, 0.72, L * 0.95, 0, 0.78, -0.25, 0.06)
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.4, 0.4), glass)
    wind.position.set(0, 0.85, L * 0.18); wind.rotation.x = -0.15; g.add(wind)
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), glass)
      side.position.set(s * W * 0.88, 0.82, -0.2)
      side.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2
      g.add(side)
    }
  } else if (style === 'bronco') {
    body(paint, W * 1.9, 0.48, L * 1.65, 0, 0.18, 0, 0.14)
    body(paint, W * 1.7, 0.58, L * 0.85, 0, 0.7, -0.15, 0.1)
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.35, 0.4), glass)
    wind.position.set(0, 0.78, L * 0.22); wind.rotation.x = -0.38; g.add(wind)
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), glass)
      side.position.set(s * W * 0.88, 0.78, -0.12)
      side.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2
      g.add(side)
    }
  } else {
    body(paint, W * 1.9, 0.46, L * 1.85, 0, 0.16, 0, 0.1)
    body(paint, W * 1.65, 0.62, L * 0.7, 0, 0.68, 0.15, 0.08)
    body(paint, W * 1.55, 0.22, L * 0.55, 0, 0.42, L * 0.55, 0.06)
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, 0.38), glass)
    wind.position.set(0, 0.75, L * 0.42); wind.rotation.x = -0.42; g.add(wind)
    bar(paint, 0.08, 0.28, L * 0.7, -W * 0.82, 0.48, -L * 0.45)
    bar(paint, 0.08, 0.28, L * 0.7, W * 0.82, 0.48, -L * 0.45)
  }
  bar(dark, W * 1.95, 0.16, 0.12, 0, 0.1, L * 0.92)
  bar(dark, W * 1.7, 0.14, 0.1, 0, 0.12, -L * 0.95)
  bar(dark, W * 0.7, 0.28, 0.06, 0, 0.36, L * 0.9)
  for (let i = -1; i <= 1; i++) bar(steel, W * 0.58, 0.025, 0.02, 0, 0.32 + i * 0.07, L * 0.94)
  const lampCount = style === 'van' ? 4 : 2
  for (let i = 0; i < lampCount; i++) {
    const s = lampCount === 2 ? (i === 0 ? -1 : 1) : (i - 1.5) * 0.55
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(style === 'van' && i > 0 && i < 3 ? 0.045 : 0.07, 8, 6), lampMat)
    lamp.position.set(s * (style === 'van' ? 0.42 : W * 0.55), style === 'van' && lampCount === 4 && (i === 0 || i === 3) ? 0.22 : 0.38, L * 0.98)
    g.add(lamp)
  }
  for (const s of [-1, 1]) bar(tailMat, 0.16, 0.08, 0.05, s * W * 0.62, 0.32, -L * 0.98)
  for (const s of [-1, 1]) bar(dark, 0.08, 0.12, 0.22, s * W * 0.98, 0.78, L * 0.15)
  const snorkel = style === 'jeep' || style === 'utility' || style === 'pickup'
  if (snorkel) {
    const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5), dark)
    sn.position.set(-W * 0.9, 0.75, L * 0.2)
    g.add(sn)
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4), dark)
  ant.position.set(W * 0.4, 1.35, style === 'van' ? 0.2 : -0.1)
  g.add(ant)
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    bar(paint, 0.42, 0.12, 0.62, sx * W * 0.78, 0.22, sz * L * 0.55)
  }
  const roofY = style === 'van' ? 1.45 : style === 'jeep' ? 0.7 : 1.05
  if (rack.jerry || rack.kayak || rack.bike || (rack.spare && style === 'van')) {
    bar(dark, W * 1.3, 0.04, L * 0.8, 0, roofY, style === 'pickup' ? -0.2 : 0)
  }
  if (rack.jerry) {
    for (const s of [-0.5, 0.5]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 6), new THREE.MeshStandardMaterial({ color: 0x3d6b3a, roughness: 0.6 }))
      can.rotation.z = Math.PI / 2
      can.position.set(s * 0.35, roofY + 0.16, style === 'wagon' ? 0.1 : -0.35)
      g.add(can)
    }
  }
  if (rack.kayak) {
    const kay = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.3, 2, 6), new THREE.MeshStandardMaterial({ color: 0x7dce4a, roughness: 0.45 }))
    kay.rotation.x = Math.PI / 2
    kay.position.set(0, roofY + 0.22, 0)
    g.add(kay)
  }
  if (rack.bike) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 4, 10), dark)
    wheel.position.set(0, 0.7, -L * 0.95)
    g.add(wheel)
    bar(dark, 0.04, 0.4, 0.5, 0, 0.85, -L * 0.9)
  }
  if (rack.spare && style !== 'van') {
    const sp = new THREE.Mesh(new THREE.TorusGeometry(spec.wheelR * 0.72, 0.07, 4, 10), rubber)
    if (style === 'utility') { sp.position.set(0, 0.55, L * 0.85) }
    else sp.position.set(0, 0.55, -L * 0.98)
    g.add(sp)
  }
  if (style === 'van' && rack.spare) {
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const sp = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 8), rubber)
      sp.rotation.y = Math.PI / 2
      sp.position.set(-0.4 + col * 0.4, roofY + 0.28, -0.25 + row * 0.45)
      g.add(sp)
    }
  }
  const lamps = []
  for (const s of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff4d4, 0, 40, 0.5, 0.42, 1)
    spot.position.set(s * W * 0.45, 0.42, L * 0.9)
    const tgt = new THREE.Object3D()
    tgt.position.set(s * W * 0.1, -0.4, L + 22)
    g.add(spot, tgt)
    spot.target = tgt
    if (opts.shadow) {
      spot.castShadow = true
      spot.shadow.mapSize.set(256, 256)
      spot.shadow.camera.near = 0.4
      spot.shadow.camera.far = 48
      spot.shadow.bias = -0.001
    }
    lamps.push(spot)
  }
  g.userData = { lampMat, tailMat, lamps }
  const wheels = []
  const geos = wheelGeos(THREE, spec.wheelR)
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(geos.tire, rubber)
    wheel.add(new THREE.Mesh(geos.tread, rubber))
    wheel.add(new THREE.Mesh(geos.rim, steel))
    wheels.push(wheel)
  }
  return { group: g, wheels }
}
