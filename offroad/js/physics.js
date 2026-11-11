// Vehicle and terrain collision. cannon-es raycast vehicle on a heightfield.
import * as CANNON from '../vendor/cannon-es.js'
import { FRICTION, DRAG, SURF, heightfieldData } from './world.js'
import { specWithUpgrades } from './economy.js'

export function createSim(world) {
  const cw = new CANNON.World()
  cw.gravity.set(0, -9.82, 0)
  cw.broadphase = new CANNON.SAPBroadphase(cw)
  cw.solver.iterations = 8
  cw.allowSleep = false
  const hf = heightfieldData(world, 121)
  const ground = new CANNON.Body({ mass: 0 })
  ground.addShape(new CANNON.Heightfield(hf.data, { elementSize: hf.elementSize }))
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  ground.position.set(hf.position.x, hf.position.y, hf.position.z)
  cw.addBody(ground)

  const props = []
  function addBox(x, y, z, hx, hy, hz) {
    const b = new CANNON.Body({ mass: 0 })
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)))
    b.position.set(x, y, z)
    cw.addBody(b)
    props.push(b)
    return b
  }
  // Sheds and camps are solid. Offsets keep the spawn pad clear.
  const yard = world.pois.find(p => p.id === 'yard')
  addBox(yard.x + 11, yard.y + 1.4, yard.z + 2, 4.2, 1.4, 2.6)
  const cabin = world.pois.find(p => p.id === 'cabin')
  addBox(cabin.x, cabin.y + 1.3, cabin.z, 3.1, 1.3, 2.3)
  const mill = world.pois.find(p => p.id === 'mill')
  addBox(mill.x, mill.y + 2.2, mill.z, 1.1, 2.2, 1.1)
  const look = world.pois.find(p => p.id === 'lookout')
  addBox(look.x, look.y + 3.2, look.z, 1.3, 3.2, 1.3)
  for (const p of world.pois) if (p.kind === 'store') addBox(p.x + 5.5, (p.y || 0) + 1.4, p.z, 2.8, 1.4, 2.1)

  let vehicle = null
  let chassis = null
  let spec = null

  function spawn(id, pose, upgrades) {
    bog = 0
    if (vehicle) vehicle.removeFromWorld(cw)
    spec = specWithUpgrades(id, upgrades || { tires: 0, susp: 0, engine: 0, winch: 0 })
    chassis = new CANNON.Body({ mass: spec.mass, linearDamping: 0.05, angularDamping: 0.42 })
    chassis.allowSleep = false
    const hx = spec.half[0], hy = spec.half[1], hz = spec.half[2]
    chassis.addShape(new CANNON.Box(new CANNON.Vec3(hx * 0.92, hy * 0.72, hz * 0.92)), new CANNON.Vec3(0, 0.12, 0))
    chassis.addShape(new CANNON.Box(new CANNON.Vec3(hx * 0.7, 0.14, hz * 0.55)), new CANNON.Vec3(0, -0.02, 0.1))
    const y = pose && pose.y != null ? pose.y : world.height(pose.x, pose.z) + 1.6
    chassis.position.set(pose.x, y, pose.z)
    if (pose.qw != null) chassis.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw)
    chassis.velocity.set(0, 0, 0)
    chassis.angularVelocity.set(0, 0, 0)
    vehicle = new CANNON.RaycastVehicle({
      chassisBody: chassis,
      indexRightAxis: 0,
      indexForwardAxis: 2,
      indexUpAxis: 1
    })
    const wheel = {
      radius: spec.wheelR,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      axleLocal: new CANNON.Vec3(1, 0, 0),
      suspensionStiffness: spec.stiff,
      suspensionRestLength: spec.rest,
      frictionSlip: 2.2,
      dampingRelaxation: 2.5,
      dampingCompression: 4.3,
      maxSuspensionForce: 140000,
      rollInfluence: 0.07,
      maxSuspensionTravel: spec.travel,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
      chassisConnectionPointLocal: new CANNON.Vec3()
    }
    const pts = [
      [-spec.track, -0.05, spec.wheelbase],
      [spec.track, -0.05, spec.wheelbase],
      [-spec.track, -0.05, -spec.wheelbase],
      [spec.track, -0.05, -spec.wheelbase]
    ]
    for (const p of pts) {
      wheel.chassisConnectionPointLocal.set(p[0], p[1], p[2])
      vehicle.addWheel(wheel)
    }
    vehicle.addToWorld(cw)
  }

  const forward = new CANNON.Vec3()
  const up = new CANNON.Vec3()
  let bog = 0
  function step(dt, input) {
    if (!vehicle) return
    vehicle.getVehicleAxisWorld(2, forward)
    const speed = chassis.velocity.dot(forward)
    const low = !!input.low
    const cap = spec.maxSpeed * (low ? 0.45 : 1)
    const torque = spec.force * (low ? 1.8 : 1)
    const throttle = Math.max(0, input.throttle || 0)
    const brakeIn = Math.max(0, input.brake || 0)
    const tip = Math.pow(throttle, 1.25)
    let surfSum = 0
    let dragSum = 0
    for (let i = 0; i < vehicle.wheelInfos.length; i++) {
      const w = vehicle.wheelInfos[i]
      const p = w.chassisConnectionPointWorld
      const s = world.surface(p.x, p.z)
      const grip = FRICTION[s] * spec.grip * (input.lock ? 1.55 : 1) * (input.grip || 1) * (s === 4 ? 1.15 : 1)
      w.frictionSlip = grip
      surfSum += s
      dragSum += DRAG[s]
      const steer = (i < 2 ? 1 : 0) * input.steer * spec.steer * (input.lock ? 0.65 : 1) * (low ? 0.82 : 1)
      vehicle.setSteeringValue(steer, i)
      let engine = 0
      let brake = 0
      const fueled = input.fuel > 0.02
      if (input.handbrake && i >= 2) brake = 42
      if (brakeIn > 0.05 && speed > 0.35) brake = Math.max(brake, 16 * brakeIn)
      else if (brakeIn > 0.05 && fueled) engine = -torque * 0.72 * brakeIn
      if (tip > 0.02 && fueled && speed < cap) {
        const head = Math.max(0, 1 - Math.max(0, speed) / cap)
        engine += torque * tip * (0.7 + 0.6 * head)
      }
      if (brakeIn > 0.05 && speed > 0.35) engine = 0
      if (throttle < 0.04 && brakeIn < 0.04 && !input.handbrake) {
        const hold = low ? 1.3 : 1
        if (Math.abs(speed) < 0.42) brake = Math.max(brake, 16 * hold)
        else brake = Math.max(brake, Math.min(8 * hold, Math.abs(speed) * 1.7 * hold))
      }
      vehicle.applyEngineForce(-engine, i)
      vehicle.setBrake(brake, i)
    }
    const mx = chassis.position.x, mz = chassis.position.z
    const mud = world.mudDepth(mx, mz)
    const water = world.waterDepth(mx, mz)
    bog += (mud - bog) * Math.min(1, dt * 1.6)
    if (bog < 0) bog = 0
    const sunk = bog > (spec.bogAt || 0.7)
    const flooded = water > (spec.wade || 0.8)
    if (sunk || flooded) {
      for (let i = 0; i < vehicle.wheelInfos.length; i++) {
        if (!(input.winch && input.anchor)) {
          vehicle.applyEngineForce(0, i)
          vehicle.setBrake(22, i)
        }
      }
    }
    const drag = dragSum / 4 + bog * 1.7 + Math.min(water, spec.wade || 1) * 0.9
    const damp = Math.exp(-drag * dt)
    chassis.velocity.scale(damp, chassis.velocity)
    if (water > 0.15) {
      const flow = world.currentDir(mx)
      const push = Math.min(1.4, water) * spec.mass * 0.55
      chassis.applyForce(new CANNON.Vec3(flow.x * push, 0, flow.z * push), chassis.position)
      if (water > (spec.wade || 0.8) + 0.35) {
        const lift = spec.mass * 2.4 * Math.min(1, (water - spec.wade) / 1.2)
        chassis.applyForce(new CANNON.Vec3(0, lift, 0), chassis.position)
        chassis.angularVelocity.scale(0.9, chassis.angularVelocity)
      }
    }
    if (input.winch && input.anchor && Math.abs(speed) < 8) {
      const dx = input.anchor.x - mx
      const dz = input.anchor.z - mz
      const len = Math.hypot(dx, dz) || 1
      const f = spec.winch * (sunk || flooded ? 1.35 : 1)
      chassis.applyForce(new CANNON.Vec3(dx / len * f, f * 0.25, dz / len * f), chassis.position)
      up.set(0, 1, 0)
      chassis.quaternion.vmult(up, up)
      chassis.torque.x += up.z * f * 0.35
      chassis.torque.z += -up.x * f * 0.35
    } else if (input.winch && Math.abs(speed) < 7) {
      const f = spec.winch
      chassis.applyForce(new CANNON.Vec3(forward.x * f, f * 0.45, forward.z * f), chassis.position)
      up.set(0, 1, 0)
      chassis.quaternion.vmult(up, up)
      chassis.torque.x += up.z * spec.winch * 0.85
      chassis.torque.z += -up.x * spec.winch * 0.85
    }
    cw.step(dt)
    const stuck = sunk ? 'mud' : flooded ? 'water' : ''
    return { speed, surf: surfSum / 4, stuck, mud: bog, water, sink: Math.min(bog, spec.wheelR), wade: spec.wade, bogAt: spec.bogAt }
  }

  function reset() {
    const x = chassis.position.x, z = chassis.position.z
    const yaw = Math.atan2(2 * (chassis.quaternion.w * chassis.quaternion.y + chassis.quaternion.x * chassis.quaternion.z),
      1 - 2 * (chassis.quaternion.y * chassis.quaternion.y + chassis.quaternion.z * chassis.quaternion.z))
    chassis.position.set(x, world.height(x, z) + 1.5, z)
    chassis.quaternion.setFromEuler(0, yaw, 0)
    chassis.velocity.set(0, 0, 0)
    chassis.angularVelocity.set(0, 0, 0)
    chassis.force.set(0, 0, 0)
    chassis.torque.set(0, 0, 0)
  }

  const solids = new Map()
  let solidAt = null
  function syncSolids(trees, rocks) {
    if (!chassis) return 0
    const x = chassis.position.x, z = chassis.position.z
    if (solidAt && (x - solidAt.x) ** 2 + (z - solidAt.z) ** 2 < 36) return solids.size
    solidAt = { x, z }
    const keep = new Set()
    const R2 = 38 * 38
    const add = (key, body) => { cw.addBody(body); solids.set(key, body) }
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]
      const dx = t.x - x, dz = t.z - z
      if (dx * dx + dz * dz > R2) continue
      const key = 't' + i
      keep.add(key)
      if (solids.has(key)) continue
      const radius = 0.36 * t.s
      const height = 3.6 * t.s
      const b = new CANNON.Body({ mass: 0 })
      b.addShape(new CANNON.Cylinder(radius, radius * 1.15, height, 6))
      b.position.set(t.x, t.y + height * 0.45, t.z)
      add(key, b)
    }
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i]
      const dx = r.x - x, dz = r.z - z
      if (dx * dx + dz * dz > R2) continue
      const key = 'r' + i
      keep.add(key)
      if (solids.has(key)) continue
      const hx = r.rad * 0.45, hy = Math.max(0.9, r.h * 0.6), hz = r.rad * 0.45
      const b = new CANNON.Body({ mass: 0 })
      b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)))
      b.position.set(r.x, world.height(r.x, r.z) + hy * 0.45, r.z)
      add(key, b)
    }
    for (const [k, b] of solids) {
      if (!keep.has(k)) { cw.removeBody(b); solids.delete(k) }
    }
    return solids.size
  }

  function upright() {
    up.set(0, 1, 0)
    chassis.quaternion.vmult(up, up)
    return up.y
  }

  function place(x, z, yaw) {
    chassis.position.set(x, world.height(x, z) + 1.55, z)
    chassis.quaternion.setFromEuler(0, yaw || 0, 0)
    chassis.velocity.set(0, 0, 0)
    chassis.angularVelocity.set(0, 0, 0)
    chassis.force.set(0, 0, 0)
    chassis.torque.set(0, 0, 0)
  }
  return { cw, ground, props, spawn, step, reset, place, syncSolids, upright, get chassis() { return chassis }, get vehicle() { return vehicle }, get spec() { return spec } }
}

// Flat-ground traction check used by the node test. High grip should out-accelerate ice.
export function tractionTrial(friction, seconds) {
  const cw = new CANNON.World()
  cw.gravity.set(0, -9.82, 0)
  cw.solver.iterations = 8
  const ground = new CANNON.Body({ mass: 0 })
  ground.addShape(new CANNON.Box(new CANNON.Vec3(80, 1, 80)))
  ground.position.set(0, -1, 0)
  cw.addBody(ground)
  const spec = specWithUpgrades('mule', { tires: 0, susp: 0, engine: 0, winch: 0 })
  spec.force = 4500
  const chassis = new CANNON.Body({ mass: spec.mass })
  chassis.allowSleep = false
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(1, 0.35, 2)))
  chassis.position.set(0, 1.2, 0)
  const vehicle = new CANNON.RaycastVehicle({ chassisBody: chassis, indexRightAxis: 0, indexForwardAxis: 2, indexUpAxis: 1 })
  const wheel = {
    radius: 0.45,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    axleLocal: new CANNON.Vec3(1, 0, 0),
    suspensionStiffness: 40,
    suspensionRestLength: 0.3,
    frictionSlip: friction,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4,
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,
    maxSuspensionTravel: 0.2,
    chassisConnectionPointLocal: new CANNON.Vec3()
  }
  for (const p of [[-0.9, 0, 1.4], [0.9, 0, 1.4], [-0.9, 0, -1.4], [0.9, 0, -1.4]]) {
    wheel.chassisConnectionPointLocal.set(p[0], p[1], p[2])
    vehicle.addWheel(wheel)
  }
  vehicle.addToWorld(cw)
  const n = Math.round(seconds * 60)
  for (let i = 0; i < n; i++) {
    for (let w = 0; w < 4; w++) {
      vehicle.wheelInfos[w].frictionSlip = friction
      vehicle.applyEngineForce(-spec.force, w)
    }
    cw.step(1 / 60)
  }
  return chassis.velocity.length()
}

export { SURF }
