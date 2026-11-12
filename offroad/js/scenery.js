// CC0 scenery meshes (Kenney nature kit). Instanced, so the count stays the same.
import { GLTFLoader } from '../vendor/GLTFLoader.js'

const FILES = {
  pine: 'models/scenery/pine.glb',
  oak: 'models/scenery/oak.glb',
  palm: 'models/scenery/palm.glb',
  cactus: 'models/scenery/cactus.glb',
  bush: 'models/scenery/bush.glb',
  grass: 'models/scenery/grass.glb',
  rock_a: 'models/scenery/rock_a.glb',
  rock_b: 'models/scenery/rock_b.glb',
  rock_c: 'models/scenery/rock_c.glb'
}

function prepare(THREE, geo, kind) {
  const g = geo.clone()
  g.computeBoundingBox()
  const bb = g.boundingBox
  const size = new THREE.Vector3()
  bb.getSize(size)
  const center = new THREE.Vector3()
  bb.getCenter(center)
  g.translate(-center.x, -bb.min.y, -center.z)
  const tall = Math.max(0.05, size.y)
  const wide = Math.max(size.x, size.y, size.z, 0.05)
  let s = 1
  if (kind.startsWith('rock')) s = 1 / wide
  else if (kind === 'grass') s = 0.7 / tall
  else if (kind === 'bush') s = 1.3 / tall
  else s = 4.2 / tall
  g.scale(s, s, s)
  g.computeVertexNormals()
  return g
}

export async function preloadScenery(THREE) {
  const loader = new GLTFLoader()
  const out = {}
  await Promise.all(Object.entries(FILES).map(async ([key, url]) => {
    const gltf = await loader.loadAsync(url)
    let mesh = null
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse(o => {
      if (!mesh && o.isMesh) mesh = o
    })
    if (!mesh) return
    const baked = mesh.geometry.clone()
    baked.applyMatrix4(mesh.matrixWorld)
    out[key] = { geometry: prepare(THREE, baked, key), material: mesh.material }
  }))
  return out
}
