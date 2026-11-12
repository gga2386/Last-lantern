// Procedural ridgelines. No third-party geometry. OFFROAD_V10_7
export function createRidges(THREE, scene) {
  const regions = ['forest', 'desert', 'mountain']
  const layers = []
  function ridgeHeight(region, kind, a) {
    const s = Math.sin(a * (2.2 + kind * 0.55) + kind * 1.7)
    const s2 = Math.sin(a * (5.4 + kind * 1.3) + 0.6)
    const s3 = Math.sin(a * (13 + kind) + 2.1)
    if (region === 'desert') {
      const tooth = Math.abs(s)
      const broken = tooth > 0.72 ? 0.35 : tooth > 0.28 ? 1 : 0.45
      return (14 + kind * 10) + broken * (20 + kind * 18) + Math.abs(s2) * (8 + kind * 4) + Math.abs(s3) * 4
    }
    if (region === 'mountain') {
      const peak = Math.pow(Math.abs(s), 0.32)
      const notch = Math.abs(s3) > 0.82 ? 0.45 : 1
      return (18 + kind * 12) + peak * notch * (48 + kind * 28) + Math.abs(s2) * (12 + kind * 6)
    }
    const roll = 0.5 + 0.5 * Math.sin(a * (2.6 + kind * 0.4) + 0.4)
    const peak = kind >= 2 ? Math.pow(Math.abs(Math.sin(a * 1.8 + 0.9)), 1.35) : Math.abs(s2) * 0.25
    return (12 + kind * 8) + roll * (16 + kind * 10) + peak * (34 + kind * 16)
  }
  const rings = [
    { inner: 310, outer: 400, base: 2, kind: 0 },
    { inner: 400, outer: 520, base: 6, kind: 1 },
    { inner: 520, outer: 660, base: 10, kind: 2 },
    { inner: 660, outer: 840, base: 14, kind: 3 }
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
        let cr, cg, cb
        if (region === 'desert') {
          const band = Math.floor(h / 7) % 3
          const strata = band === 0 ? [0.72, 0.34, 0.2] : band === 1 ? [0.86, 0.55, 0.32] : [0.48, 0.22, 0.14]
          cr = strata[0]; cg = strata[1]; cb = strata[2]
        } else if (region === 'mountain') {
          const snow = ring.kind >= 1 && h > maxH * 0.72
          cr = snow ? 0.93 : 0.55
          cg = snow ? 0.95 : 0.58
          cb = snow ? 0.98 : 0.62
        } else {
          cr = 0.28; cg = 0.42; cb = 0.32
        }
        const skyR = 0.62, skyG = 0.74, skyB = 0.88
        const fade = aerial * 0.78
        const mix = (c, sky) => c * (1 - fade) + sky * fade
        cr = mix(cr, skyR) * light
        cg = mix(cg, skyG) * light
        cb = mix(cb, skyB) * light
        const shadow = 0.62 + 0.2 * (1 - aerial)
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
      tmp.setRGB(1, 1, 1).lerp(hor, 0.18 + layer.kind * 0.08)
      if (warm > 0.2) tmp.lerp(hor, warm * 0.45)
      tmp.multiplyScalar(lift)
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
