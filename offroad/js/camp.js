// Camping rules, fish, fair-chase hunting, and the cook fire. OFFROAD_V3
export const CAMP = {
  tent: { name: 'Tent', max: 2, need: [80, 200], labels: ['Pup tent', 'Cabin tent', 'Rooftop tent'], blurb: 'A pup tent to start. A cabin tent, then one that rides on the roof.' },
  pit: { name: 'Fire', max: 2, need: [40, 140], labels: ['Stone ring', 'Fire pit', 'Cooking grill'], blurb: 'A better pit, then a grill that makes the sweet spot easier.' },
  chairs: { name: 'Camp chairs', max: 1, need: [40], labels: ['None', 'Two chairs'], blurb: 'Somewhere to sit while the basin goes quiet.' },
  lights: { name: 'Lantern lights', max: 1, need: [80], labels: ['None', 'String lights'], blurb: 'A line of lanterns over the camp.' },
  rod: { name: 'Fishing rod', max: 3, need: [40, 120, 220], labels: ['No rod', 'Cane pole', 'Spinning reel', 'Fly rod'], blurb: 'Each rod waits less and forgives a sloppy reel.' },
  hunt: { name: 'Field kit', max: 3, need: [40, 140, 240], labels: ['No kit', 'Pocket camera', 'Field camera', 'Hunting bow'], blurb: 'Photos first. The bow is a fair shot and brings meat.' }
}
export const FISH = [
  { id: 'chub', name: 'Creek chub', min: 14, max: 24 },
  { id: 'perch', name: 'Hollow perch', min: 18, max: 34 },
  { id: 'trout', name: 'Mill trout', min: 28, max: 48, mill: 1 },
  { id: 'cat', name: 'Night catfish', min: 32, max: 62, night: 1, rod: 2 },
  { id: 'char', name: 'Golden char', min: 36, max: 54, rare: 1, rod: 2 },
  { id: 'pup', name: 'Oasis pupfish', min: 8, max: 16, region: 'desert' },
  { id: 'grayling', name: 'Alpine grayling', min: 24, max: 42, region: 'mountain' }
]
export const GAME = [
  { id: 'rabbit', name: 'Rabbit', speed: 0.55, size: 0.09 },
  { id: 'turkey', name: 'Turkey', speed: 0.34, size: 0.13 },
  { id: 'deer', name: 'Deer', speed: 0.2, size: 0.2 }
]
export const GAME_BY_REGION = {
  forest: GAME,
  desert: [
    { id: 'jack', name: 'Jackrabbit', speed: 0.7, size: 0.08 },
    { id: 'quail', name: 'Quail', speed: 0.4, size: 0.1 }
  ],
  mountain: [
    { id: 'goat', name: 'Mountain goat', speed: 0.28, size: 0.16 },
    { id: 'deer', name: 'Deer', speed: 0.22, size: 0.2 }
  ]
}
export const RECIPES = [
  { id: 'trout', name: 'Trout on a stick', need: { trout: 1 }, buff: 'grip', blurb: 'Steadier tires for a few minutes.' },
  { id: 'pan', name: 'Salted pan fish', need: { fish: 1, salt: 1 }, buff: 'rep', blurb: 'The next adventure pays 5 extra reputation.' },
  { id: 'stew', name: 'Camp stew', need: { meat: 1, salt: 1 }, buff: 'grip', blurb: 'A full bowl. Grip stays kinder for a while.' },
  { id: 'breakfast', name: 'Skillet breakfast', need: { meat: 1, oil: 1 }, buff: 'fuel', blurb: 'The engine sips less fuel for a spell.' }
]
export function campLevel(save, id) { return (save.camp && save.camp[id]) || 0 }
export function campNeed(id, level) {
  const g = CAMP[id]
  if (!g || level < 0 || level >= g.max) return null
  return g.need[level]
}
export function buyCamp(save, id) {
  const level = campLevel(save, id)
  const need = campNeed(id, level)
  if (need == null || save.rep < need) return null
  const next = structuredClone(save)
  next.camp[id] = level + 1
  return next
}
export function slopeAt(world, x, z) {
  const e = 2.2
  const h = world.height(x, z)
  return Math.max(
    Math.abs(world.height(x + e, z) - h),
    Math.abs(world.height(x - e, z) - h),
    Math.abs(world.height(x, z + e) - h),
    Math.abs(world.height(x, z - e) - h)
  ) / (e * 2)
}
export function campSpot(world, x, z) {
  for (const p of world.pois) {
    const marked = p.kind === 'camp' || p.id === 'lookout' || p.id === 'mill' || p.id === 'switchback' || p.id === 'cairn'
    if (marked && Math.hypot(p.x - x, p.z - z) < (p.r || 12) + 4) return p
  }
  return null
}
export function canPitch(world, x, z, upright, speed) {
  if (upright < 0.72 || Math.abs(speed) > 1.6) return false
  if (world.surface(x, z) === 5) return false
  if (campSpot(world, x, z)) return true
  return slopeAt(world, x, z) < 0.18
}
export function nearWater(world, x, z) {
  if (world.lakeAt && world.lakeAt(x, z, 24)) return true
  const mill = world.pois.find(p => p.id === 'mill')
  if (mill && Math.hypot(x - mill.x, z - mill.z) < 48) return true
  return Math.abs(z - world.riverZ(x)) < 26 || Math.hypot(x - world.ford.x, z - world.ford.z) < 22
}
export function habitat(world, x, z) {
  const reg = world.regionAt ? world.regionAt(x, z) : { id: 'forest' }
  if (reg.id === 'mountain' && world.height(x, z) > 20) return { ok: false, reason: 'Above the wildlife line' }
  if (reg.id === 'desert') {
    const oasis = world.lakeAt && world.lakeAt(x, z, 48)
    if (!oasis && world.surface(x, z) === 4) return { ok: false, reason: 'No wildlife on the slickrock' }
  }
  return { ok: true, reason: '' }
}
export function activityState(world, x, z, save) {
  const camp = (save && save.camp) || {}
  const pantry = (save && save.pantry) || {}
  const water = nearWater(world, x, z)
  const rod = camp.rod || 0
  const kit = camp.hunt || 0
  const home = habitat(world, x, z)
  const cook = RECIPES.some(r => canCook(pantry, r))
  return {
    fish: { ok: !!(water && rod), reason: !water ? 'Needs water nearby' : !rod ? 'Needs a rod' : '' },
    hunt: { ok: !!(home.ok && kit), reason: !home.ok ? home.reason : !kit ? 'Needs a field kit' : '' },
    cook: { ok: cook, reason: cook ? '' : 'Needs ingredients' }
  }
}
export function gameFor(region) {
  return GAME_BY_REGION[region] || GAME
}
export function rollFish(world, x, z, clock, rod, rng) {
  const mill = world.pois.find(p => p.id === 'mill')
  const nearMill = mill && (Math.hypot(x - mill.x, z - mill.z) < 46 || Math.hypot(x - world.ford.x, z - world.ford.z) < 30)
  const region = world.regionAt ? world.regionAt(x, z).id : 'forest'
  const dark = ((clock % 1 + 1) % 1) * 24
  const night = dark < 6.5 || dark >= 17.5
  const pool = FISH.filter(f => {
    if (f.region && f.region !== region) return false
    if (!f.region && region !== 'forest' && f.mill) return false
    if (f.mill && !nearMill) return false
    if (f.night && !night) return false
    if (f.rod && rod < f.rod) return false
    if (f.rare && rng() > 0.06 + rod * 0.03) return false
    return true
  })
  const f = pool[Math.floor(rng() * pool.length)] || FISH[0]
  const size = f.min + rng() * (f.max - f.min) * (0.65 + rod * 0.12)
  return { id: f.id, name: f.name, cm: Math.round(size) }
}
export function reelBand(rod) { return 0.16 + rod * 0.05 }
export function biteSeconds(rod) { return 0.65 + rod * 0.16 }
export function aimHit(aim, animalX, size, kit) {
  const window = size * (0.85 + kit * 0.28)
  const hit = Math.abs(aim - animalX) < window
  return { hit, photo: hit && kit >= 1, meat: hit && kit >= 3 }
}
export function canCook(pantry, recipe) {
  return Object.keys(recipe.need).every(k => (pantry[k] || 0) >= recipe.need[k])
}
export function cookJudge(t, pit) {
  const width = 0.09 + (pit || 0) * 0.04
  const d = Math.abs(t - 0.66)
  if (d < width * 0.42) return 'perfect'
  if (d < width) return 'cooked'
  return 'burnt'
}
export function applyCook(save, recipe, grade) {
  if (grade === 'burnt') return { save, grade, text: 'Burnt. The fire kept the meal.' }
  const next = structuredClone(save)
  for (const k in recipe.need) next.pantry[k] -= recipe.need[k]
  next.buff = next.buff || { left: 0, grip: 1, fuel: 1, rep: 0 }
  next.buff.left = Math.max(next.buff.left || 0, 150)
  if (recipe.buff === 'grip') next.buff.grip = grade === 'perfect' ? 1.12 : 1.08
  if (recipe.buff === 'fuel') next.buff.fuel = grade === 'perfect' ? 0.72 : 0.85
  if (recipe.buff === 'rep') next.buff.rep = (next.buff.rep || 0) + (grade === 'perfect' ? 8 : 5)
  const word = grade === 'perfect' ? 'Perfect.' : 'Cooked.'
  return { save: next, grade, text: word + ' ' + recipe.name }
}
