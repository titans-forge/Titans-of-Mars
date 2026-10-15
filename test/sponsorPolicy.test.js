import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILD_MENU } from '../src/game/buildings.js'
import { createInitialState } from '../src/game/initialState.js'
import { sponsorEventById } from '../src/game/sponsorEvents.js'
import { rivalEncounterById } from '../src/game/rivalSettlements.js'
import { operationalIncidentById } from '../src/game/operationalIncidents.js'
import { createSavePersistence } from '../src/game/persistence.js'
import { advanceSol, applyManifest, applyFollowOnManifest, applySponsorEventChoice, applyRivalEncounterChoice, applyOperationalIncidentChoice, buildingCost, canPlaceBuilding, colonyStats, decisionOptions, decisionEligibility, placeBuilding, repairBuilding, restoreState, updateCrewLead, updateCrossTraining, updateRoverAssignment } from '../src/game/simulation.js'
import { runNativeCampaign } from './helpers/nativeCampaign.js'

let shutdownState
// Replay the legal native campaign ledger only as far as the actual Sol30 decision.
// No ice, stores, structures, time, pending events or policy flags are injected.
function pendingShutdown() {
  if (shutdownState) return structuredClone(shutdownState)
  const route = runNativeCampaign('american-compact', 'industrial-seed', 'machine-economy')
  let state = createInitialState('american-compact')
  const apply = (result) => { assert.equal(result.error, ''); state = result.state }
  for (const action of route.actions) {
    while (state.sol < action.sol) {
      const advanced = advanceSol(state)
      assert.equal(advanced.sol, state.sol + 1)
      state = advanced
    }
    if (state.pendingEventId === 'us-insurance-control') { shutdownState = state; return structuredClone(state) }
    if (action.action === 'authorize opening') apply(applyManifest(state, action.openingId))
    else if (action.action === 'authorize follow-on') apply(applyFollowOnManifest(state, action.followOnId))
    else if (action.action === 'assign rover' || action.action === 'recall rover') apply(updateRoverAssignment(state, action.route, action.action === 'assign rover' ? 1 : -1))
    else if (action.action === 'set mission lead' || action.action === 'balance lead') apply(updateCrewLead(state, action.memberId))
    else if (action.action === 'balance training') apply(updateCrossTraining(state, action.focus))
    else if (action.action === 'construct') apply(placeBuilding(state, action.type, action.col, action.row))
    else if (action.action === 'repair') apply(repairBuilding(state, action.uid))
    else if (action.action === 'resolve decision') apply((action.kind === 'sponsor' ? applySponsorEventChoice : action.kind === 'rival' ? applyRivalEncounterChoice : applyOperationalIncidentChoice)(state, action.choice))
    else assert.fail(`Unknown recorded legal command: ${action.action}`)
  }
  assert.fail('Actual shutdown decision was never reached')
}
function choosePolicy(id) { const result = applySponsorEventChoice(pendingShutdown(), id); assert.equal(result.error, ''); return result.state }
function advanceTo(state, sol) {
  for (let guard = 0; state.sol < sol && guard < 20; guard += 1) {
    let definition, handler
    if (state.pendingOperationalIncidentId) { definition = operationalIncidentById(state.pendingOperationalIncidentId); handler = applyOperationalIncidentChoice }
    else if (state.pendingEventId) { definition = sponsorEventById(state.pendingEventId); handler = applySponsorEventChoice }
    else if (state.pendingRivalEncounterId) { definition = rivalEncounterById(state.pendingRivalEncounterId); handler = applyRivalEncounterChoice }
    if (definition) { const option = decisionOptions(state, definition).find((choice) => decisionEligibility(state, choice).eligible); const result = handler(state, option.id); assert.equal(result.error, ''); state = result.state }
    else { const next = advanceSol(state); assert.equal(next.sol, state.sol + 1); state = next }
  }
  assert.equal(state.sol, sol)
  return state
}
const legalCell = (state, type) => {
  for (let row = 0; row < 6; row += 1) for (let col = 0; col < 9; col += 1) if (canPlaceBuilding(state, type, col, row).ok) return { col, row }
  return null
}

test('shutdown policy has actual continuing costs while self-insurance retains a paid operational benefit', () => {
  const pending = pendingShutdown(), insured = choosePolicy('accept'), local = choosePolicy('self-insure')
  assert.equal(insured.resources.parts, pending.resources.parts + 30)
  assert.equal(local.resources.parts, pending.resources.parts - 25)
  assert.equal(insured.policyEffects.constructionCargoMultiplier, 1.25)
  assert.equal(insured.policyEffects.restrictedConstructionDuringHazards, true)
  assert.equal(local.policyEffects.maintenanceMultiplier, 0.85)
  assert.equal(local.policyEffects.restrictedConstructionDuringHazards, false)
  for (const type of BUILD_MENU) {
    const before = buildingCost(pending, type), after = buildingCost(insured, type), self = buildingCost(local, type)
    assert.equal(after.cargo, Math.round(before.cargo * 1.25 * 10) / 10)
    assert.equal(after.parts, before.parts)
    assert.equal(self.cargo, before.cargo)
  }
  const originalMaintenance = colonyStats(insured).maintenance
  assert.ok(Math.abs(colonyStats(local).maintenance - originalMaintenance * 0.85) <= 0.11)
  assert.ok(colonyStats(local).partsNet > colonyStats(insured).partsNet)
})

test('accepted insurance charges the displayed cargo cost through the actual construction transaction', () => {
  const state = choosePolicy('accept'), cell = legalCell(state, 'storage')
  assert.ok(cell)
  const cost = buildingCost(state, 'storage'), result = placeBuilding(state, 'storage', cell.col, cell.row)
  assert.equal(result.error, '')
  assert.ok(Math.abs(result.state.resources.cargo - (state.resources.cargo - cost.cargo)) < 0.11)
  assert.ok(Math.abs(result.state.resources.parts - (state.resources.parts - cost.parts)) < 0.11)
})

test('actual debris alert suspends insured new construction while repairs, current production and self-insured building remain available', () => {
  const insured = advanceTo(choosePolicy('accept'), 34), local = advanceTo(choosePolicy('self-insure'), 34)
  assert.equal(colonyStats(insured).debris, true)
  const blocked = canPlaceBuilding(insured, 'solar', 4, 0)
  assert.equal(blocked.ok, false)
  assert.match(blocked.reason, /insurance shutdown clause.*active dust or debris/i)
  const denied = placeBuilding(insured, 'solar', 4, 0)
  assert.strictEqual(denied.state, insured, 'veto must spend no cargo and change no state')
  assert.ok(colonyStats(insured).partsOutput > 0)
  const damaged = insured.buildings.find((building) => building.integrity < 100)
  assert.ok(damaged)
  assert.equal(repairBuilding(insured, damaged.uid).error, '', 'veto must not block safety repairs')
  assert.ok(legalCell(local, 'solar'), 'self-insurance keeps actual new-construction authority')
  const afterAlert = advanceTo(insured, 37)
  assert.ok(legalCell(afterAlert, 'solar'), 'the insurer construction veto ends with the actual alert')
})

test('policy effects survive guarded save/load; old resolved-policy saves without the new flag remain valid', () => {
  const store = new Map(), storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) }
  const persistence = createSavePersistence({ storage, restore: restoreState })
  for (const id of ['accept', 'self-insure']) {
    const state = choosePolicy(id)
    assert.equal(persistence.save(state).status, 'saved')
    const loaded = persistence.load()
    assert.deepEqual(loaded.state.policyEffects, state.policyEffects)
    assert.equal(loaded.state.speed, 0)
  }
  const legacy = choosePolicy('accept')
  delete legacy.policyEffects
  assert.ok(restoreState(JSON.stringify(legacy)))
  const invalid = choosePolicy('accept')
  invalid.policyEffects.restrictedConstructionDuringHazards = 'true'
  assert.equal(restoreState(JSON.stringify(invalid)), null)
})

test('both permanent consequences are readable before committing the decision', () => {
  const choices = sponsorEventById('us-insurance-control').choices
  const insured = choices.find((choice) => choice.id === 'accept'), local = choices.find((choice) => choice.id === 'self-insure')
  assert.match(insured.description, /25%/)
  assert.match(insured.policy.description, /dust or debris/)
  assert.match(insured.policy.description, /repairs/)
  assert.match(local.description, /15%/)
  assert.match(local.policy.description, /normal cargo/)
})
