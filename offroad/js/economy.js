// Money, fuel, jobs, and the two trucks. No rendering.
export const VEHICLES = {
  mule: {
    id: 'mule', name: 'Yard Mule', price: 0, mass: 1550,
    half: [1.02, 0.4, 2.2], color: 0xc24b24, dark: 0x1c2124, glass: 0x17303a,
    force: 3400, maxSpeed: 26, steer: 0.46, wheelR: 0.48,
    track: 0.95, wheelbase: 1.58, rest: 0.34, travel: 0.2, stiff: 36, grip: 1
  },
  scout: {
    id: 'scout', name: 'Ridge Scout', price: 850, mass: 920,
    half: [0.86, 0.32, 1.75], color: 0xd6a62e, dark: 0x24281c, glass: 0x1a3030,
    force: 2700, maxSpeed: 34, steer: 0.52, wheelR: 0.4,
    track: 0.8, wheelbase: 1.25, rest: 0.28, travel: 0.16, stiff: 32, grip: 0.78
  }
}
export const UPGRADES = {
  tires: { name: 'Deep-tread tires', max: 3, cost: [0, 180, 340, 560], blurb: 'More grip in mud, sand, and creek water.' },
  susp: { name: 'Long-travel suspension', max: 3, cost: [0, 200, 380, 600], blurb: 'Wheels reach further over rocks and ruts.' },
  engine: { name: 'Engine', max: 3, cost: [0, 240, 420, 680], blurb: 'Harder pull on the grades.' },
  winch: { name: 'Winch', max: 2, cost: [0, 160, 360], blurb: 'A longer, stronger tug when you are stuck.' }
}
export const JOBS = [
  { id: 'lookout', name: 'Ridge Watch', kind: 'reach', poi: 'lookout', pay: 170, text: 'Climb to the fire lookout and sign the book.' },
  { id: 'cabin', name: 'Cabin crate', kind: 'deliver', poi: 'cabin', pay: 290, text: 'Haul a supply crate out to Wren Cabin.' },
  { id: 'quarry', name: 'Quarry run', kind: 'deliver', poi: 'quarry', pay: 440, text: 'Ford Hollow Creek and drop the crate at Quarry Camp.' },
  { id: 'mill', name: 'Mill bearing', kind: 'reach', poi: 'mill', pay: 210, text: 'Find Crow Mill and log the old bearing.' }
]
export const TANK = 18
export const SAVE_KEY = 'oxbow_save_v1'

export function freshSave(partial) {
  return {
    v: 1,
    money: 90,
    fuel: TANK,
    vehicle: 'mule',
    owned: ['mule'],
    upgrades: { tires: 0, susp: 0, engine: 0, winch: 0 },
    discovered: ['yard'],
    done: [],
    active: null,
    x: 0, y: 0, z: -160,
    qw: 1, qx: 0, qy: 0, qz: 0,
    settings: { gfx: 'medium', tilt: false, sound: true, shake: true, time: 0.36 },
    ...partial
  }
}
export function upgradeCost(id, level) {
  const u = UPGRADES[id]
  if (!u || level < 0 || level >= u.max) return null
  return u.cost[level + 1]
}
export function buyUpgrade(save, id) {
  const level = save.upgrades[id]
  const cost = upgradeCost(id, level)
  if (cost == null || save.money < cost) return null
  const next = structuredClone(save)
  next.money -= cost
  next.upgrades[id] = level + 1
  return next
}
export function buyVehicle(save, id) {
  const v = VEHICLES[id]
  if (!save || !v || save.owned.includes(id) || save.money < v.price) return null
  const next = structuredClone(save)
  next.money -= v.price
  next.owned.push(id)
  next.vehicle = id
  return next
}
export function refuelQuote(fuel) {
  const missing = Math.max(0, TANK - fuel)
  return { missing, cost: Math.ceil(missing * 4) }
}
export function burnFuel(fuel, throttle, dt) {
  const burn = (0.025 + Math.max(0, throttle) * 0.085) * dt
  return Math.max(0, fuel - burn)
}
export function jobPay(save, job) {
  return save.done.includes(job.id) ? Math.round(job.pay * 0.5) : job.pay
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
