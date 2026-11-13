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
  const rope = band(x, z, 84, -128, 8, 2.7) * 1.1
  const logs = band(x, z, 36, -116, 6, 1.35) * 0.5
  return Math.max(plank, trestle, rope, logs)
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
  return x > 8 && x < 102 && z < -86 && z > -160
}
export function snowMask(x, z) {
  const d = Math.hypot(x + 156, z - 198)
  if (d > 24) return 0
  return smooth(1 - d / 24)
}

const CELL = 0.32
const ruts = new Map()
const lastWheel = new Map()
let dirty = false
function key(x, z) {
  return Math.round(x / CELL) + ',' + Math.round(z / CELL)
}
export function rutDepth(x, z) {
  const cell = ruts.get(key(x, z))
  return cell ? cell.d : 0
}
function stamp(x, z, amount, surf) {
  const k = key(x, z)
  if (!ruts.has(k) && ruts.size >= 900) return
  const prev = ruts.get(k)
  const d = Math.min(0.2, (prev ? prev.d : 0) + amount)
  ruts.set(k, { d, s: surf })
  dirty = true
}
export function digRut(x, z, amount, surf, wheel) {
  const id = wheel == null ? 0 : wheel
  const prev = lastWheel.get(id)
  lastWheel.set(id, { x, z })
  const dist = prev ? Math.hypot(x - prev.x, z - prev.z) : 0
  const steps = Math.min(8, Math.max(1, Math.round(dist / CELL)))
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 1
    const px = prev ? prev.x + (x - prev.x) * t : x
    const pz = prev ? prev.z + (z - prev.z) * t : z
    stamp(px, pz, amount / steps, surf)
  }
}
export function rutCount() { return ruts.size }
export function rutNear(cx, cz, span) {
  const out = []
  const half = span * 0.5
  for (const [k, cell] of ruts) {
    const parts = k.split(',')
    const x = Number(parts[0]) * CELL
    const z = Number(parts[1]) * CELL
    if (Math.abs(x - cx) > half || Math.abs(z - cz) > half) continue
    out.push({ x, z, d: cell.d, s: cell.s })
  }
  return out
}
export function takeRutDirty() {
  const was = dirty
  dirty = false
  return was
}
const RUT_COLOR = {
  2: [28, 20, 14],
  3: [132, 102, 62],
  6: [78, 88, 98]
}
export function paintRuts(ctx, size, cx, cz, span) {
  const img = ctx.createImageData(size, size)
  const data = img.data
  const half = span * 0.5
  for (const [k, cell] of ruts) {
    const parts = k.split(',')
    const x = Number(parts[0]) * CELL
    const z = Number(parts[1]) * CELL
    const u = (x - (cx - half)) / span
    const v = (z - (cz - half)) / span
    if (u <= 0 || v <= 0 || u >= 1 || v >= 1) continue
    const px = (u * (size - 1)) | 0
    const py = ((1 - v) * (size - 1)) | 0
    const rgb = RUT_COLOR[cell.s] || RUT_COLOR[2]
    const a = Math.min(230, 70 + cell.d * 900)
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const ix = px + ox
        const iy = py + oy
        if (ix < 0 || iy < 0 || ix >= size || iy >= size) continue
        const o = (iy * size + ix) * 4
        const ink = ox === 0 && oy === 0 ? a : a * 0.4
        if (ink < data[o + 3]) continue
        data[o] = rgb[0]
        data[o + 1] = rgb[1]
        data[o + 2] = rgb[2]
        data[o + 3] = ink
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

function box(x, y, z, hx, hy, hz, mat, yaw, rx) {
  return { kind: 'box', x, y, z, hx, hy, hz, mat, yaw: yaw || 0, rx: rx || 0 }
}
function nail(x, y, z) {
  return { kind: 'decor', shape: 'bolt', x, y, z, hx: 0.035, hy: 0.02, hz: 0.035, yaw: 0, mat: 'steel' }
}

export const BOULDERS = [
  { model: 'boulder_01', x: 23.55, z: -102.7, yaw: 0.35, s: [1.05, 0.4, 1.05] },
  { model: 'rock_09', x: 20.42, z: -105.45, yaw: 1.1, s: [0.85, 0.09, 0.85] },
  { model: 'rock_07', x: 20.45, z: -102.45, yaw: 0.2, s: [0.7, 0.11, 0.7] },
  { model: 'rock_07', x: 23.7, z: -105.55, yaw: 2.0, s: [0.62, 0.1, 0.62] },
  { model: 'boulder_01', x: 16.4, z: -95.6, yaw: 0.7, s: [1.2, 0.48, 1.15] },
  { model: 'rock_07', x: 19.4, z: -93.8, yaw: 1.6, s: [0.95, 0.32, 0.95] },
  { model: 'rock_09', x: 14.1, z: -93.2, yaw: 0.4, s: [0.9, 0.22, 0.9] },
  { model: 'boulder_01', x: 22.6, z: -93.4, yaw: 2.4, s: [1.15, 0.55, 1.1] },
  { model: 'rock_07', x: 17.8, z: -91.2, yaw: 0.9, s: [0.8, 0.28, 0.8] }
]

export function courseFeatures(world) {
  const list = []
  const deck = world.height(36, -131.5) + 0.08
  for (let i = 0; i < 12; i++) {
    const x = 36 - 1.65 + i * 0.3
    list.push(box(x, deck, -128, 0.12, 0.045, 2.55, 'wood'))
    if (i % 2 === 0) {
      list.push(nail(x, deck + 0.07, -129.6))
      list.push(nail(x, deck + 0.07, -126.4))
    }
  }
  for (const x of [34.15, 37.85]) {
    list.push(box(x, deck + 0.16, -128, 0.06, 0.05, 2.55, 'wood'))
    for (const z of [-130.4, -128, -125.6]) list.push(box(x, deck + 0.42, z, 0.07, 0.32, 0.07, 'wood'))
  }
  const gy = world.height(36, -116)
  list.push({ kind: 'log', x: 36, y: gy + 0.3, z: -116.4, radius: 0.28, len: 5.4, axis: 'x', mat: 'wood' })
  list.push({ kind: 'log', x: 36, y: gy + 0.3, z: -115.6, radius: 0.28, len: 5.4, axis: 'x', mat: 'wood' })
  const ty = world.height(66, -132.8) + 0.12
  for (const x of [65.05, 66.95]) list.push(box(x, ty, -128, 0.1, 0.08, 3.35, 'steel'))
  for (let i = 0; i < 13; i++) list.push(box(66, ty + 0.1, -131.2 + i * 0.52, 1.2, 0.03, 0.09, 'wood'))
  for (const x of [64.55, 67.45]) {
    for (const z of [-131.2, -128, -124.8]) list.push(box(x, ty - 0.55, z, 0.07, 0.62, 0.07, 'steel'))
  }
  list.push(box(66, ty - 0.35, -128, 0.05, 0.55, 0.05, 'steel', 0, 0.7))
  list.push(box(66, ty - 0.35, -128, 0.05, 0.55, 0.05, 'steel', 0, -0.7))
  for (const x of [65.05, 66.95]) {
    for (const z of [-130.2, -125.8]) list.push(nail(x, ty + 0.16, z))
  }
  const fy = world.height(36, -150)
  list.push({ kind: 'log', x: 36, y: fy + 0.48, z: -150, radius: 0.42, len: 6.6, axis: 'x', mat: 'bark' })
  list.push(box(34.2, fy + 0.72, -149.2, 0.1, 0.08, 0.55, 'bark', 0.5))
  list.push(box(37.4, fy + 0.62, -150.6, 0.08, 0.08, 0.4, 'bark', -0.4))
  const ropeY = world.height(84, -132.5) + 0.2
  const z0 = -131.2
  const z1 = -124.8
  for (const z of [z0, z1]) {
    for (const x of [82.6, 85.4]) list.push(box(x, ropeY + 0.85, z, 0.1, 1.05, 0.1, 'wood'))
    list.push(box(84, ropeY + 1.85, z, 1.45, 0.06, 0.08, 'wood'))
  }
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9
    const z = z0 + (z1 - z0) * t
    const sag = Math.sin(t * Math.PI) * 0.16
    list.push({ kind: 'flex', i, x: 84, y: ropeY + 0.08 - sag, z, hx: 1.05, hy: 0.035, hz: 0.26, mat: 'wood' })
  }
  for (const rock of BOULDERS) {
    list.push({
      kind: 'boulder',
      model: rock.model,
      x: rock.x,
      z: rock.z,
      yaw: rock.yaw,
      s: rock.s,
      y: world.height(rock.x, rock.z)
    })
  }
  let seed = 21
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return (seed & 2147483646) / 2147483647
  }
  for (let i = 0; i < 42; i++) {
    const z = -160 + i * 2.6
    const side = i % 2 ? 1 : -1
    const x = side * (2.8 + rnd() * 2.2)
    if (world.surface(x, z) === 5) continue
    const y = world.height(x, z)
    if (i % 5 === 0) list.push({ kind: 'decor', shape: 'root', x, y: y + 0.03, z, hx: 0.7, hy: 0.04, hz: 0.12, yaw: rnd() * 1.4, mat: 'bark' })
    else if (i % 5 === 1) list.push({ kind: 'decor', shape: 'fern', x, y, z, yaw: rnd() * 6 })
    else list.push({ kind: 'decor', shape: 'stone', x, y: y + 0.05, z, hx: 0.1 + rnd() * 0.12, hy: 0.045, hz: 0.09 + rnd() * 0.08, yaw: rnd() * 3, mat: 'rock' })
  }
  return list
}
