import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILDINGS } from '../src/game/buildings.js'
import { isCommissioned } from '../src/game/buildingStatus.js'
import { advanceConstruction, CONSTRUCTION_WORK } from '../src/game/construction.js'
import { createInitialState } from '../src/game/initialState.js'
import { operateSol } from '../src/game/operations.js'
import { buildUtilityNetwork } from '../src/game/utilityNetwork.js'
import { advanceSol, applyManifest, buildingCost, canPlaceBuilding, cancelConstruction, colonyAssessment, colonyProfile, colonyStats, missionObjectives, placeBuilding, restoreState, updateRoverAssignment } from '../src/game/simulation.js'

const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`)
const start = () => applyManifest(createInitialState('american-compact'), 'industrial-seed').state
const queue = (state) => state.buildings.filter((building) => !isCommissioned(building))
const workLeft = (state) => queue(state).reduce((sum, building) => sum + building.construction.requiredWork - building.construction.completedWork, 0)
const build = (state, type, col, row) => {
  const result = placeBuilding(state, type, col, row)
  assert.equal(result.error, '', `${type} must use a legal placement`)
  return result.state
}
const constructionFleet = () => {
  let state = start()
  state = updateRoverAssignment(state, 'water', -1).state
  const result = updateRoverAssignment(state, 'construction', 1)
  assert.equal(result.error, '')
  return result.state
}

test('placement pays once, persists the exact receipt and starts a finite unfinished job', () => {
  const before = constructionFleet(), cost = buildingCost(before, 'nuclear'), snapshot = structuredClone(before)
  const state = build(before, 'nuclear', 4, 2), building = state.buildings.at(-1)
  assert.deepEqual(before, snapshot, 'placement cannot mutate its input')
  assert.deepEqual(building.construction, { requiredWork: CONSTRUCTION_WORK.nuclear, completedWork: 0, paid: cost, startedSol: before.sol })
  close(before.resources.parts - state.resources.parts, cost.parts)
  close(before.resources.cargo - state.resources.cargo, cost.cargo)
  const next = operateSol(state)
  close(next.resources.cargo, state.resources.cargo, 'work must not charge capital again')
  close(next.resources.parts, Math.round((state.resources.parts + colonyStats(state).partsNet) * 10) / 10, 'only the operating ledger changes parts')
  assert.deepEqual(next.buildings.at(-1).construction.paid, cost)
})

test('pending systems provide no production, capacity, maintenance or mission credit', () => {
  // Boundary fixture: every unfinished type is present solely to isolate its
  // exclusion from the operating ledger; this is not campaign qualification.
  const before = start(), baseline = colonyStats(before)
  const jobs = Object.entries(CONSTRUCTION_WORK).map(([type, requiredWork], index) => ({ uid: `pending-${type}`, type, col: index % 9, row: 5, integrity: 100, construction: { requiredWork, completedWork: 0, paid: { ...BUILDINGS[type].cost }, startedSol: 1 } }))
  const state = { ...before, buildings: [...before.buildings, ...jobs] }, stats = colonyStats(state)
  for (const field of ['powerCapacity', 'powerDemand', 'waterCapacity', 'oxygenCapacity', 'crewCapacity', 'batteryCapacity', 'maintenance', 'waterOutput', 'oxygenOutput', 'foodOutput', 'partsOutput']) close(stats[field], baseline[field], field)
  close(stats.labor.demand.engineering, baseline.labor.demand.engineering + 0.5, 'one shared construction engineering shift')
  close(stats.labor.demand.operations, baseline.labor.demand.operations)
  close(stats.labor.demand.support, baseline.labor.demand.support)
  assert.deepEqual(missionObjectives(state).map((objective) => objective.complete), missionObjectives(before).map((objective) => objective.complete))
  for (const job of jobs) assert.equal(stats.production[job.uid]?.online, false, job.type)
})

test('colony identity requires commissioned intact systems and excludes pending or destroyed buildings', () => {
  const before = constructionFleet(), baseline = colonyProfile(before)
  let state = build(before, 'nuclear', 4, 2)
  state = build(state, 'workshop', 2, 2)
  assert.equal(colonyProfile(state), baseline, 'a paid construction queue does not earn the industrial identity')
  for (let guard = 0; queue(state).length && guard < 10; guard += 1) state = operateSol(state)
  assert.equal(queue(state).length, 0)
  assert.equal(colonyProfile(state), 'Industrial Vanguard')
  for (const type of ['nuclear', 'workshop']) {
    const broken = { ...state, buildings: state.buildings.map((building) => building.type === type ? { ...building, integrity: 0 } : building) }
    assert.equal(colonyProfile(broken), baseline, `destroyed ${type} does not retain the industrial identity`)
  }
})

test('construction work is one finite FIFO budget shared across the whole queue', () => {
  let state = constructionFleet()
  state = build(state, 'storage', 2, 2)
  state = build(state, 'nuclear', 4, 2)
  const snapshot = structuredClone(state), nextBuildings = advanceConstruction(state, colonyStats(state))
  assert.deepEqual(state, snapshot, 'work must not mutate saved progress or paid costs')
  const next = { ...state, buildings: nextBuildings }
  close(workLeft(state) - workLeft(next), 2.5, 'two assigned rovers and one half crew work unit')
  assert.equal(isCommissioned(next.buildings.at(-2)), true, 'the first one-unit tank job consumes the first work unit')
  close(next.buildings.at(-1).construction.completedWork, 1.5, 'only the unused budget reaches the second job')
  assert.deepEqual(next.buildings.at(-1).construction.paid, snapshot.buildings.at(-1).construction.paid)
})

test('rover allocation speeds real progress while engineering condition limits it', () => {
  let assisted = build(constructionFleet(), 'nuclear', 4, 2)
  // Boundary comparisons hold the same paid queue constant while varying only
  // shift allocation or injury; no resulting state is used as a campaign.
  const unassisted = { ...assisted, roverAssignments: { water: 2, construction: 0, maintenance: 0, survey: 0 } }
  const tired = { ...assisted, crewMembers: assisted.crewMembers.map((member) => member.cohort === 'engineering' ? { ...member, health: 25, fatigue: 90 } : member) }
  const worked = (state) => workLeft(state) - workLeft({ ...state, buildings: advanceConstruction(state, colonyStats(state)) })
  assert.ok(worked(assisted) > worked(unassisted))
  assert.ok(worked(tired) < worked(assisted))
  assert.ok(worked(tired) >= 0)
})

test('incapacitated engineering cannot turn rover assignments into free construction', () => {
  const state = build(constructionFleet(), 'nuclear', 4, 2)
  for (const predicate of [(member) => member.cohort === 'engineering', () => true]) {
    const down = { ...state, crewMembers: state.crewMembers.map((member) => predicate(member) ? { ...member, health: 0 } : member) }
    const next = { ...down, buildings: advanceConstruction(down, colonyStats(down)) }
    close(workLeft(next), workLeft(down), 'a healthy engineering shift must authorize work')
  }
})

test('queued sites occupy cells but cannot bridge the commissioned utility network', () => {
  let state = build(constructionFleet(), 'storage', 5, 2)
  assert.equal(canPlaceBuilding(state, 'solar', 5, 2).ok, false, 'the reserved cell is occupied')
  assert.equal(buildUtilityNetwork(state.buildings).connectedUids.includes(state.buildings.at(-1).uid), false)
  assert.equal(canPlaceBuilding(state, 'solar', 7, 2).ok, false, 'only the pending site could reach this cell')
  state = operateSol(state)
  assert.equal(isCommissioned(state.buildings.at(-1)), true)
  assert.equal(canPlaceBuilding(state, 'solar', 7, 2).ok, true, 'a commissioned site can extend utilities on the next command')
})

test('a lost utility link preserves queued progress and new bridges cannot pass work within the same sol', () => {
  // Boundary fixture: a previously commissioned relay has been lost, leaving
  // two paid sites in line. It isolates the old-grid reachability rule.
  const before = constructionFleet()
  const job = (uid, col) => ({ uid, type: 'storage', col, row: 2, integrity: 100, construction: { requiredWork: CONSTRUCTION_WORK.storage, completedWork: 0, paid: { parts: 22, cargo: 0.6 }, startedSol: 1 } })
  const state = { ...before, buildings: [before.buildings[0], job('bridge', 3), job('beyond', 5)] }
  const first = { ...state, buildings: advanceConstruction(state, colonyStats(state)) }
  assert.equal(isCommissioned(first.buildings[1]), true)
  close(first.buildings[2].construction.completedWork, 0, 'unused work cannot traverse a just-completed bridge')
  const second = { ...first, buildings: advanceConstruction(first, colonyStats(first)) }
  assert.equal(isCommissioned(second.buildings[2]), true)
  const severed = { ...first, buildings: first.buildings.map((building) => building.uid === 'bridge' ? { ...building, integrity: 0 } : building) }
  assert.deepEqual(advanceConstruction(severed, colonyStats(severed)), severed.buildings, 'a disconnected site cannot spend global work')
})

test('hazards shelter crew work, allow supervised remote rovers and honor the insurer hold', () => {
  const normal = build(constructionFleet(), 'nuclear', 4, 2)
  // Boundary sols isolate weather rules while retaining the paid native job.
  const exposed = { ...normal, sol: 18 }, held = { ...exposed, policyEffects: { restrictedConstructionDuringHazards: true } }
  const worked = (state) => workLeft(state) - workLeft({ ...state, buildings: advanceConstruction(state, colonyStats(state)) })
  close(worked(normal), 2.5)
  close(worked(exposed), 2, 'two remote construction rovers work while crew shelter')
  close(worked(held), 0, 'the accepted insurer veto suspends the queue')
})

test('a newly commissioned generator first affects the following sol production', () => {
  let state = build(constructionFleet(), 'nuclear', 4, 2)
  while (!isCommissioned(state.buildings.at(-1))) {
    const stats = colonyStats(state), next = operateSol(state, stats)
    close(next.resources.parts, Math.round((state.resources.parts + stats.partsNet) * 10) / 10)
    close(stats.powerCapacity, colonyStats(start()).powerCapacity, 'the pre-sol ledger excludes the pending reactor')
    state = next
  }
  assert.ok(colonyStats(state).powerCapacity >= colonyStats(start()).powerCapacity + BUILDINGS.nuclear.power)
  assert.equal(state.buildings.at(-1).construction == null, true, 'commissioning clears its job')
  assert.ok(restoreState(JSON.stringify(state)), 'a commissioned queue is exportable')
})

test('cancel before work refunds the stored capital once and atomically removes the reserved site', () => {
  const before = constructionFleet(), state = build(before, 'storage', 2, 2), snapshot = structuredClone(state), uid = state.buildings.at(-1).uid
  const changedPrices = { ...state, policyEffects: { constructionCargoMultiplier: 2 }, buildDiscounts: {}, crewLeadId: state.crewMembers[0].id }
  const result = cancelConstruction(changedPrices, uid)
  assert.equal(result.error, '')
  assert.deepEqual(state, snapshot)
  close(result.state.resources.parts, before.resources.parts, 'refund uses the receipt despite current prices')
  close(result.state.resources.cargo, before.resources.cargo)
  assert.equal(result.state.buildings.some((building) => building.uid === uid), false)
  assert.equal(cancelConstruction(result.state, uid).state, result.state, 'an absent job cannot be refunded twice')
  const commissioned = cancelConstruction(before, 'solar-1')
  assert.equal(commissioned.state, before)
  assert.ok(commissioned.error)
})

test('cancellation after progress refunds only 75% of unused paid capital rounded down', () => {
  const paidState = build(constructionFleet(), 'nuclear', 4, 2)
  const state = operateSol(paidState), building = state.buildings.at(-1), job = building.construction
  assert.ok(job && job.completedWork > 0 && job.completedWork < job.requiredWork)
  const unused = 1 - job.completedWork / job.requiredWork
  const expected = Object.fromEntries(Object.entries(job.paid).map(([resource, amount]) => [resource, Math.floor((amount * unused * 0.75 + 1e-8) * 10) / 10]))
  const snapshot = structuredClone(state), result = cancelConstruction(state, building.uid)
  assert.equal(result.error, '')
  assert.deepEqual(state, snapshot)
  for (const resource of ['parts', 'cargo']) {
    close(result.state.resources[resource] - state.resources[resource], expected[resource], resource)
    assert.ok(expected[resource] <= job.paid[resource] * unused * 0.75 + 1e-8)
  }
  assert.ok(restoreState(JSON.stringify(result.state)), 'a cancelled mission remains a valid save')
})

test('cancel and rebuild cannot reuse an ID still owned by another queued site', () => {
  let state = build(constructionFleet(), 'storage', 2, 2)
  const cancelledUid = state.buildings.at(-1).uid
  state = build(state, 'storage', 2, 3)
  const retainedUid = state.buildings.at(-1).uid
  state = cancelConstruction(state, cancelledUid).state
  state = build(state, 'storage', 2, 2)
  assert.notEqual(state.buildings.at(-1).uid, retainedUid)
  assert.equal(new Set(state.buildings.map((building) => building.uid)).size, state.buildings.length)
  assert.ok(restoreState(JSON.stringify(state)))
})

test('construction progresses identically in native ticks and the no-delivery operating ledger', () => {
  let state = build(constructionFleet(), 'nuclear', 4, 2)
  // A non-event boundary sol isolates the shared tick implementation.
  state = { ...state, sol: 9 }
  const expected = operateSol(state), actual = advanceSol(state)
  assert.deepEqual(actual.buildings, expected.buildings)
  assert.deepEqual(actual.crewMembers, expected.crewMembers)
  for (const field of ['water', 'oxygen', 'food', 'parts', 'integrity']) close(actual.resources[field], expected.resources[field], field)
  close(actual.batteryCharge, expected.batteryCharge)
  const snapshot = structuredClone(state)
  const assessment = colonyAssessment(state, 5)
  assert.deepEqual(state, snapshot, 'a multisol construction forecast must not spend work, reserves or crew health in the real mission')
  assert.equal(assessment.viable, false, 'future commissioning cannot replace missing current operating systems')
})
