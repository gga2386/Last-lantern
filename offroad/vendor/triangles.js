import { BufferGeometry, BufferAttribute } from './three.module.js'
export function toTrianglesDrawMode(geometry, drawMode) {
  const index = geometry.getIndex()
  if (!index) return geometry
  const out = []
  for (let i = 0; i < index.count - 2; i++) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2)
    if (i % 2 === 0) out.push(a, b, c)
    else out.push(a, c, b)
  }
  const geo = geometry.clone()
  geo.setIndex(new BufferAttribute(new Uint32Array(out), 1))
  return geo
}
