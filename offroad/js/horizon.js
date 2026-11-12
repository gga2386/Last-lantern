// Distant ridgelines, well outside the map. OFFROAD_V10_8
export function createRidges(THREE, scene) {
  const regions = ['forest', 'desert', 'mountain']
  const layers = []
  const sun = new THREE.Vector3(0.42, 0.74, 0.28).normalize()
  function ridgeHeight(region, kind, a) {
    const s = Math.sin(a * (2.1 + kind * 0.4) + kind)
    const s2 = Math.sin(a * (4.6 + kind) + 0.7)
    const s3 = Math.sin(a * (11 + kind * 2) + 1.4)
    if (region === 'desert') {
      const cells = 5 + kind
      const cell = (a / (Math.PI * 2)) * cells
      const frac = cell - Math.floor(cell)
      const cliff = frac < 0.14 ? frac / 0.14 : frac > 0.86 ? (1 - frac) / 0.14 : 1
      const shelf = 0.62 + 0.38 * Math.abs(Math.sin(Math.floor(cell) * 1.9 + kind))
      return (80 + kind * 22) * shelf * (0.45 + 0.55 * cliff)
    }
    if (region === 'mountain') {
      const peak = Math.pow(Math.abs(s), 0.38)
      const notch = Math.abs(s3) > 0.88 ? 0.48 : 1
      return (48 + kind * 12) + peak * notch * (120 + kind * 36) + Math.abs(s2) * (14 + kind * 4)
    }
    const roll = 0.5 + 0.5 * Math.sin(a * (2.2 + kind * 0.3) + 0.5)
    const peak = kind >= 2 ? Math.pow(Math.abs(Math.sin(a * 1.6 + 1.1)), 1.15) : Math.abs(s2) * 0.4
    return (36 + kind * 10) + roll * (28 + kind * 10) + peak * (70 + kind * 24)
  }
  const rings = [
    { inner: 700, outer: 980, base: 4, kind: 0 },
    { inner: 1120, outer: 1460, base: 8, kind: 1 },
    { inner: 1620, outer: 2040, base: 12, kind: 2 },
    { inner: 2200, outer: 2700, base: 16, kind: 3 }
  ]
  const sky = [0.58, 0.7, 0.86]
  function tint(rgb, kind, shade) {
    const fade = [0.02, 0.1, 0.22, 0.4][kind]
    return rgb.map((c, i) => (c * (1 - fade) + sky[i] * fade) * shade)
  }
  for (const ring of rings) {
    const bucket = { kind: ring.kind, meshes: {} }
    for (const region of regions) {
      const N = 64
      const hs = []
      let maxH = 1
      for (let i = 0; i <= N; i++) {
        const h = ridgeHeight(region, ring.kind, (i / N) * Math.PI * 2)
        hs.push(h)
        if (h > maxH) maxH = h
      }
      const pos = []
      const col = []
      const idx = []
      const push = (x, y, z, rgb) => {
        pos.push(x, y, z)
        col.push(rgb[0], rgb[1], rgb[2])
      }
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2
        const a1 = ((i + 1) / N) * Math.PI * 2
        const h0 = hs[i]
        const h1 = hs[i + 1]
        const p = [
          [Math.cos(a0) * ring.inner, ring.base, Math.sin(a0) * ring.inner],
          [Math.cos(a0) * ring.outer, h0, Math.sin(a0) * ring.outer],
          [Math.cos(a1) * ring.inner, ring.base, Math.sin(a1) * ring.inner],
          [Math.cos(a1) * ring.outer, h1, Math.sin(a1) * ring.outer]
        ]
        const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2]
        const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2]
        let nx = uy * vz - uz * vy
        let ny = uz * vx - ux * vz
        let nz = ux * vy - uy * vx
        const nl = Math.hypot(nx, ny, nz) || 1
        nx /= nl; ny /= nl; nz /= nl
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz }
        const nd = Math.max(0, nx * sun.x + ny * sun.y + nz * sun.z)
        const shade = 0.38 + 0.62 * nd
        const top = (h0 + h1) * 0.5
        const paint = (y) => {
          const t = Math.max(0, Math.min(1, (y - ring.base) / Math.max(8, top - ring.base)))
          let rgb
          if (region === 'desert') {
            const band = Math.floor(t * 4) % 3
            rgb = band === 0 ? [0.55, 0.22, 0.12] : band === 1 ? [0.78, 0.42, 0.2] : [0.4, 0.16, 0.1]
          } else if (region === 'mountain') {
            rgb = t > 0.72 ? [0.82, 0.85, 0.88] : [0.36, 0.35, 0.34]
          } else if (ring.kind >= 2) {
            rgb = [0.38, 0.5, 0.7]
          } else {
            rgb = [0.22 + t * 0.08, 0.34 + t * 0.06, 0.2]
          }
          return tint(rgb, ring.kind, shade * (y > ring.base + 2 ? 1 : 0.72))
        }
        const base = pos.length / 3
        push(p[0][0], p[0][1], p[0][2], paint(p[0][1]))
        push(p[1][0], p[1][1], p[1][2], paint(p[1][1]))
        push(p[2][0], p[2][1], p[2][2], paint(p[2][1]))
        push(p[3][0], p[3][1], p[3][2], paint(p[3][1]))
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      geo.setIndex(idx)
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: false,
        side: THREE.DoubleSide,
        depthWrite: true,
        toneMapped: false
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.frustumCulled = false
      mesh.renderOrder = 1
      mesh.visible = false
      scene.add(mesh)
      bucket.meshes[region] = mesh
    }
    layers.push(bucket)
  }
  const treeN = 80
  const treePos = []
  const treeCol = []
  const treeIdx = []
  for (let i = 0; i < treeN; i++) {
    const a0 = (i / treeN) * Math.PI * 2
    const a1 = ((i + 1) / treeN) * Math.PI * 2
    const spike = 6 + Math.abs(Math.sin(a0 * 29)) * 10
    const base = treePos.length / 3
    const dark = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7))
    for (const [a, y, rad] of [[a0, 2, 520], [a0, spike, 560], [a1, 2, 520], [a1, spike, 560]]) {
      treePos.push(Math.cos(a) * rad, y, Math.sin(a) * rad)
      treeCol.push(0.12 * dark, 0.22 * dark, 0.16 * dark)
    }
    treeIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }
  const treeGeo = new THREE.BufferGeometry()
  treeGeo.setAttribute('position', new THREE.Float32BufferAttribute(treePos, 3))
  treeGeo.setAttribute('color', new THREE.Float32BufferAttribute(treeCol, 3))
  treeGeo.setIndex(treeIdx)
  const treeline = new THREE.Mesh(treeGeo, new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: false,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false
  }))
  treeline.frustumCulled = false
  treeline.renderOrder = 1
  scene.add(treeline)
  const tmp = new THREE.Color()
  function update(weights, elev, hor) {
    const night = Math.max(0, Math.min(1, (-elev + 0.04) / 0.3))
    const lift = 0.28 + (1 - night) * 0.72
    treeline.visible = weights.forest > 0.08
    treeline.material.opacity = Math.min(0.85, weights.forest)
    treeline.material.color.setRGB(lift, lift, lift)
    const warm = Math.max(0, Math.min(1, (0.32 - elev) / 0.32))
    for (const layer of layers) {
      tmp.setRGB(lift, lift, lift)
      if (warm > 0.2) tmp.lerp(hor, warm * 0.22)
      for (const region of regions) {
        const mesh = layer.meshes[region]
        const w = weights[region] || 0
        mesh.visible = w > 0.05
        mesh.material.color.copy(tmp)
      }
    }
  }
  return { update }
}
