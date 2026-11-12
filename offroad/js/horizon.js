// Procedural ridgelines. No third-party geometry. OFFROAD_V10_7
export function createRidges(THREE, scene) {
  const regions = ['forest', 'desert', 'mountain']
  const layers = []
  function ridgeHeight(region, kind, a) {
    const s = Math.sin(a * (2.2 + kind * 0.55) + kind * 1.7)
    const s2 = Math.sin(a * (5.4 + kind * 1.3) + 0.6)
    const s3 = Math.sin(a * (13 + kind) + 2.1)
    if (region === 'desert') {
      const cells = 6 + kind
      const cell = (a / (Math.PI * 2)) * cells
      const frac = cell - Math.floor(cell)
      const cliff = frac < 0.16 ? frac / 0.16 : frac > 0.84 ? (1 - frac) / 0.16 : 1
      const shelf = 0.55 + 0.45 * Math.abs(Math.sin(Math.floor(cell) * 1.7 + kind * 2.2))
      return (36 + kind * 28) * shelf * (0.22 + 0.78 * cliff) + Math.abs(s3) * 6
    }
    if (region === 'mountain') {
      const peak = Math.pow(Math.abs(s), 0.28)
      const notch = Math.abs(s3) > 0.84 ? 0.42 : 1
      return (40 + kind * 18) + peak * notch * (70 + kind * 48) + Math.abs(s2) * (16 + kind * 8)
    }
    const roll = 0.5 + 0.5 * Math.sin(a * (2.4 + kind * 0.35) + 0.4)
    const peak = kind >= 2 ? Math.pow(Math.abs(Math.sin(a * 1.7 + 0.9)), 1.2) : Math.abs(s2) * 0.2
    return (32 + kind * 14) + roll * (22 + kind * 12) + peak * (48 + kind * 26)
  }
  const rings = [
    { inner: 300, outer: 420, base: 6, kind: 0 },
    { inner: 420, outer: 560, base: 16, kind: 1 },
    { inner: 560, outer: 740, base: 28, kind: 2 },
    { inner: 740, outer: 980, base: 42, kind: 3 }
  ]
  for (const ring of rings) {
    const bucket = { kind: ring.kind, meshes: {} }
    for (const region of regions) {
      const N = 72
      const pos = []
      const col = []
      const idx = []
      const hs = []
      let maxH = 1
      for (let i = 0; i <= N; i++) {
        const h = ridgeHeight(region, ring.kind, (i / N) * Math.PI * 2)
        hs.push(h)
        if (h > maxH) maxH = h
      }
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2
        const h = hs[i]
        const c0 = Math.cos(a)
        const s0 = Math.sin(a)
        pos.push(c0 * ring.inner, ring.base, s0 * ring.inner, c0 * ring.outer, h, s0 * ring.outer)
        const prev = hs[Math.max(0, i - 1)]
        const next = hs[Math.min(N, i + 1)]
        const slope = Math.abs(next - prev) / Math.max(8, maxH)
        const light = 0.42 + 0.58 * (1 - Math.min(1, slope * 1.4)) * (0.55 + 0.45 * (h / maxH))
        const aerial = ring.kind / 3
        const t = h / maxH
        let cr, cg, cb
        if (region === 'desert') {
          const band = Math.floor(t * 5) % 3
          const strata = band === 0 ? [0.62, 0.24, 0.12] : band === 1 ? [0.86, 0.48, 0.22] : [0.45, 0.16, 0.1]
          cr = strata[0]; cg = strata[1]; cb = strata[2]
        } else if (region === 'mountain') {
          const snow = t > 0.62
          const rock = t > 0.38 ? [0.48, 0.46, 0.44] : [0.32, 0.34, 0.3]
          cr = snow ? 0.93 : rock[0]
          cg = snow ? 0.95 : rock[1]
          cb = snow ? 0.97 : rock[2]
        } else if (ring.kind >= 2) {
          cr = 0.45; cg = 0.58; cb = 0.78
        } else {
          cr = 0.24 + t * 0.12; cg = 0.36 + t * 0.08; cb = 0.22
        }
        const skyR = 0.62, skyG = 0.72, skyB = 0.84
        const fade = aerial * 0.42
        const mix = (c, sky) => c * (1 - fade) + sky * fade
        cr = mix(cr, skyR) * light
        cg = mix(cg, skyG) * light
        cb = mix(cb, skyB) * light
        const shadow = 0.45 + 0.28 * (1 - aerial)
        col.push(cr * shadow, cg * shadow, cb * shadow, cr, cg, cb)
      }
      for (let i = 0; i < N; i++) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      geo.setIndex(idx)
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: false,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: ring.kind === 0,
        toneMapped: false
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.frustumCulled = false
      mesh.renderOrder = 2
      mesh.visible = false
      scene.add(mesh)
      bucket.meshes[region] = mesh
    }
    layers.push(bucket)
  }
  const treeN = 96
  const treePos = []
  const treeIdx = []
  for (let i = 0; i <= treeN; i++) {
    const a = (i / treeN) * Math.PI * 2
    const spike = 4 + Math.abs(Math.sin(a * 37)) * 11 + Math.abs(Math.sin(a * 13 + 1)) * 6
    const c0 = Math.cos(a)
    const s0 = Math.sin(a)
    treePos.push(c0 * 292, 1, s0 * 292, c0 * 318, spike, s0 * 318)
  }
  for (let i = 0; i < treeN; i++) {
    const a = i * 2
    treeIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const treeGeo = new THREE.BufferGeometry()
  treeGeo.setAttribute('position', new THREE.Float32BufferAttribute(treePos, 3))
  treeGeo.setIndex(treeIdx)
  const treeline = new THREE.Mesh(treeGeo, new THREE.MeshBasicMaterial({
    color: '#1d3328',
    fog: false,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false
  }))
  treeline.frustumCulled = false
  treeline.renderOrder = 2
  scene.add(treeline)
  const tmp = new THREE.Color()
  function update(weights, elev, hor, grd) {
    const night = Math.max(0, Math.min(1, (-elev + 0.04) / 0.3))
    const lift = 0.22 + (1 - night) * 0.78
    treeline.visible = weights.forest > 0.08
    treeline.material.opacity = Math.min(1, weights.forest)
    treeline.material.color.copy(grd).multiplyScalar(0.55 * lift + 0.15)
    const warm = Math.max(0, Math.min(1, (0.35 - elev) / 0.35))
    for (const layer of layers) {
      tmp.setRGB(lift, lift, lift)
      if (warm > 0.25) tmp.lerp(hor, warm * 0.28)
      for (const region of regions) {
        const mesh = layer.meshes[region]
        const w = weights[region] || 0
        mesh.visible = w > 0.05
        mesh.material.opacity = Math.min(1, w)
        mesh.material.color.copy(tmp)
      }
    }
    tmp.copy(hor)
  }
  return { update }
}
