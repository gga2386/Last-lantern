// OFFROAD_V2 — terrain, reputation, fuel, and solid trees. Run: node offroad/test/sim.js
import { createWorld, SURF, FRICTION, DRAG, HALF } from '../js/world.js'
import { OFFROAD_V2, freshSave, buyUpgrade, buyVehicle, buyAux, buyJerry, useJerry, refuel, burnFuel, coerceSave, tickAdventure, tankCapacity, jerrySlots, isDark, TANK, specWithUpgrades, ADVENTURES } from '../js/economy.js'
import { createSim, tractionTrial } from '../js/physics.js'

const fails = []
const fail = m => fails.push(m)
if (OFFROAD_V2 !== 1) fail('marker missing')

const t0 = performance.now()
const world = createWorld(1)
const ms = performance.now() - t0
console.log('world ms', ms.toFixed(1), 'trees', world.trees.length, 'rocks', world.rocks.length)
if (ms > 4000) fail('world build too slow ' + ms)

const a = world.height(0, 0), b = world.height(0, 0)
if (a !== b) fail('height not deterministic')
const world2 = createWorld(1)
if (world2.height(40, -20) !== world.height(40, -20)) fail('seeded world drifted')

let min = Infinity, max = -Infinity, water = 0, mud = 0, sand = 0, rock = 0, trail = 0, dirt = 0
for (let i = 0; i < world.gridN; i += 2) {
  for (let j = 0; j < world.gridN; j += 2) {
    const h = world.heights[j * world.gridN + i]
    if (h < min) min = h
    if (h > max) max = h
    const s = world.surf[j * world.gridN + i]
    if (s === SURF.water) water++
    else if (s === SURF.mud) mud++
    else if (s === SURF.sand) sand++
    else if (s === SURF.rock) rock++
    else if (s === SURF.trail) trail++
    else dirt++
  }
}
console.log('height', min.toFixed(1), max.toFixed(1), 'cells', { dirt, trail, mud, sand, rock, water })
if (max - min < 18) fail('terrain is too flat')
if (!water || !mud || !sand || !rock || !trail || !dirt) fail('a surface type is missing')
for (const id of ['yard', 'cabin', 'quarry', 'mill', 'lookout', 'switchback', 'cairn', 'storeyard', 'storewren', 'storequarry', 'storeridge']) {
  const p = world.pois.find(q => q.id === id)
  if (!p) { fail('missing poi ' + id); continue }
  if (Math.abs(p.x) > HALF - 30 || Math.abs(p.z) > HALF - 30) fail(id + ' is outside the map')
  const s = world.surface(p.x, p.z)
  if (s === SURF.water) fail(id + ' sits in the creek')
  if (!Number.isFinite(p.y)) fail(id + ' height')
}
const yard = world.pois.find(p => p.id === 'yard')
const quarry = world.pois.find(p => p.id === 'quarry')
let crossed = false
for (let t = 0; t <= 24; t++) {
  const x = yard.x + (quarry.x - yard.x) * (t / 24)
  const z = yard.z + (quarry.z - yard.z) * (t / 24)
  if (world.surface(x, world.riverZ(x)) === SURF.water) crossed = true
}
if (!crossed) fail('no water between the yard and the quarry')
if (!(FRICTION[SURF.mud] < FRICTION[SURF.sand] && FRICTION[SURF.sand] < FRICTION[SURF.rock] && FRICTION[SURF.dirt] < FRICTION[SURF.trail])) fail('friction order')
if (!(FRICTION[SURF.water] < FRICTION[SURF.mud])) fail('water should be slicker than mud')

let save = freshSave()
if (buyUpgrade(save, 'tires')) fail('fitted tires with no reputation')
if (buyVehicle(save, 'scout')) fail('took the scout with no reputation')
save.rep = 40
const up = buyUpgrade(save, 'tires')
if (!up || up.upgrades.tires !== 1 || up.rep !== 40) fail('tire fit')
if (save.upgrades.tires !== 0) fail('purchase mutated the original save')
save.rep = 160
const scout = buyVehicle(save, 'scout')
if (!scout || !scout.owned.includes('scout') || scout.vehicle !== 'scout') fail('scout unlock')
if (buyVehicle(scout, 'scout')) fail('took the scout twice')
const aux = buyAux(Object.assign(freshSave(), { rep: 40 }))
if (!aux || aux.aux !== 1 || tankCapacity(aux) !== TANK + 4) fail('aux tank')
if (buyJerry(freshSave())) fail('jerry can with no reputation')
const can = buyJerry(Object.assign(freshSave(), { rep: 40 }))
if (!can || can.jerry !== 1 || jerrySlots(40) !== 1) fail('jerry purchase')
const poured = useJerry(can)
if (!poured || poured.jerry !== 0 || poured.fuel !== TANK) fail('jerry pour when already full')
const low = useJerry(Object.assign(can, { fuel: 2 }))
if (!low || low.fuel !== 7) fail('jerry pour ' + (low && low.fuel))
const full = refuel(Object.assign(freshSave(), { fuel: 3, aux: 1 }))
if (full.fuel !== tankCapacity(full) || full.fuel <= 3) fail('free refuel')
const fuelLeft = burnFuel(TANK, 1, 2)
if (!(fuelLeft < TANK && fuelLeft > TANK - 1)) fail('fuel burn ' + fuelLeft)
if (burnFuel(0.01, 1, 5) !== 0) fail('fuel went negative')
const migrated = coerceSave({ v: 1, money: 400, fuel: 9, vehicle: 'mule', owned: ['mule'], upgrades: { tires: 1, susp: 0, engine: 0, winch: 0 }, discovered: ['yard'], done: ['lookout', 'mill'], settings: { time: 0.2, gfx: 'low' }, x: 1, z: 2, qw: 1 }, 'low')
if (!migrated || migrated.v !== 2 || migrated.money != null) fail('migration kept cash')
if (migrated.rep !== 45 + 50) fail('migration rep ' + migrated.rep)
if (!migrated.cleared.nightwatch || !migrated.cleared.ford) fail('migration adventures')
if (migrated.upgrades.tires !== 1 || migrated.clock !== 0.2) fail('migration kept the truck and the clock')
if (isDark(0.5) || !isDark(0.05) || !isDark(0.8)) fail('dusk and night window')
const advSave = freshSave()
advSave.active = { id: 'south', step: 0, elapsed: 0, resets: 0 }
const south = world.pois.find(p => p.id === 'switchback')
const done = tickAdventure(advSave, { x: south.x, z: south.z, speed: 0, clock: 0.5, dt: 0.2, water: false, ford: world.ford, pois: Object.fromEntries(world.pois.map(p => [p.id, p])) })
if (!done || !done.done || done.gain !== 25 + 8 || advSave.rep !== 33) fail('south adventure ' + JSON.stringify(done))
const spec = specWithUpgrades('mule', { tires: 2, susp: 2, engine: 2, winch: 1 })
if (!(spec.force > 3400 && spec.grip > 1 && spec.travel > 0.2 && spec.winch > 650)) fail('upgrades did not change the truck')

const hooked = tractionTrial(2.4, 1.2)
console.log('flat drive m/s', hooked.toFixed(2))
if (!(hooked > 4)) fail('truck did not accelerate on flat ground')
function coast(drag, steps) {
  let v = 14
  for (let i = 0; i < steps; i++) v *= Math.exp(-drag * (1 / 60))
  return v
}
const mudCoast = coast(DRAG[SURF.mud], 120)
const dirtCoast = coast(DRAG[SURF.dirt], 120)
const waterCoast = coast(DRAG[SURF.water], 120)
console.log('coast', 'dirt', dirtCoast.toFixed(2), 'mud', mudCoast.toFixed(2), 'water', waterCoast.toFixed(2))
if (!(waterCoast < mudCoast && mudCoast < dirtCoast * 0.85)) fail('mud and water should bleed more speed than dirt')

const sim = createSim(world)
sim.spawn('mule', { x: yard.x, z: yard.z + 6 })
let fell = false
for (let i = 0; i < 120; i++) sim.step(1 / 60, { throttle: 0, brake: 0, steer: 0, handbrake: 0, lock: false, winch: false, fuel: 18 })
const restY = sim.chassis.position.y
const groundY = world.height(sim.chassis.position.x, sim.chassis.position.z)
console.log('rest', restY.toFixed(2), 'ground', groundY.toFixed(2), 'up', sim.upright().toFixed(2))
if (restY < groundY - 0.2 || restY > groundY + 3.5) fail('truck did not settle on the terrain')
if (sim.upright() < 0.7) fail('truck spawned on its side')
const x0 = sim.chassis.position.x, z0 = sim.chassis.position.z
for (let i = 0; i < 180; i++) sim.step(1 / 60, { throttle: 1, brake: 0, steer: 0, handbrake: 0, lock: false, winch: false, fuel: 18 })
const moved = Math.hypot(sim.chassis.position.x - x0, sim.chassis.position.z - z0)
console.log('drove', moved.toFixed(2), 'm', 'pos', sim.chassis.position.x.toFixed(1), sim.chassis.position.z.toFixed(1))
if (moved < 4) fail('throttle did not move the truck')
if (!(sim.chassis.position.z > z0 + 2)) fail('truck drove backward')
if (!Number.isFinite(sim.chassis.position.y)) fail('position NaN')
sim.chassis.quaternion.setFromEuler(Math.PI * 0.85, 0.4, 0.2)
sim.chassis.velocity.set(4, 1, -2)
sim.reset()
if (sim.upright() < 0.95) fail('reset did not stand the truck up')
if (sim.chassis.velocity.length() > 0.01) fail('reset left speed on the truck')
const empty = createSim(world)
empty.spawn('mule', { x: yard.x, z: yard.z + 6 })
for (let i = 0; i < 30; i++) empty.step(1 / 60, { throttle: 0, brake: 0, steer: 0, handbrake: 0, lock: false, winch: false, fuel: 18 })
const ez = empty.chassis.position.z
for (let i = 0; i < 90; i++) empty.step(1 / 60, { throttle: 1, brake: 0, steer: 0, handbrake: 0, lock: false, winch: false, fuel: 0 })
if (Math.abs(empty.chassis.position.z - ez) > 1.5) fail('empty tank still drove')

const tree = world.trees.find(t => Math.abs(t.x - yard.x) < 25 && t.z > yard.z + 12 && t.z < yard.z + 40)
if (!tree) fail('no tree north of the yard to crash into')
else {
  const hit = createSim(world)
  hit.spawn('mule', { x: tree.x, z: tree.z - 7, y: world.height(tree.x, tree.z - 7) + 2 })
  hit.syncSolids(world.trees, world.rocks)
  for (let i = 0; i < 240; i++) hit.step(1 / 60, { throttle: 1, brake: 0, steer: 0, handbrake: 0, lock: false, winch: false, fuel: 18 })
  const gap = Math.hypot(hit.chassis.position.x - tree.x, hit.chassis.position.z - tree.z)
  console.log('tree gap', gap.toFixed(2), 'z', hit.chassis.position.z.toFixed(1), 'trunk', tree.z.toFixed(1))
  if (hit.chassis.position.z > tree.z - 0.8) fail('truck drove through the tree')
  if (gap < 0.7) fail('truck overlapped the trunk')
}

if (fails.length) {
  console.error('FAIL')
  fails.forEach(f => console.error(' -', f))
  process.exit(1)
}
console.log('OK OFFROAD_V2')
