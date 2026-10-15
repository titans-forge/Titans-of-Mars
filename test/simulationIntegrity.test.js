import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILDINGS, BUILD_MENU } from '../src/game/buildings.js'
import { createInitialState } from '../src/game/initialState.js'
import { ensureCrewMembers, crewLead, memberReadiness } from '../src/game/crewMembers.js'
import { manifestsForSponsor } from '../src/game/manifests.js'
import { followOnManifestsForSponsor } from '../src/game/followOnManifests.js'
import { sponsorEventById } from '../src/game/sponsorEvents.js'
import { rivalSettlementFor } from '../src/game/rivalSettlements.js'
import { operationalIncidentById } from '../src/game/operationalIncidents.js'
import { campaignReport, campaignShareText } from '../src/game/campaignReport.js'
import { operateSol } from '../src/game/operations.js'
import { advanceSol, applyManifest, applyFollowOnManifest, applySponsorEventChoice, applyRivalEncounterChoice, applyOperationalIncidentChoice, buildingCost, colonyAssessment, colonyStats, decisionEligibility, decisionOptions, missionObjectives, placeBuilding, updateCrewLead, updateRoverAssignment, SOL_HOURS } from '../src/game/simulation.js'
import { runNativeCampaign } from './helpers/nativeCampaign.js'

const SPONSORS = ['american-compact', 'china-directorate', 'europe-cooperative', 'russia-directorate']
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≠ ${expected}`)
const clone = (state) => structuredClone(state)
const opening = () => applyManifest(createInitialState('american-compact'), 'industrial-seed').state
const placed = (type, col, row, integrity = 100) => ({ uid: `${type}-${col}-${row}`, type, col, row, integrity })
const grade = (report, id) => report.grades.find((item) => item.id === id)
const counts = (members) => members.reduce((result, member) => ({ ...result, [member.cohort]: result[member.cohort] + 1 }), { engineering: 0, operations: 0, support: 0, residents: 0 })

// Boundary fixtures deliberately isolate one rule; these injected fixtures are
// not evidence of a playable campaign or an earned production/mission score.
function processFixture(water) {
  const state = opening()
  return {
    ...state,
    crewLeadId: state.crewMembers.find((member) => member.trait === 'medical').id,
    resources: { ...state.resources, water },
    buildings: [placed('cargo', 1, 2), placed('nuclear', 3, 2), placed('habitat', 3, 3), placed('oxygen', 2, 3), placed('greenhouse', 4, 3)],
  }
}
function batteryFixture(charge, reactor = false) {
  return { ...opening(), batteryCharge: charge, buildings: [placed('cargo', 1, 2), placed('battery', 3, 2), ...(reactor ? [placed('nuclear', 3, 3)] : [])] }
}
let cityRoute
function finishedCity() {
  cityRoute ??= runNativeCampaign('europe-cooperative', 'eu-solar-microgrid', 'eu-consensus-reserve', { solar: true })
  assert.equal(cityRoute.state.outcome, 'permanent-city', 'the reference city must be earned by legal native actions')
  assert.equal(cityRoute.failures.length, 0)
  assert.equal(cityRoute.assessment.independent, true)
  return clone(cityRoute.state)
}

test('zero process water cannot produce oxygen or food, even with full power and staffing', () => {
  const state = processFixture(0), stats = colonyStats(state)
  close(stats.powerRatio, 1, 'process fixture power')
  assert.ok(stats.labor.ratios.operations >= 0.99 && stats.labor.ratios.support >= 0.99)
  close(stats.oxygenOutput, 0, 'oxygen output')
  close(stats.foodOutput, 0, 'food output')
  for (const type of ['oxygen', 'greenhouse']) {
    const row = stats.production[state.buildings.find((building) => building.type === type).uid]
    close(row.waterInput, 0, `${type} input`)
    assert.match(row.reason, /water/i)
  }
  const next = operateSol(state, stats)
  assert.equal(next.resources.water, 0)
  assert.ok(next.resources.oxygen < state.resources.oxygen)
  assert.ok(next.resources.food < state.resources.food)
})

test('partial water first supplies domestic demand and bounds electrolysis and crops by actual input', () => {
  const domestic = 6 * 4.8 + BUILDINGS.habitat.waterUse
  const halfOxygen = processFixture(domestic + BUILDINGS.oxygen.waterUse / 2)
  const oxygenStats = colonyStats(halfOxygen)
  close(oxygenStats.oxygenOutput, BUILDINGS.oxygen.oxygen / 2, 'half-water electrolysis')
  close(oxygenStats.foodOutput, 0, 'crops cannot reuse the same water')
  close(oxygenStats.waterUse, halfOxygen.resources.water, 'all available water is accounted for')
  const halfCrop = processFixture(domestic + BUILDINGS.oxygen.waterUse + BUILDINGS.greenhouse.waterUse / 2)
  const cropStats = colonyStats(halfCrop)
  close(cropStats.oxygenOutput, BUILDINGS.oxygen.oxygen, 'fully supplied oxygen plant')
  close(cropStats.foodOutput, BUILDINGS.greenhouse.food / 2, 'half-supplied greenhouse')
  const inputs = Object.values(cropStats.production).reduce((sum, row) => sum + row.waterInput, 0)
  close(inputs + domestic, halfCrop.resources.water, 'process water is not counted twice')
})

test('a connected but unpowered reclamation plant recovers no water', () => {
  const state = { ...opening(), buildings: [placed('cargo', 1, 2), placed('habitat', 3, 2), placed('recycling', 3, 3)] }
  const stats = colonyStats(state)
  assert.equal(stats.network.connectedUids.length, 3)
  close(stats.powerRatio, 0, 'electrical supply')
  close(stats.waterRecovery, 0, 'unpowered water recovery')
  close(stats.waterUse, 6 * 4.8 + BUILDINGS.habitat.waterUse, 'unrecycled domestic demand')
})

test('battery discharge integrates kW across a full 24.6-hour sol and respects its energy limit', () => {
  assert.equal(SOL_HOURS, 24.6)
  const state = batteryFixture(3 * 24.6), stats = colonyStats(state)
  close(stats.powerDemand, 6, 'cargo and battery demand')
  close(stats.batteryDispatch, 3, 'power available from partial stored energy')
  close(stats.batteryEnergyDispatched, 3 * 24.6, 'dispatched kWh')
  close(stats.powerRatio, 0.5, 'partial electrical coverage')
  close(operateSol(state, stats).batteryCharge, 0, 'empty energy reserve after one sol')
  const charged = batteryFixture(200), full = colonyStats(charged)
  close(full.batteryDispatch, 6, 'full electrical coverage')
  close(full.batteryEnergyDispatched, 6 * 24.6, 'full sol energy')
  close(operateSol(charged, full).batteryCharge, 52.4, 'remaining stored kWh')
})

test('battery charging reports only energy that fits and never invents capacity', () => {
  const nearlyFull = batteryFixture(5990, true), headroom = colonyStats(nearlyFull)
  close(headroom.batteryCapacity, 6000, 'rated energy capacity')
  close(headroom.batteryEnergyCharged, 10, 'accepted charging energy')
  close(operateSol(nearlyFull, headroom).batteryCharge, 6000, 'charged reserve')
  const empty = batteryFixture(0, true), charge = colonyStats(empty)
  close(charge.batteryEnergyCharged, 85 * 24.6, 'rate-limited full-sol charge')
  const damaged = { ...nearlyFull, buildings: nearlyFull.buildings.map((building) => building.type === 'battery' ? { ...building, integrity: 50 } : building) }
  const degraded = colonyStats(damaged)
  close(degraded.storedEnergy, 3000, 'damaged bank clips unusable stored energy')
  close(degraded.batteryEnergyCharged, 0, 'no energy enters a full damaged bank')
  close(operateSol(damaged, degraded).batteryCharge, 3000, 'no unearned energy survives damage')
})

test('advanceSol and the operating forecast share the same reserve, energy and integrity ledger', () => {
  const state = { ...processFixture(0), sol: 9 }
  const expected = operateSol(state)
  const actual = advanceSol(state)
  for (const key of ['water', 'oxygen', 'food', 'parts', 'integrity']) close(actual.resources[key], expected.resources[key], `${key} tick parity`)
  close(actual.batteryCharge, expected.batteryCharge, 'battery tick parity')
  assert.deepEqual(actual.crewMembers, expected.crewMembers, 'health/fatigue depletion must be applied once')
})

test('empty essentials cannot earn permanent-city or A resilience/independence grades at the final review', () => {
  const good = finishedCity(), completedObjectives = missionObjectives(good)
  for (const [resource, system] of [['water', 'ice'], ['oxygen', 'oxygen'], ['food', 'greenhouse']]) {
    const broken = { ...clone(good), sol: 41, outcome: null, resources: { ...good.resources, [resource]: 0 }, buildings: good.buildings.map((building) => building.type === system ? { ...building, integrity: 0 } : building) }
    const beforeReport = campaignReport(broken, completedObjectives)
    assert.equal(colonyAssessment(broken).viable, false, resource)
    assert.ok(grade(beforeReport, 'resilience').score <= 35, resource)
    assert.ok(grade(beforeReport, 'independence').score <= 35, resource)
    const result = advanceSol(broken)
    assert.equal(result.sol, 42)
    assert.equal(result.resources[resource], 0, resource)
    assert.notEqual(result.outcome, 'permanent-city', resource)
    const report = campaignReport(result, missionObjectives(result))
    assert.notEqual(grade(report, 'resilience').grade, 'A', resource)
    assert.notEqual(grade(report, 'independence').grade, 'A', resource)
  }
})

test('a viable city supported by finite reserves remains below A independence', () => {
  const good = finishedCity()
  const buffered = { ...good, buildings: good.buildings.map((building) => building.type === 'oxygen' ? { ...building, integrity: 95 } : building) }
  const assessment = colonyAssessment(buffered), report = campaignReport(buffered, missionObjectives(buffered))
  assert.ok(assessment.stats.oxygenNet < 0)
  assert.equal(assessment.viable, true, 'the healthy reserve supports the 30-sol no-delivery review')
  assert.equal(assessment.independent, false, 'a declining reserve is not local replacement')
  assert.ok(grade(report, 'independence').score < 90)
  assert.match(grade(report, 'independence').explanation, /reserve-supported/i)
})

test('forecast horizon is bounded and depleted cities cannot bypass it with a zero/invalid horizon', () => {
  const good = finishedCity()
  for (const horizon of [0, -2, NaN, Infinity]) {
    const assessment = colonyAssessment({ ...good, resources: { ...good.resources, oxygen: 0 } }, horizon)
    assert.ok(assessment.horizon >= 1 && assessment.horizon <= 365)
    assert.equal(assessment.viable, false)
  }
})

test('all four sponsors can reach A diplomacy with legal campaigns; poor policy scores lower', () => {
  const routes = [
    ['american-compact', 'industrial-seed', 'consolidation-charter'],
    ['china-directorate', 'cn-industrial-base', 'cn-consolidation-plan'],
    ['europe-cooperative', 'eu-solar-microgrid', 'eu-consensus-reserve'],
    ['russia-directorate', 'ru-surface-logistics', 'ru-autonomy-reserve'],
  ]
  for (const [sponsor, openingId, followOn] of routes) {
    const route = sponsor === 'europe-cooperative' ? cityRoute ?? runNativeCampaign(sponsor, openingId, followOn, { solar: true }) : runNativeCampaign(sponsor, openingId, followOn)
    assert.equal(route.failures.length, 0, sponsor)
    assert.equal(grade(route.report, 'diplomacy').grade, 'A', sponsor)
    const rival = rivalSettlementFor(sponsor)
    // Isolate the diplomatic choice at its decision boundary while retaining
    // the sponsor's earned city inventory. This is not a second campaign run.
    const pending = { ...clone(route.state), sol: 27, outcome: null, rivalRelations: rival.startingRelations, strategicPosition: rival.startingPosition, pendingRivalEncounterId: rival.encounter.id, resolvedRivalEncounterIds: [] }
    const poor = applyRivalEncounterChoice(pending, rival.encounter.choices.at(-1).id)
    assert.equal(poor.error, '')
    assert.ok(grade(campaignReport(poor.state, missionObjectives(poor.state)), 'diplomacy').score < grade(route.report, 'diplomacy').score, sponsor)
    const untested = { ...route.state, resolvedRivalEncounterIds: [] }
    assert.ok(grade(campaignReport(untested, missionObjectives(untested)), 'diplomacy').score <= 60, 'an encounter cannot be skipped for a free A')
  }
})

test('named crew cohorts match real labor counts for every sponsor and incoming manifest', () => {
  for (const sponsor of SPONSORS) {
    const initial = createInitialState(sponsor)
    assert.deepEqual(counts(ensureCrewMembers(initial)), initial.crewCohorts, sponsor)
    const state = applyManifest(initial, manifestsForSponsor(sponsor)[0].id).state
    const review = { ...state, sol: 24, phase: 'review', phaseOneCompleted: true, transferWindowPending: true, resources: { ...state.resources, confidence: 100 } }
    for (const followOn of followOnManifestsForSponsor(sponsor)) {
      const result = applyFollowOnManifest(review, followOn.id)
      assert.equal(result.error, '', followOn.id)
      const members = ensureCrewMembers(result.state)
      assert.equal(members.length, result.state.crew, followOn.id)
      assert.equal(new Set(members.map((member) => member.id)).size, result.state.crew)
      assert.deepEqual(counts(members), result.state.crewCohorts, followOn.id)
    }
  }
})

test('incapacitated officers cannot lead or supply hidden trait bonuses; a wholly incapacitated crew provides no shifts', () => {
  const state = opening(), systems = state.crewMembers.find((member) => member.trait === 'systems')
  const dead = { ...state, crewLeadId: systems.id, crewMembers: state.crewMembers.map((member) => member.id === systems.id ? { ...member, health: 0 } : member) }
  assert.equal(memberReadiness(dead.crewMembers.find((member) => member.id === systems.id)), 0)
  assert.notEqual(crewLead(dead)?.id, systems.id)
  assert.notEqual(crewLead(dead)?.trait, 'systems')
  const selection = updateCrewLead(dead, systems.id)
  assert.equal(selection.state, dead)
  assert.match(selection.error, /active mission officer/)
  const allDown = { ...state, crewMembers: state.crewMembers.map((member) => ({ ...member, health: 0 })) }
  assert.equal(crewLead(allDown), null)
  for (const [role, available] of Object.entries(colonyStats(allDown).labor.available)) close(available, 0, `${role} has no available worker`)
})

test('discount combinations never make construction free and paid support remains committed until a sol passes', () => {
  let state = applyManifest(createInitialState('american-compact'), 'crew-reserve').state
  state = updateRoverAssignment(state, 'water', -1).state
  state = updateRoverAssignment(state, 'construction', 1).state
  const logistics = state.crewMembers.find((member) => member.trait === 'logistics')
  state = updateCrewLead(state, logistics.id).state
  for (const type of BUILD_MENU) {
    const cost = buildingCost(state, type)
    assert.ok(cost.parts > 0 && cost.cargo > 0, type)
    assert.ok(cost.parts >= Math.round(BUILDINGS[type].cost.parts * 0.2 * 10) / 10, type)
    assert.ok(cost.cargo >= Math.round(BUILDINGS[type].cost.cargo * 0.2 * 10) / 10, type)
  }
  const cost = buildingCost(state, 'storage'), constructed = placeBuilding(state, 'storage', 2, 2)
  assert.equal(constructed.error, '')
  close(state.resources.parts - constructed.state.resources.parts, cost.parts, 'actual paid parts')
  close(state.resources.cargo - constructed.state.resources.cargo, cost.cargo, 'actual paid cargo')
  const recall = updateRoverAssignment(constructed.state, 'construction', -1)
  const transfer = updateCrewLead(constructed.state, state.crewMembers[0].id)
  assert.equal(recall.state, constructed.state)
  assert.match(recall.error, /committed/)
  assert.equal(transfer.state, constructed.state)
  assert.match(transfer.error, /committed/)
  const next = advanceSol(constructed.state)
  assert.equal(updateRoverAssignment(next, 'construction', -1).error, '')
  assert.equal(updateCrewLead(next, state.crewMembers[0].id).error, '')
})

test('unaffordable construction and sponsor/rival/incident choices are atomic and preserve pending decisions', () => {
  const emptyParts = { ...opening(), resources: { ...opening().resources, parts: 0 } }
  assert.equal(placeBuilding(emptyParts, 'storage', 2, 2).state, emptyParts)
  const cases = [
    { field: 'pendingEventId', id: 'us-congressional-audit', choice: 'publish', handler: applySponsorEventChoice, sol: 12 },
    { field: 'pendingRivalEncounterId', id: 'us-orbital-relay', choice: 'share', handler: applyRivalEncounterChoice, sol: 27 },
    { field: 'pendingOperationalIncidentId', id: 'recycler-biofilm', choice: 'sterilize', handler: applyOperationalIncidentChoice, sol: 32 },
  ]
  for (const item of cases) {
    const state = { ...clone(emptyParts), sol: item.sol, [item.field]: item.id }
    const before = clone(state), result = item.handler(state, item.choice)
    assert.equal(result.state, state, item.id)
    assert.match(result.error, /requires/i)
    assert.deepEqual(state, before, item.id)
    assert.equal(result.state[item.field], item.id)
  }
})

test('quoted multi-resource costs require every resource; exact payment is allowed without a negative reserve', () => {
  const incident = operationalIncidentById('recycler-biofilm')
  const pending = { ...opening(), sol: 32, pendingOperationalIncidentId: incident.id }
  const short = { ...pending, resources: { ...pending.resources, water: 110, parts: 7.9 } }
  const choice = incident.choices.find((item) => item.id === 'sterilize')
  assert.equal(decisionEligibility(short, choice).eligible, false)
  assert.equal(applyOperationalIncidentChoice(short, choice.id).state, short)
  const exact = { ...pending, resources: { ...pending.resources, water: 110, parts: 8 } }
  const paid = applyOperationalIncidentChoice(exact, choice.id)
  assert.equal(paid.error, '')
  assert.equal(paid.state.resources.water, 0)
  assert.equal(paid.state.resources.parts, 0)
  assert.equal(paid.state.pendingOperationalIncidentId, null)
})

test('a no-supplies emergency fallback resolves an otherwise unaffordable event without minting resources', () => {
  const incident = operationalIncidentById('greenhouse-blight')
  const state = { ...opening(), sol: 32, phase: 'expansion', pendingOperationalIncidentId: incident.id }
  state.resources = { ...state.resources, food: 0, cargo: 0 }
  assert.ok(incident.choices.every((choice) => !decisionEligibility(state, choice).eligible))
  const fallback = decisionOptions(state, incident).find((choice) => choice.id === 'emergency-standdown')
  assert.ok(fallback)
  assert.equal(decisionEligibility(state, fallback).eligible, true)
  const result = applyOperationalIncidentChoice(state, fallback.id)
  assert.equal(result.error, '')
  assert.equal(result.state.pendingOperationalIncidentId, null)
  assert.ok(result.state.resolvedOperationalIncidentIds.includes(incident.id))
  for (const resource of ['water', 'oxygen', 'food', 'parts', 'cargo']) close(result.state.resources[resource], state.resources[resource], `${resource} fallback preserves inventory`)
  assert.ok(result.state.resources.integrity < state.resources.integrity)
  assert.ok(result.state.resources.confidence < state.resources.confidence)
  const affordable = { ...state, resources: { ...state.resources, food: 35 } }
  assert.equal(decisionOptions(affordable, incident).some((choice) => choice.id === fallback.id), false)
  assert.equal(applyOperationalIncidentChoice(affordable, fallback.id).state, affordable)
  assert.equal(decisionOptions(state, sponsorEventById('us-congressional-audit')).some((choice) => choice.id === fallback.id), false, 'a genuine free alternative takes precedence over the emergency fallback')
})


test('a fragile final result cannot be averaged into an overall A despite an otherwise viable city', () => {
  const good = finishedCity()
  const fragile = { ...good, outcome: 'fragile-city', resources: { ...good.resources, parts: 59.9 } }
  const objectives = missionObjectives(fragile), report = campaignReport(fragile, objectives)
  assert.equal(colonyAssessment(fragile).viable, true, 'this boundary isolates the required parts objective from operating viability')
  assert.deepEqual(objectives.filter((item) => !item.complete).map((item) => item.id), ['parts'])
  assert.ok(report.overall <= 69, 'a failed campaign objective must cap the final overall result')
  assert.notEqual(report.overallGrade, 'A')
  assert.match(report.overallExplanation, /objective|viability/i)
  const text = campaignShareText(fragile, report)
  assert.match(text, /First City: fragile city\./)
  assert.doesNotMatch(text, /: permanent city\./)
  const failed = { ...fragile, outcome: 'failure' }
  assert.match(campaignShareText(failed, campaignReport(failed, objectives)), /First City: mission lost\./)
})

test('any empty essential caps the whole report, even if a stale outcome says permanent city', () => {
  const good = finishedCity()
  for (const resource of ['water', 'oxygen', 'food']) {
    const empty = { ...clone(good), resources: { ...good.resources, [resource]: 0 } }
    const report = campaignReport(empty, missionObjectives(empty))
    assert.ok(report.overall <= 35, resource)
    assert.equal(report.overallGrade, 'F', resource)
    assert.match(report.overallExplanation, /essential reserve is empty/i)
  }
})

test('battery thermal isolation removes up to 2 MWh of actual stored energy and never goes negative', () => {
  const incident = operationalIncidentById('battery-thermal-run')
  const option = incident.choices.find((choice) => choice.id === 'offline')
  assert.equal(option.batteryCharge, -2000)
  assert.match(option.description, /2 MWh/)
  const city = finishedCity()
  for (const stored of [0, 700, 2000, 2600, 6000]) {
    const state = { ...clone(city), sol: 32, outcome: null, pendingOperationalIncidentId: incident.id, batteryCharge: stored }
    const result = applyOperationalIncidentChoice(state, option.id)
    assert.equal(result.error, '')
    close(result.state.batteryCharge, Math.max(0, stored - 2000), `${stored} kWh initial thermal isolation`)
    close(state.batteryCharge - result.state.batteryCharge, Math.min(2000, stored), 'only existing energy can be discharged')
    assert.ok(result.state.batteryCharge >= 0 && result.state.batteryCharge <= colonyStats(result.state).batteryCapacity)
    close(state.resources.parts - result.state.resources.parts, 10, 'contactor replacement cost')
    assert.equal(result.state.pendingOperationalIncidentId, null)
  }
})

test('battery incident damage cannot retain stored energy above the newly usable bank capacity', () => {
  const incident = operationalIncidentById('battery-thermal-run')
  const state = { ...finishedCity(), sol: 32, outcome: null, pendingOperationalIncidentId: incident.id, batteryCharge: 6000 }
  assert.equal(colonyStats(state).batteryCapacity, 6000)
  const result = applyOperationalIncidentChoice(state, 'bypass')
  assert.equal(result.error, '')
  assert.ok(colonyStats(result.state).batteryCapacity < colonyStats(state).batteryCapacity, 'the bank actually takes damage')
  assert.ok(result.state.batteryCharge >= 0)
  assert.ok(result.state.batteryCharge <= colonyStats(result.state).batteryCapacity, 'the incident must discard inaccessible energy immediately, not wait for the next tick')
})
