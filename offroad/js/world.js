// Oxbow terrain. Pure functions: hills, a creek, trails, and a surface grid.
export const OFFROAD_V1 = 1
export const WORLD_SIZE = 560
export const HALF = WORLD_SIZE / 2
export const SURF = { dirt: 0, trail: 1, mud: 2, sand: 3, rock: 4, water: 5 }
export const SURF_NAME = ['dirt', 'trail', 'mud', 'sand', 'rock', 'water']
// Wheel frictionSlip multipliers. Mud and water are deliberately slick.
export const FRICTION = [2.2, 3.15, 0.58, 1.02, 1.62, 0.4]
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
    { id: 'lookout', name: 'Fire Lookout', x: -16, z: 198, r: 14, kind: 'peak' }
  ]
  const ford = { x: 8, z: 0 }
  ford.z = riverZ(ford.x)
  const rocks = []
  for (let t = 0; t < 400 && rocks.length < 16; t++) {
    const x = (rng() * 2 - 1) * (HALF - 40)
    const z = (rng() * 2 - 1) * (HALF - 40)
    if (Math.abs(z - riverZ(x)) < 26) continue
    if (pois.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 8)) continue
    rocks.push({ x, z, rad: 5 + rng() * 6, h: 1.4 + rng() * 2.4 })
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
    for (const r of rocks) h += blob(x, z, r.x, r.z, r.rad, r.h)
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
      let s = SURF.dirt
      if (sl > 0.55) s = SURF.rock
      else if (rd < 11 && h < 2.65) s = SURF.water
      else if (rd < 20 && h < 5.2) s = SURF.mud
      else if (sl < 0.28 && h > 6 && h < 18 && wet < 0.42) s = SURF.sand
      surf[j * GRID + i] = s
    }
  }
  stampTrail()

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
      if (tr() < 0.38) continue
      trees.push({ x, z, s: 0.75 + tr() * 1.15, k: tr() < 0.55 ? 0 : 1, y: height(x, z) })
    }
  }

  return {
    seed, size: WORLD_SIZE, half: HALF, height, surface, pois, ford, rocks, trails, trees,
    gridN: GRID, heights, surf, riverZ
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
