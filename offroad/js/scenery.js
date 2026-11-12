// Quaternius nature kit, instanced by region. OFFROAD_V10_7
// Each mesh piece keeps its own material. Indexed pines are wood plus leaves;
// merging them onto the trunk material turned the canopy into white shards.
import { GLTFLoader } from '../vendor/GLTFLoader.js'

const FILES = {
  pine: ['qn_PineTree_1', 'qn_PineTree_2', 'qn_PineTree_4'],
  snow: ['qn_PineTree_Snow_1', 'qn_PineTree_Snow_2'],
  broad: ['qn_CommonTree_1', 'qn_CommonTree_3', 'qn_BirchTree_1', 'qn_BirchTree_2'],
  dead: ['qn_CommonTree_Dead_1', 'qn_BirchTree_Dead_1'],
  cactus: ['qn_Cactus_1', 'qn_Cactus_2', 'qn_Cactus_4', 'qn_CactusFlowers_2'],
  scrub: ['qn_Bush_2', 'qn_Plant_1'],
  bush: ['qn_Bush_1'],
  grass: ['qn_Grass'],
  flower: ['qn_Flowers'],
  rock: ['qn_Rock_1', 'qn_Rock_2', 'qn_Rock_3', 'qn_Rock_5'],
  rockMoss: ['qn_Rock_Moss_1'],
  rockSnow: ['qn_Rock_Snow_1']
}

function expand(geo) {
  const src = geo.index ? geo.toNonIndexed() : geo
  const g = src.clone()
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  return g
}

function fitParts(THREE, parts, kind) {
  const box = new THREE.Box3()
  parts.forEach(p => {
    p.geometry.computeBoundingBox()
    box.union(p.geometry.boundingBox)
  })
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const tall = Math.max(0.05, size.y)
  const wide = Math.max(size.x, size.z, 0.05)
  let s = 1
  if (kind.startsWith('rock')) s = 1 / Math.max(wide, tall)
  else if (kind === 'grass' || kind === 'flower') s = 0.7 / tall
  else if (kind === 'scrub' || kind === 'bush') s = 1.4 / tall
  else s = 5.2 / tall
  parts.forEach(p => {
    p.geometry.translate(-center.x, -box.min.y, -center.z)
    p.geometry.scale(s, s, s)
    p.geometry.computeBoundingSphere()
  })
  return parts
}

async function loadOne(THREE, loader, file, kind) {
  const gltf = await loader.loadAsync('models/scenery/' + file + '.glb')
  gltf.scene.updateMatrixWorld(true)
  const parts = []
  gltf.scene.traverse(o => {
    if (!o.isMesh) return
    const g = expand(o.geometry)
    g.applyMatrix4(o.matrixWorld)
    const material = o.material && o.material.clone ? o.material.clone() : o.material
    if (material) {
      material.vertexColors = false
      material.side = THREE.FrontSide
    }
    parts.push({ geometry: g, material })
  })
  if (!parts.length) return null
  return { parts: fitParts(THREE, parts, kind) }
}

export async function preloadScenery(THREE) {
  const loader = new GLTFLoader()
  const out = {}
  const jobs = []
  for (const [kind, files] of Object.entries(FILES)) {
    out[kind] = []
    files.forEach(file => {
      jobs.push(loadOne(THREE, loader, file, kind).then(item => { if (item) out[kind].push(item) }))
    })
  }
  await Promise.all(jobs)
  return out
}

export async function preloadGround(THREE) {
  const loader = new THREE.TextureLoader()
  const names = ['forest', 'sand', 'reddirt', 'mud', 'gravel']
  const tex = {}
  await Promise.all(names.map(async name => {
    const color = await loader.loadAsync('textures/' + name + '_color.jpg')
    const normal = await loader.loadAsync('textures/' + name + '_normal.jpg')
    const rough = await loader.loadAsync('textures/' + name + '_rough.jpg')
    for (const t of [color, normal, rough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(48, 48)
      t.anisotropy = 4
    }
    color.colorSpace = THREE.SRGBColorSpace
    tex[name] = { color, normal, rough }
  }))
  return tex
}
