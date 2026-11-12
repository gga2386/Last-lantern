// Oxbow terrain. Pure functions: hills, a creek, trails, and a surface grid.
export const OFFROAD_V1 = 1
export const WORLD_SIZE = 560
export const HALF = WORLD_SIZE / 2
export const SURF = { dirt: 0, trail: 1, mud: 2, sand: 3, rock: 4, water: 5 }
export const SURF_NAME = ['dirt', 'trail', 'mud', 'sand', 'rock', 'water']
// Wheel frictionSlip multipliers. Mud and water are deliberately slick.
export const FRICTION = [2.2, 3.15, 0.58, 1.02, 2.65, 0.4]
export const DRAG = [0.15, 0.1, 1.15, 0.7, 0.22, 2.2]

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash2(ix, iz, seed) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1440662683)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
function valueNoise(seed) {
  return function (x, z) {
    const x0 = Math.floor(x), z0 = Math.floor(z)
    const fx = x - x0, fz = z - z0
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz)
    const a = hash2(x0, z0, seed), b = hash2(x0 + 1, z0, seed)
    const c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed)
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
  }
}
function lerp(a, b, t) { return a + (b - a) * t }
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }
function blob(x, z, cx, cz, rad, amp) {
  const d = Math.hypot(x - cx, z - cz)
  if (d >= rad) return 0
  const u = 1 - d / rad
  return u * u * amp
}

export const LAKES = [
  { id: 'oasis', name: 'Red Oasis', x: 176, z: -118, r: 15, region: 'desert', bed: 5.4 },
  { id: 'alpine', name: 'Teal Lake', x: -118, z: 188, r: 20, region: 'mountain', bed: 4.2 }
]
export const REGION_NAME = { forest: 'Hollow Forest', desert: 'Red Wash', mountain: 'Granite Spine' }

export function lakeAt(x, z, pad = 0) {
  for (const l of LAKES) {
    const d = Math.hypot(x - l.x, z - l.z)
    if (d < l.r + pad) return { id: l.id, name: l.name, x: l.x, z: l.z, r: l.r, region: l.region, d }
  }
  return null
}
export function regionWeights(x, z) {
  const mtn = smooth((z - 88) / 78)
  const des = smooth((x - 18) / 95) * (1 - mtn * 0.92)
  const forest = Math.max(0, 1 - mtn - des)
  const sum = mtn + des + forest || 1
  return { forest: forest / sum, desert: des / sum, mountain: mtn / sum }
}
export function regionAt(x, z) {
  const w = regionWeights(x, z)
  let id = 'forest'
  if (w.desert >= w.forest && w.desert >= w.mountain) id = 'desert'
  if (w.mountain >= w.forest && w.mountain >= w.desert) id = 'mountain'
  return { id, name: REGION_NAME[id], w }
}

export function createWorld(seed = 1) {
  const n = valueNoise(seed)
  const rng = mulberry32(seed + 17)
  function riverZ(x) {
    return Math.sin(x * 0.009) * 38 + Math.sin(x * 0.02 + 1.1) * 14
  }
  const pois = [
    { id: 'yard', name: 'Oxbow Yard', x: 0, z: -168, r: 18, kind: 'yard' },
    { id: 'cabin', name: 'Wren Cabin', x: -168, z: -78, r: 13, kind: 'cabin' },
    { id: 'quarry', name: 'Quarry Camp', x: 168, z: 78, r: 13, kind: 'quarry' },
    { id: 'mill', name: 'Crow Mill', x: -78, z: 96, r: 12, kind: 'mill' },
    { id: 'lookout', name: 'Fire Lookout', x: -16, z: 198, r: 14, kind: 'peak' },
    { id: 'switchback', name: 'South Marker', x: 62, z: -208, r: 12, kind: 'view' },
    { id: 'cairn', name: 'Ash Cairn', x: 188, z: -36, r: 11, kind: 'hidden' },
    { id: 'storeyard', name: 'Yard Store', x: -16, z: -148, r: 14, kind: 'store' },
    { id: 'storewren', name: 'Wren Store', x: -142, z: -112, r: 12, kind: 'store' },
    { id: 'storequarry', name: 'Quarry Store', x: 148, z: 112, r: 12, kind: 'store' },
    { id: 'storeridge', name: 'Ridge Store', x: 96, z: 168, r: 12, kind: 'store' },
    { id: 'creekcamp', name: 'Creek Bend', x: 40, z: -32, r: 14, kind: 'camp' },
    { id: 'highcamp', name: 'Quarry Bench', x: 124, z: 138, r: 12, kind: 'camp' },
    { id: 'oasis', name: 'Red Oasis', x: 150, z: -100, r: 12, kind: 'camp' },
    { id: 'alpine', name: 'Teal Shore', x: -100, z: 172, r: 12, kind: 'camp' }
  ]
  for (const p of pois) p.region = regionAt(p.x, p.z).id
  const ford = { x: 8, z: 0 }
  ford.z = riverZ(ford.x)
  const rocks = []
  for (let t = 0; t < 900 && rocks.length < 26; t++) {
    const x = (rng() * 2 - 1) * (HALF - 40)
    const z = (rng() * 2 - 1) * (HALF - 40)
    if (Math.abs(z - riverZ(x)) < 26) continue
    if (lakeAt(x, z, 6)) continue
    if (pois.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 8)) continue
    const reg = regionAt(x, z).id
    if (reg === 'forest' && rng() < 0.62) continue
    const kind = reg === 'mountain' ? (rng() < 0.45 ? 2 : 0) : reg === 'desert' ? (rng() < 0.55 ? 1 : 0) : (rng() < 0.25 ? 1 : 0)
    rocks.push({ x, z, rad: 4.2 + rng() * 6.5, h: 1.3 + rng() * 2.8, kind, region: reg })
  }

  function terrain(x, z) {
    let h = (n(x * 0.0032, z * 0.0032) - 0.5) * 34
    h += (n(x * 0.0085, z * 0.0085) - 0.5) * 10
    h += (n(x * 0.02, z * 0.02) - 0.5) * 3.2
    h += (n(x * 0.055, z * 0.055) - 0.5) * 0.9
    h += blob(x, z, -16, 198, 96, 20)
    h += blob(x, z, 130, 170, 80, 12)
    h += blob(x, z, -190, -20, 70, 8)
    h -= blob(x, z, 196, 86, 16, 7)
    const rw = regionWeights(x, z)
    const bank = Math.abs(z - riverZ(x))
    if (bank > 26) {
      h += blob(x, z, 214, -96, 78, 12) * (0.45 + rw.desert)
      h += blob(x, z, 96, 36, 42, 7) * rw.desert
      h += (n(x * 0.011, z * 0.011) - 0.5) * 4.2 * rw.desert
      h += blob(x, z, -150, 210, 100, 22) * (0.55 + rw.mountain)
      h += blob(x, z, 30, 220, 76, 16) * rw.mountain
      h += blob(x, z, -150, -30, 86, 9) * rw.forest
      h += blob(x, z, -40, -120, 64, 6) * rw.forest
      h -= blob(x, z, 176, -118, 24, 5.5)
      h -= blob(x, z, -118, 188, 30, 7)
    }
    for (const r of rocks) h += blob(x, z, r.x, r.z, r.rad, r.h)
    const bowls = [[-118, 188, 36, 4.2], [176, -118, 24, 5.4]]
    for (const [cx, cz, rad, bed] of bowls) {
      const bd = Math.hypot(x - cx, z - cz)
      if (bd >= rad) continue
      const u = 1 - smooth(bd / (rad * 0.82))
      if (u > 0) h = lerp(h, bed, u)
    }
    const cz = riverZ(x)
    const d = Math.abs(z - cz)
    const reach = 22
    if (d < reach) {
      const bed = 1.15 + n(x * 0.03, 4.2) * 0.35
      const u = smooth(1 - d / reach)
      h = lerp(h, Math.min(h, bed), u)
    }
    const fd = Math.hypot(x - ford.x, z - ford.z)
    if (fd < 16 && d < 18) h = lerp(h, 2.15, smooth(1 - fd / 16) * smooth(1 - d / 16))
    const ax = Math.abs(x) - (HALF - 24)
    const az = Math.abs(z) - (HALF - 24)
    const e = Math.max(ax, 0) + Math.max(az, 0)
    if (e > 0) h += e * 1.35
    return h
  }

  function trace(a, b, steps) {
    const pts = []
    const dx = b.x - a.x, dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    const px = -dz / len, pz = dx / len
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const bow = Math.sin(t * Math.PI) * 14
      const x = a.x + dx * t + px * bow
      const z = a.z + dz * t + pz * bow
      pts.push({ x, z, h: terrain(x, z) })
    }
    for (let k = 0; k < 3; k++) {
      const cp = pts.map(p => p.h)
      for (let i = 1; i < pts.length - 1; i++) pts[i].h = cp[i - 1] * 0.25 + cp[i] * 0.5 + cp[i + 1] * 0.25
    }
    return pts
  }
  const yard = pois[0], cabin = pois[1], quarry = pois[2], mill = pois[3], look = pois[4]
  const trails = [
    trace(yard, cabin, 18),
    trace(yard, ford, 16).concat(trace(ford, quarry, 18).slice(1)),
    trace(ford, mill, 14).concat(trace(mill, look, 16).slice(1))
  ]
  function nearestTrail(x, z) {
    let bestD = 1e9, bestH = 0
    for (const trail of trails) {
      for (let i = 0; i < trail.length - 1; i++) {
        const a = trail[i], b = trail[i + 1]
        const dx = b.x - a.x, dz = b.z - a.z
        const l2 = dx * dx + dz * dz || 1
        let t = ((x - a.x) * dx + (z - a.z) * dz) / l2
        if (t < 0) t = 0
        else if (t > 1) t = 1
        const px = a.x + dx * t, pz = a.z + dz * t
        const d = Math.hypot(x - px, z - pz)
        if (d < bestD) { bestD = d; bestH = a.h + (b.h - a.h) * t }
      }
    }
    return { d: bestD, h: bestH }
  }
  for (const p of pois) p.y = terrain(p.x, p.z)

  function height(x, z) {
    let h = terrain(x, z)
    for (const p of pois) {
      const d = Math.hypot(x - p.x, z - p.z)
      if (d < p.r) h = lerp(h, p.y, smooth(1 - d / p.r) * 0.9)
    }
    const tr = nearestTrail(x, z)
    if (tr.d < 8) h = lerp(h, tr.h, smooth(1 - tr.d / 8) * 0.72)
    return h
  }

  const GRID = 256
  const surf = new Uint8Array(GRID * GRID)
  const heights = new Float32Array(GRID * GRID)
  function cellPos(i, j) {
    const x = -HALF + (i / (GRID - 1)) * WORLD_SIZE
    const z = HALF - (j / (GRID - 1)) * WORLD_SIZE
    return { x, z }
  }
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const { x, z } = cellPos(i, j)
      heights[j * GRID + i] = height(x, z)
    }
  }
  function stampTrail() {
    const r = 4.4
    for (const trail of trails) {
      for (let s = 0; s < trail.length - 1; s++) {
        const a = trail[s], b = trail[s + 1]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        const steps = Math.ceil(len)
        for (let k = 0; k <= steps; k++) {
          const t = k / steps
          const x = a.x + (b.x - a.x) * t
          const z = a.z + (b.z - a.z) * t
          const i0 = Math.round(((x + HALF) / WORLD_SIZE) * (GRID - 1))
          const j0 = Math.round(((HALF - z) / WORLD_SIZE) * (GRID - 1))
          const rad = Math.ceil(r / (WORLD_SIZE / GRID))
          for (let dj = -rad; dj <= rad; dj++) {
            for (let di = -rad; di <= rad; di++) {
              const i = i0 + di, j = j0 + dj
              if (i < 0 || j < 0 || i >= GRID || j >= GRID) continue
              const { x: wx, z: wz } = cellPos(i, j)
              if (Math.hypot(wx - x, wz - z) <= r) {
                if (surf[j * GRID + i] !== SURF.water) surf[j * GRID + i] = SURF.trail
              }
            }
          }
        }
      }
    }
  }
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const { x, z } = cellPos(i, j)
      const h = heights[j * GRID + i]
      const i1 = Math.min(GRID - 1, i + 1), j1 = Math.min(GRID - 1, j + 1)
      const dx = heights[j * GRID + i1] - h
      const dz = heights[j1 * GRID + i] - h
      const sl = Math.hypot(dx, dz) / (WORLD_SIZE / GRID)
      const rd = Math.abs(z - riverZ(x))
      const wet = n(x * 0.012, z * 0.012)
      const reg = regionAt(x, z)
      const lake = lakeAt(x, z)
      let s = SURF.dirt
      if (lake && lake.d < lake.r * 0.72) s = SURF.water
      else if (lake && lake.d < lake.r * 0.98) s = SURF.sand
      else if (sl > 0.55 || (reg.id === 'mountain' && sl > 0.42 && h > 12)) s = SURF.rock
      else if (rd < 11 && h < 2.65) s = SURF.water
      else if (rd < 20 && h < 5.2) s = SURF.mud
      else if (reg.id === 'desert' && sl < 0.42 && rd > 22 && h < 16 && wet < 0.72) s = SURF.sand
      else if (sl < 0.28 && h > 6 && h < 18 && wet < 0.42) s = SURF.sand
      surf[j * GRID + i] = s
    }
  }
  stampTrail()

  function mudDepth(x, z) {
    if (surface(x, z) !== SURF.mud) return 0
    const rd = Math.abs(z - riverZ(x))
    const t = Math.max(0, Math.min(1, (20 - rd) / 9))
    const wobble = n(x * 0.045, z * 0.045)
    return 0.06 + t * 0.72 + wobble * 0.18
  }
  function waterDepth(x, z) {
    if (surface(x, z) !== SURF.water) return 0
    const lake = lakeAt(x, z)
    if (lake) return 0.4 + Math.max(0, 1 - lake.d / (lake.r * 0.72)) * 1.75
    const fd = Math.hypot(x - ford.x, z - ford.z)
    if (fd < 18) return 0.22 + fd * 0.012
    const rd = Math.abs(z - riverZ(x))
    return 0.35 + (1 - Math.min(1, rd / 11)) * 1.45
  }
  function currentDir(x) {
    const dz = Math.cos(x * 0.009) * 0.342 + Math.cos(x * 0.02 + 1.1) * 0.28
    const len = Math.hypot(1, dz) || 1
    return { x: 1 / len, z: dz / len }
  }
  function surface(x, z) {
    let i = Math.round(((x + HALF) / WORLD_SIZE) * (GRID - 1))
    let j = Math.round(((HALF - z) / WORLD_SIZE) * (GRID - 1))
    if (i < 0) i = 0
    else if (i >= GRID) i = GRID - 1
    if (j < 0) j = 0
    else if (j >= GRID) j = GRID - 1
    return surf[j * GRID + i]
  }

  const trees = []
  const tr = mulberry32(seed + 99)
  const step = WORLD_SIZE / 42
  for (let j = 1; j < 41; j++) {
    for (let i = 1; i < 41; i++) {
      const x = -HALF + i * step + (tr() - 0.5) * step * 0.7
      const z = -HALF + j * step + (tr() - 0.5) * step * 0.7
      const s = surface(x, z)
      if (s === SURF.water || s === SURF.trail || s === SURF.rock) continue
      if (pois.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 6)) continue
      if (lakeAt(x, z, 4)) continue
      const reg = regionAt(x, z).id
      const y = height(x, z)
      let k = 0
      let scale = 0.75 + tr() * 1.15
      if (reg === 'desert') {
        if (tr() < 0.7) continue
        k = tr() < 0.62 ? 2 : 3
        scale = 0.7 + tr() * 0.7
      } else if (reg === 'mountain') {
        if (y > 18 || tr() < 0.48) continue
        k = tr() < 0.72 ? 0 : 1
        scale = 0.65 + tr() * 0.9
      } else if (tr() < 0.22) continue
      else k = tr() < 0.58 ? 0 : 1
      trees.push({ x, z, s: scale, k, y, region: reg })
    }
  }

  return {
    seed, size: WORLD_SIZE, half: HALF, height, surface, mudDepth, waterDepth, currentDir, pois, ford, rocks, trails, trees,
    gridN: GRID, heights, surf, riverZ, regionAt, blend: regionWeights, lakeAt, lakes: LAKES
  }
}

export function heightfieldData(world, n = 121) {
  const data = []
  const es = WORLD_SIZE / (n - 1)
  let min = Infinity, max = -Infinity
  for (let i = 0; i < n; i++) {
    const row = []
    const x = -HALF + i * es
    for (let j = 0; j < n; j++) {
      const z = HALF - j * es
      const h = world.height(x, z)
      if (h < min) min = h
      if (h > max) max = h
      row.push(h)
    }
    data.push(row)
  }
  return { data, elementSize: es, position: { x: -HALF, y: 0, z: HALF }, min, max }
}
