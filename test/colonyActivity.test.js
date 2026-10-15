import test from 'node:test'
import assert from 'node:assert/strict'
import { colonyActivity, surfacePath } from '../src/game/colonyActivity.js'
import { advanceConstruction, CONSTRUCTION_WORK } from '../src/game/construction.js'
import { ensureCrewMembers } from '../src/game/crewMembers.js'
import { createInitialState } from '../src/game/initialState.js'
import { ROVER_ROUTE_ORDER } from '../src/game/roverOperations.js'
import { advanceSol, applyFollowOnManifest, applyManifest, colonyStats, placeBuilding, restoreState, updateRoverAssignment } from '../src/game/simulation.js'
import { runNativeCampaign } from './helpers/nativeCampaign.js'

const start = () => applyManifest(createInitialState('american-compact'), 'industrial-seed').state
const key = (cell) => `${cell.col}:${cell.row}`
const manhattan = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
const activity = (state, running = true) => colonyActivity(state, colonyStats(state), running)
let finished
const city = () => {
  finished ??= runNativeCampaign('american-compact', 'industrial-seed', 'machine-economy').state
  assert.equal(finished.outcome, 'permanent-city', 'activity reference must be an earned native city')
  return structuredClone(finished)
}
const dispatch = (state, desired) => {
  for (const route of ROVER_ROUTE_ORDER) while (state.roverAssignments[route] > (desired[route] ?? 0)) {
    const result = updateRoverAssignment(state, route, -1)
    assert.equal(result.error, '')
    state = result.state
  }
  for (const route of ROVER_ROUTE_ORDER) while (state.roverAssignments[route] < (desired[route] ?? 0)) {
    const result = updateRoverAssignment(state, route, 1)
    assert.equal(result.error, '')
    state = result.state
  }
  return state
}
function validPaths(state, model) {
  const occupied = new Set(state.buildings.map(key))
  for (const actor of [...model.rovers, ...model.crew]) {
    assert.ok(actor.path.length > 0, actor.id)
    for (const [index, cell] of actor.path.entries()) {
      assert.ok(Number.isInteger(cell.col) && cell.col >= 0 && cell.col <= 8, `${actor.id}: column inside the map`)
      assert.ok(Number.isInteger(cell.row) && cell.row >= 0 && cell.row <= 5, `${actor.id}: row inside the map`)
      assert.equal(occupied.has(key(cell)), false, `${actor.id}: path avoids all finished and pending structures`)
      if (index) assert.equal(manhattan(actor.path[index - 1], cell), 1, `${actor.id}: one orthogonal walkable step`)
    }
    if (actor.workCell) {
      assert.equal(occupied.has(key(actor.workCell)), false, `${actor.id}: work port is free`)
      const target = state.buildings.find((building) => building.uid === actor.targetUid)
      if (target) {
        assert.equal(Math.max(Math.abs(target.col - actor.workCell.col), Math.abs(target.row - actor.workCell.row)), 1, `${actor.id}: structure is reached through an immediately neighboring service port`)
        assert.deepEqual(actor.targetCell, { col: target.col, row: target.row }, `${actor.id}: task facing retains the actual structure separately from its free service port`)
      }
      if (actor.status !== 'shelter') assert.deepEqual(actor.path.at(-1), actor.workCell, `${actor.id}: route arrives at its actual service port`)
    }
  }
}

test('unauthorized missions show no actors and cannot start their visual clock', () => {
  const state = createInitialState('american-compact'), snapshot = structuredClone(state)
  const model = activity(state, true)
  assert.deepEqual(model.rovers, [])
  assert.deepEqual(model.crew, [])
  assert.equal(model.running, false)
  assert.deepEqual(state, snapshot)
})

test('rover descriptors exactly match actual dispatch and idle assignments do not invent work', () => {
  const state = start(), snapshot = structuredClone(state), model = activity(state)
  assert.equal(model.rovers.length, state.roverFleet)
  for (const route of ROVER_ROUTE_ORDER) assert.equal(model.rovers.filter((rover) => rover.route === route).length, state.roverAssignments[route], route)
  for (const rover of model.rovers) {
    assert.equal(rover.status, 'standby')
    assert.equal(rover.targetUid, null, 'no supplied ice rig or construction site exists')
    assert.equal(rover.path.length, 1)
  }
  assert.deepEqual(state, snapshot, 'descriptors cannot award work, reserves, discoveries or repairs')
  const unassigned = dispatch(start(), {}), parked = activity(unassigned)
  assert.equal(parked.rovers.length, unassigned.roverFleet)
  assert.ok(parked.rovers.every((rover) => rover.route === 'reserve' && rover.status === 'parked' && rover.path.length === 1))
  const surveyed = dispatch(start(), { survey: 1, maintenance: 1 }), assigned = activity(surveyed)
  assert.equal(assigned.rovers.filter((rover) => rover.route === 'survey').length, 1)
  assert.equal(assigned.rovers.filter((rover) => rover.route === 'maintenance').length, 1)
  assert.equal(assigned.rovers.filter((rover) => rover.route === 'reserve').length, 0)
  validPaths(surveyed, assigned)
})

test('surface paths use bounded orthogonal free cells and stop at an impassable barrier', () => {
  const blocked = new Set(['1:0', '1:1', '1:2', '1:3', '1:4'])
  const path = surfacePath({ col: 0, row: 0 }, { col: 2, row: 0 }, blocked)
  assert.ok(path.length > 3, 'a real detour must go around the barrier')
  for (const [index, cell] of path.entries()) {
    assert.ok(cell.col >= 0 && cell.col < 9 && cell.row >= 0 && cell.row < 6)
    assert.equal(blocked.has(key(cell)), false)
    if (index) assert.equal(manhattan(path[index - 1], cell), 1)
  }
  blocked.add('1:5')
  assert.deepEqual(surfacePath({ col: 0, row: 0 }, { col: 2, row: 0 }, blocked), [])
  assert.deepEqual(surfacePath({ col: 1, row: 0 }, { col: 2, row: 0 }, blocked), [])
  assert.deepEqual(surfacePath({ col: 0, row: 0 }, { col: 1, row: 0 }, blocked), [])
})

test('surface path endpoints outside integer grid cells cannot introduce an off-map route', () => {
  for (const endpoint of [{ col: -1, row: 0 }, { col: 9, row: 0 }, { col: 0, row: -1 }, { col: 0, row: 6 }, { col: 0.5, row: 1 }, { col: 1, row: NaN }, { col: Infinity, row: 1 }]) {
    assert.deepEqual(surfacePath(endpoint, { col: 2, row: 2 }, new Set()), [], JSON.stringify(endpoint))
    assert.deepEqual(surfacePath({ col: 2, row: 2 }, endpoint, new Set()), [], JSON.stringify(endpoint))
  }
})

test('activity routes avoid every occupied cell in the opening and an earned built city', () => {
  const opening = dispatch(start(), { survey: 1, maintenance: 1 })
  const built = dispatch(city(), { water: 1, maintenance: 1, survey: 1 })
  for (const state of [opening, built]) validPaths(state, activity(state))
  const model = activity(built)
  const water = model.rovers.find((rover) => rover.route === 'water')
  assert.ok(water.targetUid)
  assert.ok(colonyStats(built).production[water.targetUid].water > 0)
  const survey = model.rovers.find((rover) => rover.route === 'survey')
  assert.equal(survey.status, 'standby', 'an earned completed survey creates no imaginary next prospect')
  assert.equal(survey.path.length, 1)
})

test('only healthy current crew members receive activity and no cohort creates anonymous labor', () => {
  const state = city(), model = activity(state), roster = ensureCrewMembers(state)
  assert.ok(model.crew.length > 0)
  assert.equal(new Set(model.crew.map((actor) => actor.id)).size, model.crew.length)
  for (const actor of model.crew) {
    const member = roster.find((candidate) => candidate.id === actor.id)
    assert.ok(member && member.health > 0 && member.fatigue < 78)
    assert.equal(actor.cohort, member.cohort)
  }
  // Boundary crew conditions isolate the same earned city and real roster.
  const down = { ...state, crewMembers: state.crewMembers.map((member) => ({ ...member, health: 0 })) }
  assert.deepEqual(activity(down).crew, [])
  const exhausted = { ...state, crewMembers: state.crewMembers.map((member) => ({ ...member, fatigue: 78 })) }
  assert.deepEqual(activity(exhausted).crew, [])
  const engineeringDown = { ...state, crewMembers: state.crewMembers.map((member) => member.cohort === 'engineering' ? { ...member, health: 0 } : member) }
  assert.equal(activity(engineeringDown).crew.some((actor) => actor.cohort === 'engineering'), false)
})

test('storm and debris descriptors shelter real crew while keeping every shown cell walkable', () => {
  for (const sol of [18, 34]) {
    // Hazard boundary: the inventory remains the legally earned native city.
    const state = { ...city(), sol }, model = activity(state)
    assert.ok(model.crew.length > 0)
    assert.ok(model.crew.every((actor) => actor.status === 'shelter' && actor.path.length === 1))
    assert.ok(model.crew.every((actor) => /sheltered during hazard/i.test(actor.label)))
    validPaths(state, model)
  }
})

test('pause is an explicit descriptor clock gate and never changes simulation state or job progress', () => {
  const state = dispatch(start(), { survey: 1, maintenance: 1 }), snapshot = structuredClone(state)
  const paused = activity(state, false), running = activity(state, true)
  assert.equal(paused.running, false)
  assert.equal(running.running, true)
  assert.deepEqual({ ...paused, running: true }, running, 'pausing preserves the assigned actors and routes')
  assert.deepEqual(state, snapshot)
})

test('construction activity requires an actual reachable paid job and an eligible supervising engineer', () => {
  const before = start(), placed = placeBuilding(before, 'storage', 4, 2)
  assert.equal(placed.error, '')
  const state = placed.state, uid = state.buildings.at(-1).uid, snapshot = structuredClone(state), model = activity(state)
  const rover = model.rovers.find((actor) => actor.route === 'construction')
  assert.equal(rover.targetUid, uid)
  assert.equal(rover.status, 'active')
  const engineer = model.crew.find((actor) => actor.cohort === 'engineering')
  assert.equal(engineer.task, 'construction')
  assert.equal(engineer.targetUid, uid)
  assert.equal(colonyStats(state).production[uid].online, false, 'a visual work crew cannot commission its target')
  assert.deepEqual(state, snapshot)
  validPaths(state, model)
  // Boundary health/policy changes test that a saved job alone cannot fake work.
  const down = { ...state, crewMembers: state.crewMembers.map((member) => member.cohort === 'engineering' ? { ...member, health: 0 } : member) }
  const halted = activity(down).rovers.find((actor) => actor.route === 'construction')
  assert.equal(halted.status, 'standby')
  assert.equal(halted.targetUid, null)
  const hold = { ...state, sol: 18, policyEffects: { restrictedConstructionDuringHazards: true } }
  assert.equal(activity(hold).rovers.find((actor) => actor.route === 'construction').status, 'standby')
  assert.equal(activity(hold).crew.some((actor) => actor.task === 'construction'), false)
})

test('construction actors target the actual oldest working job after a valid imported queue is reordered', () => {
  const before = start()
  // Import boundary: both stored jobs are legal, but the save array is not in
  // chronological order. Simulation FIFO must also determine the shown work.
  const job = (uid, type, col, row, startedSol) => ({ uid, type, col, row, integrity: 100, construction: { requiredWork: CONSTRUCTION_WORK[type], completedWork: 0, paid: { parts: type === 'storage' ? 26 : 81, cargo: type === 'storage' ? 0.8 : 3 }, startedSol } })
  const state = { ...before, sol: 2, buildings: [...before.buildings, job('newer-storage', 'storage', 4, 2, 2), job('older-nuclear', 'nuclear', 2, 2, 1)] }
  assert.ok(restoreState(JSON.stringify(state)), 'the reordered boundary queue must pass real save validation')
  const stats = colonyStats(state), actual = advanceConstruction(state, stats), model = colonyActivity(state, stats, true)
  assert.equal(actual.find((building) => building.uid === 'newer-storage').construction.completedWork, 0)
  assert.ok(actual.find((building) => building.uid === 'older-nuclear').construction.completedWork > 0)
  assert.equal(model.rovers.find((actor) => actor.route === 'construction').targetUid, 'older-nuclear')
  assert.equal(model.crew.find((actor) => actor.task === 'construction').targetUid, 'older-nuclear')
})

test('a hauling rover targets the same confirmed rig that actually receives its full field delivery', () => {
  const before = start()
  // Import boundary: nominal yield and delivered output differ because the
  // higher-yield rig is damaged. This isolates the existing haul allocation.
  const state = { ...before, surveyedFeatureIds: ['arcadia-west', 'arcadia-central'], buildings: [...before.buildings,
    { uid: 'west-ice', type: 'ice', col: 1, row: 5, integrity: 100 },
    { uid: 'central-ice', type: 'ice', col: 5, row: 1, integrity: 1 },
  ] }
  assert.ok(restoreState(JSON.stringify(state)), 'the boundary import must pass real save validation')
  const stats = colonyStats(state)
  assert.match(stats.production['west-ice'].reason, /no dedicated hauling rover/i)
  assert.ok(stats.production['west-ice'].water > stats.production['central-ice'].water, 'larger delivered output does not identify the assigned hauling rover')
  const model = colonyActivity(state, stats, true)
  assert.equal(model.rovers.find((actor) => actor.route === 'water').targetUid, 'central-ice')
})

test('a dense legally built Sol25 worksite remains serviceable from a free corner using cardinal travel', () => {
  const review = runNativeCampaign('american-compact', 'industrial-seed', null, { stopAt: 24 }).checkpoints.review
  const followOn = applyFollowOnManifest(review, 'machine-economy')
  assert.equal(followOn.error, '')
  let state = dispatch(followOn.state, { construction: followOn.state.roverFleet })
  const greenhouse = placeBuilding(state, 'greenhouse', 5, 3)
  assert.equal(greenhouse.error, '')
  state = advanceSol(greenhouse.state)
  assert.equal(state.sol, 25)
  assert.equal(state.buildings.find((building) => building.type === 'greenhouse').construction == null, true)
  for (const [type, col, row] of [['recycling', 3, 3], ['storage', 4, 4], ['oxygen', 5, 2]]) {
    const result = placeBuilding(state, type, col, row)
    assert.equal(result.error, '')
    state = result.state
  }
  assert.ok(restoreState(JSON.stringify(state)), 'the dense layout is a legal exportable native mission')
  const snapshot = structuredClone(state), model = activity(state)
  const recycling = state.buildings.find((building) => building.type === 'recycling')
  const crew = model.crew.find((actor) => actor.task === 'construction')
  assert.ok(crew, 'the current engineering shift must appear at the active paid site')
  for (const actor of [...model.rovers.filter((rover) => rover.route === 'construction'), crew]) {
    assert.equal(actor.targetUid, recycling.uid)
    assert.deepEqual(actor.workCell, { col: 2, row: 4 }, 'the accessible corner is adjacent tooling space, not a diagonal travel step')
    assert.equal(actor.status, actor.route ? 'active' : 'working')
  }
  validPaths(state, model)
  assert.deepEqual(state, snapshot, 'service routing changes no actual work or stores')
})

test('a valid task with a one-cell route is already at its work port and remains active', () => {
  const placed = placeBuilding(start(), 'storage', 2, 1)
  assert.equal(placed.error, '')
  let state = placed.state
  const uid = state.buildings.at(-1).uid
  // Reserve all other immediate service cells through legal paid commands, so
  // the free hub is the only usable port regardless of camera preference.
  for (const [col, row] of [[1, 0], [2, 0], [3, 0], [2, 2], [3, 2]]) {
    const result = placeBuilding(state, 'storage', col, row)
    assert.equal(result.error, '')
    state = result.state
  }
  assert.ok(restoreState(JSON.stringify(state)))
  const model = activity(state)
  const rover = model.rovers.find((actor) => actor.route === 'construction')
  const engineer = model.crew.find((actor) => actor.task === 'construction')
  assert.ok(engineer)
  for (const actor of [rover, engineer]) {
    assert.equal(actor.targetUid, uid)
    assert.equal(actor.path.length, 1, 'the hub is already a valid adjacent work port')
    assert.deepEqual(actor.path[0], actor.workCell)
    assert.equal(actor.status, actor.route ? 'active' : 'working')
  }
  validPaths(state, model)
})
