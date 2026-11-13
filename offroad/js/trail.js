// Crawl line, soft-ground ruts, and the extra land the height function carves.
// Terrain Studio (the browser procedural editor, and the separate terrainstudio.org
// mesh tool) was not used. See CREDITS.md. These shapes stay in the same CPU
// height function the physics heightfield samples.

function smooth(t) {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}
function band(x, z, cx, cz, hx, hz) {
  const dx = Math.abs(x - cx) / hx
  const dz = Math.abs(z - cz) / hz
  if (dx >= 1 || dz >= 1) return 0
  return smooth(1 - dz) * smooth(1 - dx)
}

export function creekDrop(x, z) {
  const plank = band(x, z, 36, -128, 10, 2.55) * 1.05
  const trestle = band(x, z, 66, -128, 12, 3.35) * 1.2
  const logs = band(x, z, 36, -116, 6, 1.35) * 0.5
  return Math.max(plank, trestle, logs)
}
export function bogMask(x, z) {
  const d = Math.hypot(x - 52, z + 142)
  if (d > 10) return 0
  return smooth(1 - d / 10)
}
export function bogDrop(x, z) {
  return bogMask(x, z) * 0.55
}
export function hillAdd(x, z) {
  const dx = x - 36
  const dz = z + 100
  if (dz < -2 || dz > 16 || Math.abs(dx) > 7) return 0
  const t = (dz + 2) / 18
  const across = 1 - Math.min(1, Math.abs(dx) / 7)
  return t * t * 6.4 * across
}
export function duneAdd(x, z) {
  if (x < 100 || x > 165 || z > -40 || z < -120) return 0
  const wave = Math.sin(x * 0.4 + z * 0.05)
  const edgeX = smooth((x - 100) / 8) * smooth((165 - x) / 8)
  const edgeZ = smooth((z + 120) / 8) * smooth((-40 - z) / 8)
  return wave * 1.7 * edgeX * edgeZ
}
export function inCourse(x, z) {
  return x > 8 && x < 86 && z < -86 && z > -160
}
export function snowMask(x, z) {
  const d = Math.hypot(x + 156, z - 198)
  if (d > 24) return 0
  return smooth(1 - d / 24)
}

const CELL = 0.4
const ruts = new Map()
let dirty = false
function key(x, z) {
  return Math.round(x / CELL) + ',' + Math.round(z / CELL)
}
export function rutDepth(x, z) {
  return ruts.get(key(x, z)) || 0
}
export function digRut(x, z, amount) {
  const k = key(x, z)
  if (!ruts.has(k) && ruts.size >= 520) return 0
  const next = Math.min(0.18, (ruts.get(k) || 0) + amount)
  ruts.set(k, next)
  dirty = true
  return next
}
export function rutCount() { return ruts.size }
export function takeRutDirty() {
  const was = dirty
  dirty = false
  return was
}
export function paintRuts(ctx, size, cx, cz, span) {
  const img = ctx.createImageData(size, size)
  const data = img.data
  const half = span * 0.5
  for (const [k, depth] of ruts) {
    const parts = k.split(',')
    const x = Number(parts[0]) * CELL
    const z = Number(parts[1]) * CELL
    const u = (x - (cx - half)) / span
    const v = (z - (cz - half)) / span
    if (u <= 0 || v <= 0 || u >= 1 || v >= 1) continue
    const px = (u * (size - 1)) | 0
    const py = ((1 - v) * (size - 1)) | 0
    const a = Math.min(200, 50 + depth * 860)
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const ix = px + ox
        const iy = py + oy
        if (ix < 0 || iy < 0 || ix >= size || iy >= size) continue
        const o = (iy * size + ix) * 4
        data[o] = 36
        data[o + 1] = 28
        data[o + 2] = 20
        data[o + 3] = Math.max(data[o + 3], ox === 0 && oy === 0 ? a : a * 0.45)
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

function box(x, y, z, hx, hy, hz, mat, yaw) {
  return { kind: 'box', x, y, z, hx, hy, hz, mat, yaw: yaw || 0 }
}
function ledge(world, x, z, yaw) {
  return {
    kind: 'steps',
    x, z, yaw,
    y: world.height(x, z),
    mat: 'rock',
    parts: [
      { x: 0, y: 0.26, z: 0, hx: 1.15, hy: 0.26, hz: 0.9 },
      { x: 0.32, y: 0.58, z: 0.06, hx: 0.62, hy: 0.16, hz: 0.52 },
      { x: -0.18, y: 0.86, z: -0.04, hx: 0.38, hy: 0.14, hz: 0.34 }
    ]
  }
}

export function courseFeatures(world) {
  const list = []
  const deck = world.height(36, -131.5) + 0.08
  for (let i = 0; i < 7; i++) {
    list.push(box(36 - 1.44 + i * 0.48, deck, -128, 0.2, 0.055, 2.45, 'wood'))
  }
  for (const x of [34.05, 37.95]) {
    for (const z of [-130.35, -125.65]) list.push(box(x, deck + 0.38, z, 0.08, 0.36, 0.08, 'wood'))
  }
  const gy = world.height(36, -116)
  list.push({ kind: 'log', x: 36, y: gy + 0.3, z: -116.4, radius: 0.28, len: 5.4, axis: 'x', mat: 'wood' })
  list.push({ kind: 'log', x: 36, y: gy + 0.3, z: -115.6, radius: 0.28, len: 5.4, axis: 'x', mat: 'wood' })
  const ty = world.height(66, -132.8) + 0.1
  for (const x of [65.15, 66.85]) list.push(box(x, ty, -128, 0.16, 0.07, 3.2, 'steel'))
  for (let i = 0; i < 9; i++) {
    list.push(box(66, ty + 0.1, -131 + i * 0.75, 1.15, 0.035, 0.16, 'wood'))
  }
  for (const x of [64.7, 67.3]) {
    for (const z of [-131.1, -124.9]) list.push(box(x, ty - 0.45, z, 0.08, 0.5, 0.08, 'steel'))
  }
  const fy = world.height(36, -150)
  list.push({ kind: 'log', x: 36, y: fy + 0.48, z: -150, radius: 0.42, len: 6.6, axis: 'x', mat: 'bark' })
  list.push(box(34.2, fy + 0.72, -149.2, 0.1, 0.08, 0.55, 'bark', 0.5))
  list.push(box(37.4, fy + 0.62, -150.6, 0.08, 0.08, 0.4, 'bark', -0.4))
  const garden = [[20, -104, 0.4], [23.2, -101.5, 1.1], [18.4, -100.2, 2.2], [25.6, -103.4, 0.8], [21.5, -98.6, 1.7]]
  for (const [x, z, yaw] of garden) list.push(ledge(world, x, z, yaw))
  let seed = 21
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return (seed & 2147483646) / 2147483647
  }
  for (let i = 0; i < 28; i++) {
    const z = -158 + i * 3.6
    const side = i % 2 ? 1 : -1
    const x = side * (3.1 + rnd() * 1.6)
    if (world.surface(x, z) === 5) continue
    const y = world.height(x, z)
    if (i % 4 === 0) list.push({ kind: 'decor', shape: 'root', x, y: y + 0.03, z, hx: 0.55, hy: 0.035, hz: 0.1, yaw: rnd() * 1.4, mat: 'bark' })
    else list.push({ kind: 'decor', shape: 'stone', x, y: y + 0.06, z, hx: 0.12 + rnd() * 0.1, hy: 0.05, hz: 0.1 + rnd() * 0.08, yaw: rnd() * 3, mat: 'rock' })
  }
  return list
}
