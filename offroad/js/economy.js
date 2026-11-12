// Reputation, adventures, fuel, and the rigs. No cash. OFFROAD_V5
export const OFFROAD_V2 = 1
export const OFFROAD_V3 = 1
export const OFFROAD_V4 = 1
export const OFFROAD_V4_1 = 1
export const OFFROAD_V5 = 1
export const OFFROAD_V5_1 = 1
export const OFFROAD_V6 = 1
export const OFFROAD_V7 = 1
export const OFFROAD_V7_1 = 1
export const OFFROAD_V7_2 = 1
export const OFFROAD_V7_3 = 1
export const OFFROAD_V8 = 1
export const OFFROAD_V9 = 1
export const OFFROAD_V10 = 1
export const OFFROAD_V10_1 = 1
export const OFFROAD_V10_2 = 1
export const OFFROAD_V10_3 = 1
export const OFFROAD_V10_4 = 1
export const OFFROAD_V10_5 = 1
export const OFFROAD_V10_6 = 1
export const OFFROAD_V10_7 = 1
export const OFFROAD_V10_8 = 1
export const OFFROAD_V10_9 = 1
export const OFFROAD_V10_10 = 1
export const OFFROAD_V10_11 = 1
export const OFFROAD_V10_12 = 1
export const OFFROAD_V10_13 = 1
export const OFFROAD_V10_14 = 1
export const REGION_OPEN = { forest: 0, desert: 40, mountain: 120 }
export function regionUnlocked(save, id) {
  return (save.rep || 0) >= (REGION_OPEN[id] || 0)
}
export function crawlAngles(spec) {
  const wb = Math.max(0.8, spec.wheelbase || 1.5)
  const nose = Math.max(0.28, (spec.half ? spec.half[2] : wb * 0.72) - wb * 0.5)
  const clear = Math.max(0.12, spec.clearance || 0.2)
  const rad = spec.wheelR || 0.45
  const approach = Math.atan2(clear + rad * 0.35, nose) * 180 / Math.PI
  const departure = Math.atan2(clear + rad * 0.28, nose * 1.08) * 180 / Math.PI
  const breakover = 2 * Math.atan2(2 * clear, wb) * 180 / Math.PI
  return { approach: Math.round(approach), departure: Math.round(departure), breakover: Math.round(breakover) }
}
export const VEHICLES = {
  mule: {
    id: 'mule', name: 'Yard Mule', need: 0, style: 'pickup', mass: 1580,
    half: [1.02, 0.42, 2.25], dark: 0x1b2126, glass: 0x9ec9d4,
    force: 4800, maxSpeed: 5.36, steer: 0.30, wheelR: 0.50,
    track: 0.94, wheelbase: 1.65, axleF: 1.65, axleR: 1.65,
    axles: [[0.94, 0.44, 1.65], [-0.94, 0.44, 1.65], [0.94, 0.44, -1.65], [-0.94, 0.44, -1.65]],
    rest: 0.34, travel: 0.28, stiff: 28, grip: 1, visualDrop: -0.83, bodyNudge: -0.23, wheelScale: 1.14,
    paint: { body: '#6ea4c4', accent: '#e7e1d6', wheel: '#2a2a2a', cage: '#e4e4e4', mud: 0.05, repaint: false },
    liveries: [
      { color: '#b84322', stripe: '#f2e2c4', kind: 'stripe', name: 'Yard rust' },
      { color: '#e8e4dc', stripe: '#2a2a2a', kind: 'thick', name: 'Salt' },
      { color: '#2f4a34', stripe: '#c4a06a', kind: 'wood', name: 'Woodline' }
    ]
  },
  scout: {
    id: 'scout', name: 'Ridge Scout', need: 80, style: 'jeep', mass: 900,
    half: [0.86, 0.34, 1.55], dark: 0x24281c, glass: 0xb7ddd4,
    force: 3200, maxSpeed: 7.60, steer: 0.38, wheelR: 0.415,
    track: 0.69, wheelbase: 1.29, axleF: 1.29, axleR: 1.29,
    axles: [[0.694, 0.415, 1.29], [-0.693, 0.415, 1.29], [0.693, 0.415, -1.29], [-0.693, 0.415, -1.29]],
    rest: 0.3, travel: 0.26, stiff: 24, grip: 0.76, visualDrop: -0.86, bodyNudge: -0.11, wheelScale: 1,
    paint: { body: '#2f6fbe', accent: '#1c1c1c', wheel: '#2a2a2a', cage: '#d8d8d8', mud: 0, repaint: false },
    liveries: [
      { color: '#d6a21f', stripe: '#1c1c1c', kind: 'stripe', name: 'Scout gold' },
      { color: '#c4552e', stripe: '#f4efe6', kind: 'stripe', name: 'Signal' },
      { color: '#2c4a32', stripe: '#d8c07a', kind: 'thick', name: 'Brush' }
    ]
  },
  runner: {
    id: 'runner', name: 'Bluff Runner', need: 120, style: 'bronco', mass: 1420,
    half: [1.0, 0.4, 1.9], dark: 0x1a2430, glass: 0x9fd0e0,
    force: 4600, maxSpeed: 6.26, steer: 0.32, wheelR: 0.447,
    track: 0.85, wheelbase: 1.46, axleF: 1.474, axleR: 1.451,
    axles: [[0.854, 0.447, 1.474], [-0.854, 0.447, 1.474], [0.854, 0.447, -1.451], [-0.854, 0.447, -1.451]],
    rest: 0.32, travel: 0.3, stiff: 26, grip: 0.96, visualDrop: -0.92, wheelScale: 1,
    paint: { body: '#f4f1ea', accent: '#6d6758', wheel: '#2a2a2a', cage: '#d8d8d8', mud: 0.34, repaint: true },
    liveries: [
      { color: '#2f6fbe', stripe: '#f4efe6', kind: 'thick', name: 'Creek blue' },
      { color: '#e8e4dc', stripe: '#2f6fbe', kind: 'stripe', name: 'Two-tone' },
      { color: '#8a3a28', stripe: '#e8c07a', kind: 'chevron', name: 'Sunset' }
    ]
  },
  wagon: {
    id: 'wagon', name: 'Creek Wagon', need: 180, style: 'wagon', mass: 1760,
    half: [1.05, 0.44, 2.35], dark: 0x2a241c, glass: 0xc5ddd4,
    force: 4400, maxSpeed: 4.92, steer: 0.26, wheelR: 0.39,
    track: 0.75, wheelbase: 1.3, axleF: 1.3, axleR: 1.3,
    axles: [[0.75, 0.398, 1.3], [-0.75, 0.398, 1.3], [0.75, 0.398, -1.3], [-0.75, 0.398, -1.3]],
    rest: 0.3, travel: 0.26, stiff: 30, grip: 1.08, visualDrop: -0.95, bodyNudge: -0.38, wheelScale: 1,
    paint: { body: '#2f4a34', accent: '#6a4a32', wheel: '#2c2c2c', cage: '#d8d8d8', mud: 0.08, repaint: true },
    liveries: [
      { color: '#e6e2d8', stripe: '#6a4a32', kind: 'wood', name: 'Timber' },
      { color: '#2a4a38', stripe: '#c4a06a', kind: 'wood', name: 'Lodge' },
      { color: '#d7d2c8', stripe: '#8a3a28', kind: 'thick', name: 'Mud white' }
    ]
  },
  hauler: {
    id: 'hauler', name: 'Basin Hauler', need: 240, style: 'utility', mass: 1680,
    half: [1.0, 0.42, 2.05], dark: 0x1c2420, glass: 0xb7c8c4,
    force: 5600, maxSpeed: 4.47, steer: 0.28, wheelR: 0.41,
    track: 0.74, wheelbase: 1.61, axleF: 1.61, axleR: 1.61,
    axles: [[0.74, 0.409, 1.61], [-0.74, 0.409, 1.61], [0.74, 0.409, -1.61], [-0.74, 0.409, -1.61]],
    rest: 0.36, travel: 0.32, stiff: 26, grip: 1.16, visualDrop: -1.02, bodyNudge: -0.22, wheelScale: 1.05,
    paint: { body: '#f7f4ee', accent: '#2a2a2a', wheel: '#c8c8c8', cage: '#d8d8d8', mud: 0.04, repaint: true },
    liveries: [
      { color: '#5d7c92', stripe: '#e4e0d4', kind: 'stripe', name: 'Crew blue' },
      { color: '#f4f1ea', stripe: '#2a2a2a', kind: 'thick', name: 'Bed white' },
      { color: '#3a4a44', stripe: '#d8c07a', kind: 'stripe', name: 'Field' }
    ]
  },
  crawler: {
    id: 'crawler', name: 'Spine Crawler', need: 260, style: 'crawler', mass: 1180,
    half: [1.05, 0.42, 1.7], dark: 0x1a1c22, glass: 0x9ec9d4,
    force: 5400, maxSpeed: 4.15, steer: 0.34, wheelR: 0.57,
    track: 1.58, wheelbase: 1.37, axleF: 1.349, axleR: 1.387,
    axles: [[1.575, 0.76, 1.349], [-1.575, 0.76, 1.349], [1.575, 0.76, -1.387], [-1.575, 0.76, -1.387]],
    rest: 0.42, travel: 0.38, stiff: 20, grip: 1.22, visualDrop: -1.28, wheelScale: 0.62,
    paint: { body: '#d21f1a', accent: '#1a1a1a', wheel: '#e6e6e6', cage: '#1a1a1a', mud: 0.06, repaint: true },
    liveries: [
      { color: '#d21f1a', stripe: '#111111', kind: 'stripe', name: 'Cage red' },
      { color: '#f4f1ea', stripe: '#1a1a1a', kind: 'thick', name: 'Bone' },
      { color: '#1c1c1c', stripe: '#d21f1a', kind: 'stripe', name: 'Night' }
    ]
  },
  van: {
    id: 'van', name: 'Lantern Van', need: 320, style: 'van', mass: 1920,
    half: [1.02, 0.55, 2.45], dark: 0x1a1c22, glass: 0x8fb4c8,
    force: 4000, maxSpeed: 3.80, steer: 0.22, wheelR: 0.379,
    track: 0.73, wheelbase: 1.18, axleF: 1.169, axleR: 1.184,
    axles: [[0.724, 0.379, 1.169], [-0.729, 0.379, 1.169], [0.724, 0.379, -1.184], [-0.729, 0.379, -1.184]],
    rest: 0.3, travel: 0.24, stiff: 32, grip: 0.9, visualDrop: -0.9, wheelScale: 1,
    paint: { body: '#f7f4ee', accent: '#e25a22', wheel: '#1a1a1a', cage: '#f4f1ea', mud: 0.02, repaint: true },
    liveries: [
      { color: '#f7f4ee', stripe: '#e25a22', kind: 'chevron', name: 'Retro' },
      { color: '#f7f4ee', stripe: '#2f6fbe', kind: 'thick', name: 'Coast' },
      { color: '#f2efe6', stripe: '#2a2a2a', kind: 'stripe', name: 'Plain' }
    ]
  }
}
export const RANKS = [
  { name: 'Rookie', rep: 0 },
  { name: 'Creek Hand', rep: 40 },
  { name: 'Ridge Driver', rep: 120 },
  { name: 'Hollow Hauler', rep: 220 },
  { name: 'Basin Legend', rep: 340 }
]
export const UPGRADES = {
  tires: { name: 'Deep-tread tires', max: 3, need: [40, 120, 220], blurb: 'More grip in mud, sand, and the creek.' },
  susp: { name: 'Long-travel suspension', max: 3, need: [40, 140, 240], blurb: 'Wheels reach further over rocks and ruts.' },
  engine: { name: 'Engine', max: 3, need: [80, 160, 300], blurb: 'Harder pull on the grades.' },
  winch: { name: 'Winch', max: 2, need: [40, 200], blurb: 'A longer tug when you are stuck.' },
  snorkel: { name: 'Snorkel', max: 1, need: [80], blurb: 'Raises the air intake so a deeper ford does not stall the engine.' }
}
// Extra gallons stacked on the 18 gal stock tank. Bought at a general store.
export const AUX = { name: 'Auxiliary tank', max: 3, need: [40, 120, 240], add: [4, 4, 6], blurb: 'A bigger tank for the long rides between stores.' }
// Carryable cans. Each holds 5 gal and can be poured anywhere.
export const JERRY = { name: 'Jerry can', need: [40, 120, 220], gallons: 5, blurb: 'Five gallons you can pour from the cab, anywhere.' }
export const TANK = 18
export const SAVE_KEY = 'oxbow_save_v1'
export const ADVENTURES = [
  {
    id: 'south', name: 'South Marker', diff: 'Easy', rep: 25, region: 'forest', bonus: 'clean', bonusRep: 8,
    text: 'The yard wants proof you can find the south marker before the light goes.',
    steps: [{ kind: 'reach', poi: 'switchback', text: 'Reach the south marker' }]
  },
  {
    id: 'nightwatch', name: 'Night Watch', diff: 'Medium', rep: 45, region: 'mountain', bonus: 'clean', bonusRep: 12,
    text: 'The fire lookout only counts if you sign the book after dusk.',
    steps: [{ kind: 'night', poi: 'lookout', text: 'Reach the Fire Lookout at night' }]
  },
  {
    id: 'ford', name: 'Ford to the Mill', diff: 'Medium', rep: 50, region: 'forest', bonus: 'clean', bonusRep: 12,
    text: 'Cross Hollow Creek, then check the old bearing at Crow Mill.',
    steps: [
      { kind: 'ford', text: 'Ford the creek' },
      { kind: 'reach', poi: 'mill', text: 'Reach Crow Mill' }
    ]
  },
  {
    id: 'quarry', name: 'Quarry Climb', diff: 'Hard', rep: 60, region: 'desert', bonus: 'timed', bonusRep: 20, limit: 240,
    text: 'The quarry road is a climb. A careful crawl still makes the time.',
    steps: [{ kind: 'reach', poi: 'quarry', text: 'Reach Quarry Camp' }]
  },
  {
    id: 'cairn', name: 'Ash Cairn', diff: 'Easy', rep: 30, region: 'desert', bonus: 'clean', bonusRep: 10,
    text: 'A stone pile sits off the trail. Nobody has logged it this season.',
    steps: [{ kind: 'reach', poi: 'cairn', text: 'Find Ash Cairn' }]
  },
  {
    id: 'trout', name: 'Mill Trout', diff: 'Medium', rep: 35, region: 'forest', bonus: 'clean', bonusRep: 8,
    text: 'The mill pool holds trout. Bring a rod and a little patience.',
    steps: [{ kind: 'catch', fish: 'trout', poi: 'mill', text: 'Catch a trout near Crow Mill' }]
  },
  {
    id: 'overnight', name: 'Lookout Night', diff: 'Medium', rep: 40, region: 'mountain', bonus: 'clean', bonusRep: 10,
    text: 'Pitch camp under the fire lookout and stay until morning.',
    steps: [
      { kind: 'reach', poi: 'lookout', text: 'Reach the Fire Lookout' },
      { kind: 'camp', poi: 'lookout', text: 'Set camp at the lookout' },
      { kind: 'morning', text: 'Rest until morning' }
    ]
  },
  {
    id: 'loop', name: 'Basin Loop', diff: 'Hard', rep: 70, region: 'mountain', bonus: 'clean', bonusRep: 18,
    text: 'Ride the whole basin: Wren Cabin, Crow Mill, the lookout, then home.',
    steps: [
      { kind: 'reach', poi: 'cabin', text: 'Reach Wren Cabin' },
      { kind: 'reach', poi: 'mill', text: 'Reach Crow Mill' },
      { kind: 'reach', poi: 'lookout', text: 'Reach the Fire Lookout' },
      { kind: 'reach', poi: 'yard', text: 'Return to Oxbow Yard' }
    ]
  },
  {
    id: 'oasis', name: 'Red Oasis', diff: 'Easy', rep: 40, region: 'desert', bonus: 'clean', bonusRep: 10,
    text: 'The wash hides a pool. Sign the cairn book at the oasis camp.',
    steps: [{ kind: 'reach', poi: 'oasis', text: 'Reach Red Oasis' }]
  },
  {
    id: 'alpine', name: 'Teal Lake', diff: 'Hard', rep: 80, region: 'mountain', bonus: 'clean', bonusRep: 16,
    text: 'Climb to the alpine water. The shore is the only flat ground up there.',
    steps: [{ kind: 'reach', poi: 'alpine', text: 'Reach Teal Shore' }]
  }
]

export function rankFor(rep) {
  let r = RANKS[0]
  for (const x of RANKS) if (rep >= x.rep) r = x
  return r
}
export function tankCapacity(save) {
  const adds = [0, 4, 8, 14]
  return TANK + (adds[save.aux || 0] || 0)
}
export function jerrySlots(rep) {
  let n = 0
  for (const need of JERRY.need) if (rep >= need) n++
  return n
}
export function isDark(clock) {
  const h = ((clock % 1) + 1) % 1 * 24
  return h < 6.5 || h >= 17.5
}
export function clockLabel(clock) {
  const mins = Math.floor((((clock % 1) + 1) % 1) * 24 * 60) % (24 * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const phase = h < 5 || h >= 20 ? 'Night' : h < 8 ? 'Dawn' : h < 17 ? 'Day' : 'Dusk'
  return { h, m, text: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'), phase }
}
export function freshSave(partial) {
  return {
    v: 10,
    rep: 0,
    fuel: TANK,
    aux: 0,
    jerry: 0,
    vehicle: 'mule',
    owned: ['mule'],
    upgrades: { tires: 0, susp: 0, engine: 0, winch: 0, snorkel: 0 },
    discovered: ['yard'],
    cleared: {},
    active: null,
    lights: 'auto',
    highbeam: false,
    x: 0, y: 0, z: -160,
    qw: 1, qx: 0, qy: 0, qz: 0,
    clock: 0.42,
    camp: { tent: 0, pit: 0, chairs: 0, lights: 0, rod: 0, hunt: 0 },
    pantry: { trout: 0, fish: 0, meat: 0, salt: 0, oil: 0, chocolate: 0, crackers: 0 },
    roastStamp: '',
    log: { fish: {}, photos: {} },
    respawn: null,
    buff: null,
    cosmetics: {},
    settings: { gfx: 'medium', tilt: false, sound: true, shake: true, cycle: 8 },
    ...partial
  }
}
export function coerceSave(raw, gfx) {
  if (!raw || !raw.upgrades) return null
  const base = freshSave({ settings: { gfx: gfx || 'medium', tilt: false, sound: true, shake: true, cycle: 8 } })
  if ((raw.v || 0) >= 2) {
    const s = Object.assign(base, raw)
    s.v = 10
    s.cosmetics = raw.cosmetics || {}
    s.camp = Object.assign({ tent: 0, pit: 0, chairs: 0, lights: 0, rod: 0, hunt: 0 }, raw.camp || {})
    // v9 rooftop (tent 2 of 2) stays the top shell. A new run buys the four-person dome at 2, then the roof at 3.
    if ((raw.v || 0) < 10 && s.camp.tent >= 2) s.camp.tent = 3
    s.pantry = Object.assign({ trout: 0, fish: 0, meat: 0, salt: 0, oil: 0, chocolate: 0, crackers: 0 }, raw.pantry || {})
    s.roastStamp = raw.roastStamp || ''
    s.log = raw.log || { fish: {}, photos: {} }
    s.upgrades = Object.assign({ tires: 0, susp: 0, engine: 0, winch: 0, snorkel: 0 }, raw.upgrades)
    s.settings = Object.assign(base.settings, raw.settings || {})
    s.cleared = raw.cleared || {}
    s.owned = raw.owned && raw.owned.length ? raw.owned.slice() : ['mule']
    if (!s.owned.includes('mule')) s.owned.unshift('mule')
    delete s.money
    return s
  }
  // v1 jobs and cash become reputation. Fitted upgrades stay fitted.
  const s = base
  s.fuel = Math.min(TANK, raw.fuel != null ? raw.fuel : TANK)
  s.vehicle = raw.vehicle === 'scout' ? 'scout' : 'mule'
  s.owned = Array.isArray(raw.owned) ? raw.owned.slice() : ['mule']
  if (s.vehicle === 'scout' && !s.owned.includes('scout')) s.owned.push('scout')
  s.upgrades = Object.assign({ tires: 0, susp: 0, engine: 0, winch: 0, snorkel: 0 }, raw.upgrades)
  s.discovered = Array.isArray(raw.discovered) ? raw.discovered.slice() : ['yard']
  s.x = raw.x; s.y = raw.y; s.z = raw.z
  s.qx = raw.qx; s.qy = raw.qy; s.qz = raw.qz; s.qw = raw.qw
  if (raw.settings) {
    s.settings.gfx = raw.settings.gfx || s.settings.gfx
    s.settings.tilt = !!raw.settings.tilt
    s.settings.sound = raw.settings.sound !== false
    s.settings.shake = raw.settings.shake !== false
    if (typeof raw.settings.time === 'number') s.clock = raw.settings.time
  }
  const map = { lookout: 'nightwatch', cabin: 'south', quarry: 'quarry', mill: 'ford' }
  let rep = 0
  for (const id of raw.done || []) {
    const nid = map[id]
    const adv = ADVENTURES.find(a => a.id === nid)
    if (!adv || s.cleared[nid]) continue
    s.cleared[nid] = { stars: 1 }
    rep += adv.rep
  }
  s.rep = rep
  return s
}
export function noteAssist(save) {
  if (save && save.active) save.active.resets = (save.active.resets || 0) + 1
  return save && save.active ? save.active.resets : 0
}
function clone(save) { return structuredClone(save) }
export function upgradeNeed(id, level) {
  const u = UPGRADES[id]
  if (!u || level < 0 || level >= u.max) return null
  return u.need[level]
}
export function buyUpgrade(save, id) {
  const level = save.upgrades[id] || 0
  const need = upgradeNeed(id, level)
  if (need == null || save.rep < need) return null
  const next = clone(save)
  next.upgrades[id] = level + 1
  return next
}
export function buyVehicle(save, id) {
  const v = VEHICLES[id]
  if (!save || !v || save.owned.includes(id) || save.rep < v.need) return null
  const next = clone(save)
  next.owned.push(id)
  next.vehicle = id
  return next
}
export function buyAux(save) {
  const level = save.aux || 0
  if (level >= AUX.max || save.rep < AUX.need[level]) return null
  const next = clone(save)
  next.aux = level + 1
  next.fuel = Math.min(tankCapacity(next), next.fuel)
  return next
}
export function buyJerry(save) {
  const slots = jerrySlots(save.rep)
  if ((save.jerry || 0) >= slots) return null
  const next = clone(save)
  next.jerry = (next.jerry || 0) + 1
  return next
}
export function useJerry(save) {
  if (!save.jerry) return null
  const next = clone(save)
  next.jerry -= 1
  next.fuel = Math.min(tankCapacity(next), next.fuel + JERRY.gallons)
  return next
}
export function refuel(save) {
  const next = clone(save)
  next.fuel = tankCapacity(next)
  return next
}
export function burnFuel(fuel, throttle, dt) {
  const burn = (0.025 + Math.max(0, throttle) * 0.085) * dt
  return Math.max(0, fuel - burn)
}
export function specWithUpgrades(id, upgrades) {
  const base = VEHICLES[id] || VEHICLES.mule
  const t = upgrades.tires || 0, s = upgrades.susp || 0, e = upgrades.engine || 0, w = upgrades.winch || 0
  const lift = [0, 0.04, 0.08, 0.12][Math.min(3, Math.max(0, s))] || 0
  return {
    ...base,
    force: base.force * (1 + 0.26 * e),
    maxSpeed: base.maxSpeed * (1 + 0.04 * e),
    grip: base.grip * (1 + 0.2 * t),
    rest: base.rest + lift,
    travel: base.travel + 0.055 * s,
    stiff: base.stiff * (1 - 0.07 * s),
    winch: 650 + w * 1700,
    clearance: 0.16 + base.wheelR * 0.2 + lift,
    wade: 0.48 + base.wheelR * 0.35 + ((base.style === 'jeep' || base.style === 'utility' || base.style === 'pickup' || base.style === 'crawler') ? 0.28 : 0) + (upgrades.snorkel ? 0.38 : 0),
    bogAt: 0.22 + base.wheelR * 0.72 + s * 0.06 + t * 0.05
  }
}
export function tickAdventure(save, q) {
  if (!save.active) return null
  const adv = ADVENTURES.find(a => a.id === save.active.id)
  if (!adv) return null
  save.active.elapsed += q.dt || 0
  const step = adv.steps[save.active.step]
  let hit = false
  if (step.kind === 'ford') hit = Math.hypot(q.x - q.ford.x, q.z - q.ford.z) < 14 && q.water
  else if (step.kind === 'catch') {
    const poi = q.pois[step.poi]
    hit = q.catch === step.fish && !!poi && Math.hypot(q.x - poi.x, q.z - poi.z) < 46
  } else if (step.kind === 'camp') {
    const poi = q.pois[step.poi]
    hit = !!q.camped && !!poi && Math.hypot(q.x - poi.x, q.z - poi.z) < (poi.r || 12) + 8
  } else if (step.kind === 'morning') hit = q.rested === 'morning'
  else {
    const poi = q.pois[step.poi]
    if (!poi) return null
    hit = Math.hypot(q.x - poi.x, q.z - poi.z) < (poi.r || 12) && Math.abs(q.speed) < 7
    if (hit && step.kind === 'night' && !isDark(q.clock)) return { wait: 'night', step }
  }
  if (!hit) return { step }
  if (save.active.step < adv.steps.length - 1) {
    save.active.step++
    return { advanced: true, step: adv.steps[save.active.step] }
  }
  const clean = (save.active.resets || 0) === 0
  const timed = save.active.elapsed < (adv.limit || 1e9)
  const first = !save.cleared[adv.id]
  let gain = first ? adv.rep : Math.round(adv.rep * 0.5)
  if (save.buff && save.buff.rep) { gain += save.buff.rep; save.buff.rep = 0 }
  let stars = 1
  if (adv.bonus === 'clean' && clean) { gain += adv.bonusRep; stars = 2 }
  if (adv.bonus === 'timed' && timed) { gain += adv.bonusRep; stars = Math.max(stars, 2) }
  if (adv.bonus === 'timed' && timed && clean) stars = 3
  const prev = save.cleared[adv.id] && save.cleared[adv.id].stars || 0
  save.rep += gain
  save.cleared[adv.id] = { stars: Math.max(prev, stars) }
  save.active = null
  return { done: true, gain, stars, adv }
}
