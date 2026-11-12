// Procedural ridgelines. No third-party geometry. OFFROAD_V10_6
export function createRidges(THREE, scene) {
  const regions = ['forest', 'desert', 'mountain']
  const layers = []
  function ridgeHeight(region, kind, a) {
    const s = Math.sin(a * (2.4 + kind * 0.7) + kind)
    const s2 = Math.sin(a * (6.5 + kind) + 1.4)
    if (region === 'desert') {
      const mesa = Math.abs(Math.sin(a * (1.7 + kind * 0.35) + 0.4))
      const flat = mesa > 0.62 ? 1 : mesa / 0.62 * 0.28
      return (12 + kind * 7) + flat * (18 + kind * 16) + Math.abs(s2) * 3
    }
    if (region === 'mountain') {
      const peak = Math.pow(Math.abs(s), 0.38)
      return (16 + kind * 8) + peak * (36 + kind * 26) + Math.abs(s2) * (10 + kind * 4)
    }
    const roll = 0.5 + 0.5 * Math.sin(a * (3 + kind * 0.5) + 0.8)
    const peak = kind >= 2 ? Math.pow(Math.abs(Math.sin(a * 2.1 + 0.5)), 1.6) : 0
    return (10 + kind * 5) + roll * (14 + kind * 7) + peak * (26 + kind * 8)
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
        const snow = region === 'mountain' && ring.kind >= 2 && h > maxH * 0.68
        const shade = 0.62 + 0.38 * (h / maxH)
        const r = shade * (snow ? 0.92 : 0.78)
        const g = shade * (snow ? 0.94 : 0.84)
        const b = shade * (snow ? 1 : 0.9)
        col.push(r * 0.82, g * 0.86, b * 0.88, r, g, b)
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
    for (const layer of layers) {
      const aerial = grd.clone().lerp(hor, (layer.kind + 1) / 4.2)
      aerial.multiplyScalar(lift)
      for (const region of regions) {
        const mesh = layer.meshes[region]
        const w = weights[region] || 0
        mesh.visible = w > 0.05
        mesh.material.opacity = Math.min(1, w)
        mesh.material.color.copy(aerial)
      }
    }
    tmp.copy(hor)
  }
  return { update }
}
