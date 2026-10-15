import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState } from '../src/game/initialState.js'
import {
  advanceSol,
  applyFollowOnManifest,
  applyManifest,
  applyOperationalIncidentChoice,
  applyRivalEncounterChoice,
  applySponsorEventChoice,
  buildingEfficiency,
  buildingCost,
  buildingRepairCost,
  canPlaceBuilding,
  colonyProfile,
  colonyStats,
  decisionOptions,
  decisionEligibility,
  followOnEligibility,
  isDebrisActive,
  isStormActive,
  missionObjectives,
  placeBuilding,
  repairBuilding,
  restoreState,
  serializeState,
  updateCrossTraining,
  updateCrewLead,
  updateRoverAssignment,
} from '../src/game/simulation.js'
import { campaignReport, campaignShareText } from '../src/game/campaignReport.js'
import { marsOrder, rivalEncounterById, rivalSettlementFor } from '../src/game/rivalSettlements.js'
import { operationalIncidentAt, operationalIncidentById } from '../src/game/operationalIncidents.js'
import { sponsorEventById, sponsorEventsFor } from '../src/game/sponsorEvents.js'
import { siteForSponsor } from '../src/game/siteFeatures.js'
import { buildUtilityNetwork } from '../src/game/utilityNetwork.js'
import { runNativeCampaign } from './helpers/nativeCampaign.js'

// Boundary tests below isolate terrain and economy rules with confirmed sites.
// Campaign qualification uses untouched initial states in runNativeCampaign.
function startMission(manifestId = 'industrial-seed', sponsorId = 'american-compact') {
  const initial = createInitialState(sponsorId)
  initial.surveyedFeatureIds = siteForSponsor(sponsorId).features.filter((feature) => feature.kind === 'ice').map((feature) => feature.id)
  return applyManifest(initial, manifestId).state
}

function corePlacements(state) {
  const ice = siteForSponsor(state.sponsorId).features.filter((feature) => feature.kind === 'ice')[1]
  return [['nuclear', 4, 0], ['ice', ice.col, ice.row], ['habitat', 5, 3], ['oxygen', 4, 2]]
}

function resolvePendingDecision(state, choiceIndex = 0) {
  let next = state
  if (next.pendingEventId) {
    const event = sponsorEventById(next.pendingEventId)
    next = applySponsorEventChoice(next, (decisionOptions(next, event).filter((choice) => decisionEligibility(next, choice).eligible)[choiceIndex] ?? decisionOptions(next, event).find((choice) => decisionEligibility(next, choice).eligible)).id).state
  }
  if (next.pendingRivalEncounterId) {
    const encounter = rivalEncounterById(next.pendingRivalEncounterId)
    next = applyRivalEncounterChoice(next, (decisionOptions(next, encounter).filter((choice) => decisionEligibility(next, choice).eligible)[choiceIndex] ?? decisionOptions(next, encounter).find((choice) => decisionEligibility(next, choice).eligible)).id).state
  }
  if (next.pendingOperationalIncidentId) {
    const incident = operationalIncidentById(next.pendingOperationalIncidentId)
    next = applyOperationalIncidentChoice(next, (decisionOptions(next, incident).filter((choice) => decisionEligibility(next, choice).eligible)[choiceIndex] ?? decisionOptions(next, incident).find((choice) => decisionEligibility(next, choice).eligible)).id).state
  }
  return next
}

function advanceCampaign(state, choiceIndex = 0) {
  return resolvePendingDecision(advanceSol(state), choiceIndex)
}

function commissionBoundaryQueue(state) {
  let guard = 0
  while (state.buildings.some((building) => building.construction)) {
    assert.ok(guard++ < 30, 'boundary queue must progress through actual elapsed sols')
    const next = advanceCampaign(state)
    assert.equal(next.sol, state.sol + 1)
    state = next
  }
  return state
}

function advanceMaintainedCampaign(state, choiceIndex = 0) {
  let next = advanceCampaign(state, choiceIndex)
  const damaged = next.buildings.find((building) => building.integrity < 100)
  if (damaged) {
    const repaired = repairBuilding(next, damaged.uid)
    if (!repaired.error) next = repaired.state
  }
  return next
}

function reachSecondWindow(manifestId = 'industrial-seed', sponsorId = 'american-compact') {
  const route = runNativeCampaign(sponsorId, manifestId, null, { stopAt: 24 })
  assert.equal(route.failures.length, 0, route.failures.join('; '))
  assert.ok(route.checkpoints.review, 'native construction and survey must earn the second window')
  return structuredClone(route.checkpoints.review)
}

function prepareExpansion(manifestId, openingManifestId = 'industrial-seed', sponsorId = 'american-compact') {
  const route = runNativeCampaign(sponsorId, openingManifestId, manifestId)
  assert.equal(route.failures.length, 0, route.failures.join('; '))
  assert.ok(route.checkpoints.expansion, 'native follow-on authority must be earned')
  return structuredClone(route.checkpoints.expansion)
}

test('initial colony has a positive clear-weather power reserve', () => {
  const state = createInitialState()
  const stats = colonyStats(state)
  assert.equal(state.sol, 1)
  assert.equal(stats.powerCapacity, 55)
  assert.equal(stats.powerDemand, 8)
  assert.ok(stats.powerRatio >= 1)
})

test('placement spends cargo and parts and rejects occupied cells', () => {
  const initial = startMission()
  const result = placeBuilding(initial, 'habitat', 5, 2)
  assert.equal(result.error, '')
  assert.equal(result.state.resources.parts, 344)
  assert.equal(result.state.resources.cargo, 12)
  assert.equal(result.state.buildings.at(-1).type, 'habitat')
  assert.equal(canPlaceBuilding(result.state, 'oxygen', 5, 2).ok, false)
})

test('surface operations remain locked until Earth commits a manifest', () => {
  const initial = createInitialState()
  assert.equal(canPlaceBuilding(initial, 'habitat', 5, 2).ok, false)
  assert.equal(advanceSol(initial), initial)
})

test('sponsor selection establishes distinct missions and gates national doctrines', () => {
  const uncommitted = createInitialState()
  const american = createInitialState('american-compact')
  const chinese = createInitialState('china-directorate')
  const european = createInitialState('europe-cooperative')
  const russian = createInitialState('russia-directorate')

  assert.equal(applyManifest(uncommitted, 'industrial-seed').error, 'Choose a founding mission first.')
  assert.equal(american.settlementName, 'Ares Pathfinder')
  assert.equal(american.earthYear, 2033)
  assert.equal(chinese.settlementName, 'Tianwen Settlement')
  assert.equal(chinese.earthYear, 2034)
  assert.equal(chinese.resources.confidence, 82)
  assert.equal(chinese.crossTraining, 'operations')
  assert.deepEqual(chinese.roverAssignments, { water: 1, construction: 0, maintenance: 1, survey: 0 })
  assert.equal(european.settlementName, 'Kepler Settlement')
  assert.equal(european.earthYear, 2036)
  assert.equal(european.resources.cargo, 8)
  assert.equal(european.crewCohorts.engineering, 3)
  assert.deepEqual(european.roverAssignments, { water: 0, construction: 1, maintenance: 1, survey: 0 })
  assert.equal(russian.settlementName, 'Zvezda Settlement')
  assert.equal(russian.earthYear, 2038)
  assert.equal(russian.resources.confidence, 66)
  assert.equal(russian.resources.cargo, 7.4)
  assert.deepEqual(russian.roverAssignments, { water: 1, construction: 0, maintenance: 1, survey: 0 })
  assert.match(applyManifest(chinese, 'industrial-seed').error, /another founding sponsor/)
  assert.match(applyManifest(american, 'cn-industrial-base').error, /another founding sponsor/)
  assert.match(applyManifest(european, 'baseload-first').error, /another founding sponsor/)
  assert.match(applyManifest(russian, 'eu-precision-industry').error, /another founding sponsor/)
})

test('the utility grid makes placement spatial and keeps isolated structures offline', () => {
  const state = startMission()
  const network = buildUtilityNetwork(state.buildings)
  assert.equal(network.online, 3)
  assert.equal(network.isolatedUids.length, 0)
  assert.equal(canPlaceBuilding(state, 'workshop', 7, 5).ok, false)
  assert.match(canPlaceBuilding(state, 'workshop', 7, 5).reason, /utility-grid reach/)
  assert.equal(canPlaceBuilding(state, 'workshop', 5, 2).ok, true)

  const isolated = {
    ...state,
    buildings: [...state.buildings, { uid: 'workshop-isolated', type: 'workshop', col: 7, row: 5, integrity: 100 }],
  }
  const isolatedStats = colonyStats(isolated)
  assert.deepEqual(isolatedStats.network.isolatedUids, ['workshop-isolated'])
  assert.equal(isolatedStats.partsNet, colonyStats(state).partsNet)
})

test('rover dispatch changes hauling, construction, and maintenance economics', () => {
  let state = startMission()
  state = placeBuilding(state, 'ice', 5, 1).state
  assert.match(updateRoverAssignment(state, 'construction', -1).error, /committed/i)
  state = commissionBoundaryQueue(state)
  const supportedWater = colonyStats(state).waterNet
  const assistedCost = buildingCost(state, 'habitat')

  state = updateRoverAssignment(state, 'water', -1).state
  assert.ok(colonyStats(state).waterNet < supportedWater)
  state = updateRoverAssignment(state, 'maintenance', 1).state
  assert.ok(colonyStats(state).partsNet > colonyStats({ ...state, roverAssignments: { ...state.roverAssignments, maintenance: 0 } }).partsNet)

  state = updateRoverAssignment(state, 'construction', -1).state
  const unassistedCost = buildingCost(state, 'habitat')
  assert.ok(unassistedCost.parts > assistedCost.parts)
  assert.ok(unassistedCost.cargo > assistedCost.cargo)
  assert.equal(updateRoverAssignment(state, 'maintenance', 1).error, '')
  const fullyAssigned = updateRoverAssignment(updateRoverAssignment(state, 'maintenance', 1).state, 'water', 1).state
  assert.match(updateRoverAssignment(fullyAssigned, 'water', 1).error, /Recall a rover/)
})

test('surveyed terrain controls ice placement and rewards solar ridges', () => {
  const unsurveyed = applyManifest(createInitialState('american-compact'), 'industrial-seed').state
  assert.match(canPlaceBuilding(unsurveyed, 'ice', 5, 1).reason, /rover-confirmed ice lens/)
  const state = startMission()
  assert.match(canPlaceBuilding(state, 'ice', 5, 2).reason, /rover-confirmed ice lens/)
  assert.equal(canPlaceBuilding(state, 'ice', 5, 1).ok, true)
  assert.match(canPlaceBuilding(state, 'habitat', 5, 1).reason, /reserved/)

  const westIce = commissionBoundaryQueue(placeBuilding(state, 'ice', 1, 5).state)
  const centralIce = commissionBoundaryQueue(placeBuilding(state, 'ice', 5, 1).state)
  assert.ok(colonyStats(centralIce).waterNet > colonyStats(westIce).waterNet)

  const normalSolar = commissionBoundaryQueue(placeBuilding(state, 'solar', 4, 0).state)
  const ridgeSolar = commissionBoundaryQueue(placeBuilding(state, 'solar', 5, 0).state)
  assert.ok(colonyStats(ridgeSolar).powerCapacity > colonyStats(normalSolar).powerCapacity)
})

test('crew composition and cross-training change settlement labor capacity', () => {
  let state = startMission()
  corePlacements(state).forEach(([type, col, row]) => { state = placeBuilding(state, type, col, row).state })
  state = commissionBoundaryQueue(state)
  const staffed = colonyStats(state)
  assert.equal(Object.values(state.crewCohorts).reduce((total, count) => total + count, 0), state.crew)
  assert.equal(staffed.labor.ratios.operations, 1)

  const shortOperators = { ...state, crewCohorts: { ...state.crewCohorts, operations: 1 } }
  assert.ok(colonyStats(shortOperators).waterNet < staffed.waterNet)
  const operationsFocus = updateCrossTraining(shortOperators, 'operations').state
  assert.ok(colonyStats(operationsFocus).labor.ratios.operations > colonyStats(shortOperators).labor.ratios.operations)
  assert.match(updateCrossTraining(state, 'invalid-role').error, /valid cross-training focus/)
})

test('the three transfer manifests apply distinct deterministic economies', () => {
  const power = startMission('baseload-first')
  const life = startMission('crew-reserve')
  const industry = startMission('industrial-seed')

  assert.deepEqual(power.resources, { water: 2400, oxygen: 1840, food: 410, parts: 290, cargo: 11.8, confidence: 73, integrity: 100 })
  assert.deepEqual(life.resources, { water: 3300, oxygen: 2550, food: 640, parts: 260, cargo: 9.8, confidence: 76, integrity: 100 })
  assert.deepEqual(industry.resources, { water: 2350, oxygen: 1780, food: 440, parts: 410, cargo: 14, confidence: 67, integrity: 100 })
  assert.deepEqual(buildingCost(power, 'nuclear'), { parts: 36, cargo: 1.6 })
  assert.deepEqual(buildingCost(life, 'storage'), { parts: 6, cargo: 0.3 })
  assert.deepEqual(buildingCost(industry, 'workshop'), { parts: 26, cargo: 0.8 })
  assert.equal(applyManifest(power, 'crew-reserve').error, 'A transfer manifest is already committed.')
})

test('the Sol 18 dust front sharply reduces solar generation', () => {
  const clear = createInitialState()
  const storm = { ...clear, sol: 18 }
  assert.equal(isStormActive(clear.sol), false)
  assert.equal(isStormActive(storm.sol), true)
  assert.equal(colonyStats(storm).powerCapacity, 13.4)
})

test('the Sol 34 debris front increases maintenance demand', () => {
  const state = reachSecondWindow()
  const expansion = applyFollowOnManifest(state, 'consolidation-charter').state
  assert.equal(isDebrisActive(33), false)
  assert.equal(isDebrisActive(34), true)
  assert.ok(colonyStats({ ...expansion, sol: 34 }).partsNet < colonyStats({ ...expansion, sol: 33 }).partsNet)
})

test('damaged production equipment loses efficiency until repaired', () => {
  const state = startMission()
  const damaged = {
    ...state,
    buildings: state.buildings.map((building) => building.uid === 'solar-1' ? { ...building, integrity: 50 } : building),
  }
  assert.equal(buildingEfficiency(50), 0.5)
  assert.ok(colonyStats(damaged).powerCapacity < colonyStats(state).powerCapacity)

  const costWithoutMaintenance = buildingRepairCost(damaged, 'solar-1')
  const maintained = { ...damaged, roverAssignments: { water: 1, construction: 0, maintenance: 1 } }
  assert.ok(buildingRepairCost(maintained, 'solar-1') < costWithoutMaintenance)

  const repaired = repairBuilding(damaged, 'solar-1')
  assert.equal(repaired.error, '')
  assert.equal(repaired.state.buildings.find((building) => building.uid === 'solar-1').integrity, 100)
  assert.equal(repaired.state.resources.parts, state.resources.parts - costWithoutMaintenance)
  assert.match(repaired.state.log[0].message, /restored to full operating integrity/)
})

test('maintenance rover assignment reduces dust abrasion', () => {
  let exposed = startMission()
  let protectedState = { ...startMission(), roverAssignments: { water: 1, construction: 0, maintenance: 1 } }
  while (exposed.sol < 18) exposed = advanceCampaign(exposed)
  while (protectedState.sol < 18) protectedState = advanceCampaign(protectedState)
  assert.equal(exposed.buildings.find((building) => building.uid === 'solar-1').integrity, 86)
  assert.equal(protectedState.buildings.find((building) => building.uid === 'solar-1').integrity, 90)
})

test('the debris front damages and selects a real structure for repair', () => {
  let state = prepareExpansion('consolidation-charter')
  while (state.sol < 34) state = advanceCampaign(state)
  const damaged = state.buildings.find((building) => building.uid === state.selectedUid)
  assert.equal(state.sol, 34)
  assert.ok(damaged.integrity < 100)
  assert.ok(buildingRepairCost(state, damaged.uid) > 0)
  assert.match(state.log[0].message, /debris strike/)
})

test('each sponsor receives one survival crisis and one expansion crisis', () => {
  ;['american-compact', 'china-directorate', 'europe-cooperative', 'russia-directorate'].forEach((sponsorId) => {
    const events = sponsorEventsFor(sponsorId)
    assert.equal(events.length, 2, sponsorId)
    assert.deepEqual(events.map(({ sol, phase }) => ({ sol, phase })), [
      { sol: 12, phase: 'survival' },
      { sol: 30, phase: 'expansion' },
    ], sponsorId)
  })
})

test('a sponsor crisis pauses command until a permanent choice is recorded', () => {
  let state = startMission()
  corePlacements(state).forEach(([type, col, row]) => { state = placeBuilding(state, type, col, row).state })
  while (state.sol < 11) state = advanceCampaign(state)
  state = advanceSol(state)

  assert.equal(state.pendingEventId, 'us-congressional-audit')
  assert.equal(state.speed, 0)
  assert.equal(advanceSol(state), state)
  assert.equal(canPlaceBuilding(state, 'storage', 0, 0).ok, false)
  assert.match(applySponsorEventChoice(state, 'not-an-option').error, /valid command option/)

  const partsBefore = state.resources.parts
  const confidenceBefore = state.resources.confidence
  state = applySponsorEventChoice(state, 'publish').state
  assert.equal(state.pendingEventId, null)
  assert.deepEqual(state.resolvedEventIds, ['us-congressional-audit'])
  assert.equal(state.resources.parts, partsBefore - 20)
  assert.equal(state.resources.confidence, confidenceBefore + 5)
  assert.match(state.log[0].message, /telemetry is released/)
})

test('the expansion crisis triggers after the second transfer window', () => {
  let state = prepareExpansion('consolidation-charter')
  while (state.sol < 30) state = advanceCampaign(state)
  assert.equal(state.pendingEventId, null)
  assert.ok(state.resolvedEventIds.includes('us-insurance-control'))
  assert.match(state.log[0].message, /insurance coverage/)
  assert.equal(state.policyEffects.restrictedConstructionDuringHazards, true)
})

test('each sponsor faces a distinct rival and three-way strategic encounter', () => {
  ;['american-compact', 'china-directorate', 'europe-cooperative', 'russia-directorate'].forEach((sponsorId) => {
    const rival = rivalSettlementFor(sponsorId)
    assert.ok(rival, sponsorId)
    assert.equal(rival.encounter.sol, 27, sponsorId)
    assert.deepEqual(rival.encounter.choices.map((choice) => choice.posture), ['Cooperate', 'Compete', 'Remain independent'], sponsorId)
  })
})

test('the Sol 27 rival encounter pauses expansion and records Mars policy', () => {
  let state = prepareExpansion('consolidation-charter')
  while (state.sol < 26) state = advanceCampaign(state)
  state = advanceSol(state)

  assert.equal(state.sol, 27)
  assert.equal(state.pendingRivalEncounterId, 'us-orbital-relay')
  assert.equal(advanceSol(state), state)
  assert.equal(canPlaceBuilding(state, 'storage', 0, 1).ok, false)
  assert.match(applyRivalEncounterChoice(state, 'not-a-policy').error, /valid Mars policy/)

  const cargoBefore = state.resources.cargo
  state = applyRivalEncounterChoice(state, 'exclusive').state
  assert.equal(state.pendingRivalEncounterId, null)
  assert.deepEqual(state.resolvedRivalEncounterIds, ['us-orbital-relay'])
  assert.equal(state.resources.cargo, Math.round((cargoBefore - 1.2) * 10) / 10)
  assert.equal(state.rivalRelations, 26)
  assert.equal(state.strategicPosition, 72)
  assert.equal(marsOrder(state).title, 'Competitive Hegemony')
  assert.match(state.log[0].message, /wins the relay slot/)
})

test('Mars-order assessment distinguishes cooperation, competition, and isolation', () => {
  assert.equal(marsOrder({ rivalRelations: 75, strategicPosition: 70 }).title, 'Cooperative Leadership')
  assert.equal(marsOrder({ rivalRelations: 25, strategicPosition: 75 }).title, 'Competitive Hegemony')
  assert.equal(marsOrder({ rivalRelations: 25, strategicPosition: 45 }).title, 'Contested Frontier')
  assert.equal(marsOrder({ rivalRelations: 50, strategicPosition: 50 }).title, 'Parallel Settlements')
})

test('a prepared colony survives the dust front and earns a second transfer window', () => {
  const state = reachSecondWindow()
  assert.equal(state.sol, 24)
  assert.equal(state.outcome, null)
  assert.equal(state.phase, 'review')
  assert.equal(state.transferWindowPending, true)
  assert.equal(state.stormSurvived, true)
  assert.ok(state.resources.integrity > 0)
  assert.equal(missionObjectives(state).every((objective) => objective.complete), true)
  assert.equal(colonyProfile(state), 'Industrial Vanguard')
})

test('every opening manifest can earn the second transfer window', () => {
  ;['baseload-first', 'crew-reserve', 'industrial-seed'].forEach((manifestId) => {
    const state = reachSecondWindow(manifestId)
    assert.equal(state.transferWindowPending, true, manifestId)
  })
})

test('every Chinese opening doctrine can earn the second transfer window', () => {
  ;['cn-reactor-corridor', 'cn-industrial-base', 'cn-life-support'].forEach((manifestId) => {
    const state = reachSecondWindow(manifestId, 'china-directorate')
    assert.equal(state.transferWindowPending, true, manifestId)
    assert.equal(state.settlementName, 'Tianwen Settlement')
  })
})

test('every European opening doctrine can earn the second transfer window', () => {
  ;['eu-modular-habitat', 'eu-solar-microgrid', 'eu-precision-industry'].forEach((manifestId) => {
    const state = reachSecondWindow(manifestId, 'europe-cooperative')
    assert.equal(state.transferWindowPending, true, manifestId)
    assert.equal(state.settlementName, 'Kepler Settlement')
  })
})

test('every Russian opening doctrine can earn the second transfer window', () => {
  ;['ru-reactor-reserve', 'ru-surface-logistics', 'ru-expedition-reserve'].forEach((manifestId) => {
    const state = reachSecondWindow(manifestId, 'russia-directorate')
    assert.equal(state.transferWindowPending, true, manifestId)
    assert.equal(state.settlementName, 'Zvezda Settlement')
  })

  const logistics = startMission('ru-surface-logistics', 'russia-directorate')
  assert.equal(logistics.roverFleet, 3)
  assert.deepEqual(logistics.roverAssignments, { water: 1, construction: 1, maintenance: 1, survey: 0 })
})

test('sponsor confidence gates ambitious second-window packages', () => {
  const review = reachSecondWindow()
  assert.equal(followOnEligibility(review, 'permanent-crew').eligible, true)
  assert.equal(followOnEligibility(review, 'machine-economy').eligible, true)
  assert.equal(followOnEligibility(review, 'consolidation-charter').eligible, true)

  const weakReview = { ...review, resources: { ...review.resources, confidence: 66 } }
  assert.equal(followOnEligibility(weakReview, 'permanent-crew').eligible, false)
  assert.equal(followOnEligibility(weakReview, 'machine-economy').eligible, false)
  assert.equal(followOnEligibility(weakReview, 'consolidation-charter').eligible, true)
})

test('follow-on manifests change population, cargo, and construction economics', () => {
  let review = reachSecondWindow()
  review = updateRoverAssignment(review, 'maintenance', -1).state
  review = updateRoverAssignment(review, 'construction', 1).state
  const crew = applyFollowOnManifest(review, 'permanent-crew').state
  const machines = applyFollowOnManifest(review, 'machine-economy').state
  const consolidation = applyFollowOnManifest(review, 'consolidation-charter').state

  assert.equal(crew.crew, 10)
  assert.deepEqual(crew.crewCohorts, { engineering: 3, operations: 4, support: 2, residents: 1 })
  assert.deepEqual(buildingCost(crew, 'habitat'), { parts: 41, cargo: 1.2 })
  assert.equal(machines.crew, 8)
  assert.deepEqual(machines.crewCohorts, { engineering: 4, operations: 3, support: 1, residents: 0 })
  assert.equal(machines.roverFleet, 3)
  assert.deepEqual(buildingCost(machines, 'workshop'), { parts: 16, cargo: 0.6 })
  assert.equal(consolidation.crew, 6)
  assert.deepEqual(buildingCost(consolidation, 'storage'), { parts: 6, cargo: 0.3 })
})

test('each follow-on strategy can pass the permanent-city audit', () => {
  ;['permanent-crew', 'machine-economy', 'consolidation-charter'].forEach((manifestId) => {
    let state = prepareExpansion(manifestId)
    while (!state.outcome) state = advanceMaintainedCampaign(state)
    assert.equal(state.sol, 42, manifestId)
    assert.equal(state.outcome, 'permanent-city', manifestId)
    assert.equal(missionObjectives(state).every((objective) => objective.complete), true, manifestId)
  })
})

test('each Chinese follow-on strategy can pass the permanent-city audit', () => {
  ;['cn-civil-cadre', 'cn-autonomous-industry', 'cn-consolidation-plan'].forEach((manifestId) => {
    let state = prepareExpansion(manifestId, 'cn-industrial-base', 'china-directorate')
    while (!state.outcome) state = advanceMaintainedCampaign(state)
    assert.equal(state.sol, 42, manifestId)
    assert.equal(state.outcome, 'permanent-city', manifestId)
    assert.equal(missionObjectives(state).every((objective) => objective.complete), true, manifestId)
  })
})

test('each European follow-on strategy can pass the permanent-city audit', () => {
  ;['eu-civic-charter', 'eu-automation-union', 'eu-consensus-reserve'].forEach((manifestId) => {
    let state = prepareExpansion(manifestId, 'eu-precision-industry', 'europe-cooperative')
    while (!state.outcome) state = advanceMaintainedCampaign(state)
    assert.equal(state.sol, 42, manifestId)
    assert.equal(state.outcome, 'permanent-city', manifestId)
    assert.equal(missionObjectives(state).every((objective) => objective.complete), true, manifestId)
  })
})

test('each Russian follow-on strategy can pass the permanent-city audit', () => {
  ;['ru-permanent-detachment', 'ru-heavy-industry', 'ru-autonomy-reserve'].forEach((manifestId) => {
    let state = prepareExpansion(manifestId, 'ru-surface-logistics', 'russia-directorate')
    while (!state.outcome) state = advanceMaintainedCampaign(state)
    assert.equal(state.sol, 42, manifestId)
    assert.equal(state.outcome, 'permanent-city', manifestId)
    assert.equal(missionObjectives(state).every((objective) => objective.complete), true, manifestId)
  })
})

test('saves round trip and unknown versions are rejected', () => {
  const state = startMission()
  assert.deepEqual(restoreState(serializeState(state)), state)
  assert.equal(restoreState('{bad json'), null)
  assert.equal(restoreState(JSON.stringify({ ...state, version: 999 })), null)

  const legacy = { ...state, version: 1 }
  delete legacy.manifestId
  delete legacy.manifestDoctrine
  const migrated = restoreState(JSON.stringify(legacy))
  assert.equal(migrated.version, 9)
  assert.equal(migrated.manifestId, 'legacy-balanced')
  assert.equal(migrated.sponsorId, 'american-compact')

  const versionTwo = { ...state, version: 2 }
  const migratedTwo = restoreState(JSON.stringify(versionTwo))
  assert.equal(migratedTwo.version, 9)
  assert.equal(migratedTwo.phase, 'survival')

  const versionThree = { ...state, version: 3 }
  delete versionThree.roverFleet
  delete versionThree.roverAssignments
  const migratedThree = restoreState(JSON.stringify(versionThree))
  assert.equal(migratedThree.version, 9)
  assert.equal(migratedThree.roverFleet, 2)
  assert.deepEqual(migratedThree.roverAssignments, { water: 1, construction: 1, maintenance: 0, survey: 0 })

  const versionFour = { ...state, version: 4 }
  delete versionFour.crewCohorts
  delete versionFour.crossTraining
  const migratedFour = restoreState(JSON.stringify(versionFour))
  assert.equal(migratedFour.version, 9)
  assert.deepEqual(migratedFour.crewCohorts, { engineering: 2, operations: 3, support: 1, residents: 0 })
  assert.equal(migratedFour.crossTraining, 'engineering')

  const versionFive = { ...state, version: 5 }
  delete versionFive.sponsorId
  delete versionFive.settlementName
  const migratedFive = restoreState(JSON.stringify(versionFive))
  assert.equal(migratedFive.version, 9)
  assert.equal(migratedFive.sponsorId, 'american-compact')
  assert.equal(migratedFive.settlementName, 'Ares Pathfinder')

  const versionSix = { ...state, version: 6 }
  delete versionSix.pendingEventId
  delete versionSix.resolvedEventIds
  const migratedSix = restoreState(JSON.stringify(versionSix))
  assert.equal(migratedSix.version, 9)
  assert.equal(migratedSix.pendingEventId, null)
  assert.deepEqual(migratedSix.resolvedEventIds, [])

  const versionSeven = { ...state, version: 7 }
  delete versionSeven.rivalSettlementId
  delete versionSeven.rivalRelations
  delete versionSeven.strategicPosition
  delete versionSeven.pendingRivalEncounterId
  delete versionSeven.resolvedRivalEncounterIds
  const migratedSeven = restoreState(JSON.stringify(versionSeven))
  assert.equal(migratedSeven.version, 9)
  assert.equal(migratedSeven.rivalSettlementId, 'tianwen-network')
  assert.equal(migratedSeven.rivalRelations, 44)
  assert.equal(migratedSeven.strategicPosition, 52)
  assert.equal(migratedSeven.pendingRivalEncounterId, null)
  assert.deepEqual(migratedSeven.resolvedRivalEncounterIds, [])
})

test('sponsor sites have distinct survey maps and rover work reveals prospects', () => {
  const arcadia = siteForSponsor('american-compact')
  const elysium = siteForSponsor('europe-cooperative')
  assert.notDeepEqual(arcadia.features.map(({ col, row }) => [col, row]), elysium.features.map(({ col, row }) => [col, row]))
  let state = applyManifest(createInitialState('american-compact'), 'industrial-seed').state
  state = updateRoverAssignment(state, 'construction', -1).state
  state = updateRoverAssignment(state, 'survey', 1).state
  state = advanceSol(state)
  state = advanceSol(state)
  assert.equal(state.siteSurveyProgress, 2)
  assert.deepEqual(state.surveyedFeatureIds, ['arcadia-west'])
  assert.equal(state.sciencePoints, 5)
})

test('battery, greenhouse, and recycling systems close settlement loops', () => {
  let state = startMission()
  state = {
    ...state,
    buildings: [
      ...state.buildings,
      { uid: 'battery-test', type: 'battery', col: 4, row: 2, integrity: 100 },
      { uid: 'greenhouse-test', type: 'greenhouse', col: 5, row: 2, integrity: 100 },
      { uid: 'recycling-test', type: 'recycling', col: 4, row: 3, integrity: 100 },
    ],
  }
  const stats = colonyStats(state)
  assert.equal(stats.batteryCapacity, 6000)
  assert.ok(stats.foodNet > -state.crew * 1.15)
  assert.ok(stats.waterRecovery > 0 && stats.waterRecovery <= 0.42)
  assert.equal(stats.production['recycling-test'].online, true)
  const advanced = advanceSol(state)
  assert.ok(advanced.batteryCharge > 0)
})

test('mission officers provide narrow, visible specialty bonuses', () => {
  const state = startMission()
  const baseCost = buildingCost(state, 'habitat')
  const logisticsId = state.crewMembers.find((member) => member.trait === 'logistics').id
  const logistics = updateCrewLead(state, logisticsId).state
  assert.deepEqual(buildingCost(logistics, 'habitat'), { parts: baseCost.parts - 3, cargo: baseCost.cargo - 0.1 })
  const systemsId = state.crewMembers.find((member) => member.trait === 'systems').id
  const systems = updateCrewLead(state, systemsId).state
  assert.ok(colonyStats(systems).labor.available.engineering > colonyStats(state).labor.available.engineering)
})

test('operational incidents are deterministic, state-sensitive, and chronicled', () => {
  let state = startMission()
  const first = operationalIncidentAt(state, 7)
  assert.equal(first.id, operationalIncidentAt(state, 7).id)
  state = { ...state, sol: 7, pendingOperationalIncidentId: first.id }
  const resolved = applyOperationalIncidentChoice(state, first.choices[0].id)
  assert.equal(resolved.error, '')
  assert.equal(resolved.state.pendingOperationalIncidentId, null)
  assert.ok(resolved.state.resolvedOperationalIncidentIds.includes(first.id))
  assert.equal(resolved.state.decisionLog.at(-1).category, 'Operational incident')
})

test('campaign audit produces six letter grades and shareable result text', () => {
  const state = { ...startMission(), outcome: 'dependent-outpost', sol: 24 }
  const report = campaignReport(state, missionObjectives(state))
  assert.equal(report.grades.length, 6)
  report.grades.forEach((item) => assert.match(item.grade, /^[A-F]$/))
  assert.match(campaignShareText(state, report), /Titans of Mars: First City/)
  assert.match(campaignShareText(state, report), /Overall [A-F]/)
})
