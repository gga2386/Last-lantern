// Authored rigs. GlTF shells, shared wheels, paint recolor. OFFROAD_V5
import { GLTFLoader } from '../vendor/GLTFLoader.js'

const STYLES = ['pickup', 'jeep', 'bronco', 'wagon', 'utility', 'van', 'crawler']
const templates = new Map()

export async function preloadRigs() {
  const loader = new GLTFLoader()
  await Promise.all(STYLES.map(async style => {
    const gltf = await loader.loadAsync('models/' + style + '.glb')
    templates.set(style, gltf.scene)
  }))
}

function paintOf(mat, liv, env) {
  if (!mat) return mat
  const name = mat.name || ''
  if (name === 'Paint' || name === 'Accent' || name === 'Chrome' || name === 'Glass' || name === 'Rim') {
    if (env) {
      mat.envMap = env
      mat.envMapIntensity = name === 'Glass' || name === 'Chrome' ? 1 : 0.65
    }
  }
  if (name === 'Paint' && liv) mat.color.set(liv.color)
  if (name === 'Accent' && liv) mat.color.set(liv.stripe)
  return mat
}

function wants(name, kind, rack) {
  if (name.startsWith('LOD_')) return false
  if (name.startsWith('Accent_')) return name.startsWith('Accent_' + kind)
  if (name.startsWith('Acc_jerry')) return !!rack.jerry
  if (name.startsWith('Acc_kayak')) return !!rack.kayak
  if (name.startsWith('Acc_bike')) return !!rack.bike
  if (name.startsWith('Acc_spare')) return !!rack.spare
  if (name.startsWith('Acc_rack')) return !!(rack.jerry || rack.kayak || rack.spare || rack.bike)
  return true
}

export function buildRig(THREE, spec, opts) {
  opts = opts || {}
  const src = templates.get(spec.style || 'pickup')
  if (!src) throw new Error('rig not loaded: ' + spec.style)
  const rack = Object.assign({ jerry: false, spare: false, kayak: false, bike: false }, opts.rack)
  const liv = (spec.liveries && spec.liveries[(opts.livery || 0) % spec.liveries.length]) || { color: '#b84322', stripe: '#f2e2c4', kind: 'stripe' }
  const kind = liv.kind || 'stripe'
  const group = src.clone(true)
  const lampMat = new THREE.MeshStandardMaterial({
    name: 'Lamp', color: 0xfff6df, emissive: 0xfff1c4, emissiveIntensity: 0.55, roughness: 0.2
  })
  const tailMat = new THREE.MeshStandardMaterial({
    name: 'Tail', color: 0x8a1a14, emissive: 0xff2a18, emissiveIntensity: 0.55, roughness: 0.35
  })
  const high = []
  const lod = []
  const detail = []
  group.traverse(o => {
    if (o.isMesh) {
      const list = Array.isArray(o.material) ? o.material : [o.material]
      const next = list.map(m => {
        const c = m.clone()
        if (c.name === 'Lamp') return lampMat
        if (c.name === 'Tail') return tailMat
        const painted = paintOf(c, liv, opts.env || null)
        if (painted && painted.name === 'Paint' && o.geometry && o.geometry.getAttribute('color')) painted.vertexColors = true
        return painted
      })
      o.material = Array.isArray(o.material) ? next : next[0]
      if (o.name === 'Body' && opts.shadow) o.castShadow = true
      if (o.name === 'LOD_Body') lod.push(o)
      else if (o.name === 'Body') high.push(o)
      else if (o.name && o.name.startsWith('Det_')) detail.push(o)
    }
    if (o.name && !wants(o.name, kind, rack)) o.visible = false
  })
  for (const m of lod) m.visible = false
  const wheels = []
  for (let i = 0; i < 4; i++) {
    const w = group.getObjectByName('Wheel' + i)
    if (!w) continue
    w.parent.remove(w)
    wheels.push(w)
  }
  const lamps = []
  const nose = spec.wheelbase + spec.wheelR * 0.8
  for (const s of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff4d4, 0, 40, 0.5, 0.42, 1)
    spot.position.set(s * spec.track * 0.42, 0.55, nose)
    const tgt = new THREE.Object3D()
    tgt.position.set(s * 0.15, -0.3, nose + 22)
    group.add(spot, tgt)
    spot.target = tgt
    if (opts.shadow) {
      spot.shadow.mapSize.set(256, 256)
      spot.shadow.camera.near = 0.4
      spot.shadow.camera.far = 48
      spot.shadow.bias = -0.001
    }
    lamps.push(spot)
  }
  group.userData = { lampMat, tailMat, lamps, high, lod, detail }
  return { group, wheels }
}

export function applyLod(group, far) {
  const ud = group && group.userData
  if (!ud || !ud.lod || !ud.lod.length) return
  for (const m of ud.high) m.visible = !far
  for (const m of ud.lod) m.visible = !!far
  if (ud.detail) for (const m of ud.detail) m.visible = !far
}
