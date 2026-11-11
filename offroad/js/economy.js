// Reputation, adventures, fuel, and the two trucks. No cash. OFFROAD_V2 OFFROAD_V3
export const OFFROAD_V2 = 1
export const OFFROAD_V3 = 1
export const VEHICLES = {
  mule: {
    id: 'mule', name: 'Yard Mule', need: 0, mass: 1550,
    half: [1.02, 0.4, 2.2], color: 0xb84322, dark: 0x1b2126, glass: 0x9ec9d4, mud: 0x4a3828,
    force: 3400, maxSpeed: 26, steer: 0.46, wheelR: 0.48,
    track: 0.95, wheelbase: 1.58, rest: 0.34, travel: 0.2, stiff: 36, grip: 1
  },
  scout: {
    id: 'scout', name: 'Ridge Scout', need: 160, mass: 920,
    half: [0.9, 0.34, 1.72], color: 0xd6a21f, dark: 0x24281c, glass: 0xb7ddd4, mud: 0x3e3424,
    force: 2700, maxSpeed: 34, steer: 0.52, wheelR: 0.4,
    track: 0.82, wheelbase: 1.22, rest: 0.28, travel: 0.16, stiff: 32, grip: 0.78
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
  winch: { name: 'Winch', max: 2, need: [40, 200], blurb: 'A longer tug when you are stuck.' }
}
// Extra gallons stacked on the 18 gal stock tank. Bought at a general store.
export const AUX = { name: 'Auxiliary tank', max: 3, need: [40, 120, 240], add: [4, 4, 6], blurb: 'A bigger tank for the long rides between stores.' }
// Carryable cans. Each holds 5 gal and can be poured anywhere.
export const JERRY = { name: 'Jerry can', need: [40, 120, 220], gallons: 5, blurb: 'Five gallons you can pour from the cab, anywhere.' }
export const TANK = 18
export const SAVE_KEY = 'oxbow_save_v1'
export const ADVENTURES = [
  {
    id: 'south', name: 'South Marker', diff: 'Easy', rep: 25, bonus: 'clean', bonusRep: 8,
    text: 'The yard wants proof you can find the south marker before the light goes.',
    steps: [{ kind: 'reach', poi: 'switchback', text: 'Reach the south marker' }]
  },
  {
    id: 'nightwatch', name: 'Night Watch', diff: 'Medium', rep: 45, bonus: 'clean', bonusRep: 12,
    text: 'The fire lookout only counts if you sign the book after dusk.',
    steps: [{ kind: 'night', poi: 'lookout', text: 'Reach the Fire Lookout at night' }]
  },
  {
    id: 'ford', name: 'Ford to the Mill', diff: 'Medium', rep: 50, bonus: 'clean', bonusRep: 12,
    text: 'Cross Hollow Creek, then check the old bearing at Crow Mill.',
    steps: [
      { kind: 'ford', text: 'Ford the creek' },
      { kind: 'reach', poi: 'mill', text: 'Reach Crow Mill' }
    ]
  },
  {
    id: 'quarry', name: 'Quarry Climb', diff: 'Hard', rep: 60, bonus: 'timed', bonusRep: 20, limit: 110,
    text: 'The quarry road is a climb. They time it from the moment you take the slip.',
    steps: [{ kind: 'reach', poi: 'quarry', text: 'Reach Quarry Camp' }]
  },
  {
    id: 'cairn', name: 'Ash Cairn', diff: 'Easy', rep: 30, bonus: 'clean', bonusRep: 10,
    text: 'A stone pile sits off the trail. Nobody has logged it this season.',
    steps: [{ kind: 'reach', poi: 'cairn', text: 'Find Ash Cairn' }]
  },
  {
    id: 'trout', name: 'Mill Trout', diff: 'Medium', rep: 35, bonus: 'clean', bonusRep: 8,
    text: 'The mill pool holds trout. Bring a rod and a little patience.',
    steps: [{ kind: 'catch', fish: 'trout', poi: 'mill', text: 'Catch a trout near Crow Mill' }]
  },
  {
    id: 'overnight', name: 'Lookout Night', diff: 'Medium', rep: 40, bonus: 'clean', bonusRep: 10,
    text: 'Pitch camp under the fire lookout and stay until morning.',
    steps: [
      { kind: 'reach', poi: 'lookout', text: 'Reach the Fire Lookout' },
      { kind: 'camp', poi: 'lookout', text: 'Set camp at the lookout' },
      { kind: 'morning', text: 'Rest until morning' }
    ]
  },
  {
    id: 'loop', name: 'Basin Loop', diff: 'Hard', rep: 70, bonus: 'clean', bonusRep: 18,
    text: 'Ride the whole basin: Wren Cabin, Crow Mill, the lookout, then home.',
    steps: [
      { kind: 'reach', poi: 'cabin', text: 'Reach Wren Cabin' },
      { kind: 'reach', poi: 'mill', text: 'Reach Crow Mill' },
      { kind: 'reach', poi: 'lookout', text: 'Reach the Fire Lookout' },
      { kind: 'reach', poi: 'yard', text: 'Return to Oxbow Yard' }
    ]
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
    v: 3,
    rep: 0,
    fuel: TANK,
    aux: 0,
    jerry: 0,
    vehicle: 'mule',
    owned: ['mule'],
    upgrades: { tires: 0, susp: 0, engine: 0, winch: 0 },
    discovered: ['yard'],
    cleared: {},
    active: null,
    lights: 'auto',
    highbeam: false,
    x: 0, y: 0, z: -160,
    qw: 1, qx: 0, qy: 0, qz: 0,
    clock: 0.42,
    camp: { tent: 0, pit: 0, chairs: 0, lights: 0, rod: 0, hunt: 0 },
    pantry: { trout: 0, fish: 0, meat: 0, salt: 0, oil: 0 },
    log: { fish: {}, photos: {} },
    respawn: null,
    buff: null,
    settings: { gfx: 'medium', tilt: false, sound: true, shake: true, cycle: 8 },
    ...partial
  }
}
export function coerceSave(raw, gfx) {
  if (!raw || !raw.upgrades) return null
  const base = freshSave({ settings: { gfx: gfx || 'medium', tilt: false, sound: true, shake: true, cycle: 8 } })
  if (raw.v === 2) {
    const s = Object.assign(base, raw)
    s.v = 3
    s.camp = Object.assign({ tent: 0, pit: 0, chairs: 0, lights: 0, rod: 0, hunt: 0 }, raw.camp || {})
    s.pantry = Object.assign({ trout: 0, fish: 0, meat: 0, salt: 0, oil: 0 }, raw.pantry || {})
    s.log = raw.log || { fish: {}, photos: {} }
    s.upgrades = Object.assign({ tires: 0, susp: 0, engine: 0, winch: 0 }, raw.upgrades)
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
  s.upgrades = Object.assign({ tires: 0, susp: 0, engine: 0, winch: 0 }, raw.upgrades)
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
  return {
    ...base,
    force: base.force * (1 + 0.22 * e),
    maxSpeed: base.maxSpeed * (1 + 0.06 * e),
    grip: base.grip * (1 + 0.2 * t),
    rest: base.rest + 0.035 * s,
    travel: base.travel + 0.055 * s,
    stiff: base.stiff * (1 - 0.07 * s),
    winch: 650 + w * 1700
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
