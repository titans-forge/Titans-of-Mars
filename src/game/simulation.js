import { isCommissioned, isOperational } from './buildingStatus.js'
import { CONSTRUCTION_WORK, constructionRefund, nextBuildingUid } from './construction.js'
import { validateRestoredState } from './saveValidation.js'
import { decisionEligibility, decisionOptions } from './decisions.js'
export { decisionEligibility, decisionOptions } from './decisions.js'
import { buildingEfficiency, isStormActive, isDebrisActive, colonyStats, operateSol, colonyAssessment, SOL_HOURS } from './operations.js'
export { buildingEfficiency, isStormActive, isDebrisActive, colonyStats, colonyAssessment, SOL_HOURS } from './operations.js'
import { BUILDINGS } from './buildings.js'
import { applyCrewEffects, crewLead, ensureCrewMembers } from './crewMembers.js'
import { CROSS_TRAINING_ROLES, DEFAULT_CREW_COHORTS, crewLabor, inferLegacyCohorts, mergeCohorts } from './crewLabor.js'
import { followOnManifestById } from './followOnManifests.js'
import { LEGACY_MANIFEST, manifestById } from './manifests.js'
import { DEFAULT_ROVER_ASSIGNMENTS, ROVER_ROUTES, roverOperations } from './roverOperations.js'
import { advanceSiteSurvey, iceDepositAt, siteForSponsor, solarRidgeAt, terrainSupportsBuilding } from './siteFeatures.js'
import { sponsorById } from './sponsors.js'
import { sponsorEventAt, sponsorEventById } from './sponsorEvents.js'
import { rivalEncounterAt, rivalEncounterById, rivalSettlementFor } from './rivalSettlements.js'
import { operationalIncidentAt, operationalIncidentById } from './operationalIncidents.js'
import { buildUtilityNetwork, cellWithinUtilityReach } from './utilityNetwork.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const round = (value) => Math.round(value * 10) / 10
const SPONSOR_DAMAGE_OFFSET = { 'american-compact': 0, 'china-directorate': 2, 'europe-cooperative': 4, 'russia-directorate': 6 }

export function missionObjectives(state) {
  const stats = colonyStats(state)
  const online = (b) => stats.production[b.uid]?.online && b.integrity >= 50
  const has = (type, output) => state.buildings.some((b) => b.type === type && online(b) && (!output || stats.production[b.uid][output] > 0))
  if (state.phase === 'expansion') {
    return [
      { id: 'housing', label: `House the ${state.crew}-person permanent crew`, complete: stats.crewCapacity >= state.crew },
      { id: 'industry', label: 'Deliver replacement parts from a machine workshop', complete: has('workshop', 'parts') },
      { id: 'food', label: 'Produce food in a supplied greenhouse', complete: has('greenhouse', 'food') },
      { id: 'recycling', label: 'Reclaim settlement water with power', complete: has('recycling') && stats.waterRecovery > 0 },
      { id: 'reserves', label: 'Protect a second reserve-tank site', complete: state.buildings.filter((b) => b.type === 'storage' && online(b)).length >= 2 },
      { id: 'parts', label: 'Hold 60 replacement parts', complete: state.resources.parts >= 60 },
      { id: 'debris', label: 'Survive the Sol 34 debris front', complete: state.debrisSurvived },
      { id: 'labor', label: 'Staff essential engineering, operations and medical shifts', complete: Object.values(stats.labor.ratios).every((ratio) => ratio >= 0.75) },
    ]
  }
  // Forecast four dusty sols with the actual battery ledger, never object counts.
  let shadow = { ...state, sol: 18 }, stormReady = true
  for (let day = 0; day < 4; day += 1) {
    const weather = colonyStats(shadow)
    if (weather.powerRatio < 0.99) stormReady = false
    shadow = operateSol(shadow, weather)
  }
  return [
    { id: 'habitat', label: 'Commission usable pressure housing', complete: has('habitat') && stats.crewCapacity >= state.crew },
    { id: 'survey', label: 'Assign Ground Survey and advance to confirm an ice lens', complete: (state.surveyedFeatureIds?.length ?? 0) > 0 },
    { id: 'water', label: 'Deliver water from a confirmed ice rig', complete: has('ice', 'water') },
    { id: 'oxygen', label: 'Produce oxygen with a supplied plant', complete: has('oxygen', 'oxygen') },
    { id: 'power', label: 'Power the core through four dusty sols', complete: stormReady },
    { id: 'storm', label: 'Survive the Sol 18 dust front', complete: state.stormSurvived },
  ]
}

export function buildingCost(state, type) {
  const base = BUILDINGS[type]?.cost
  if (!base) return null
  const discount = state.buildDiscounts?.[type] ?? {}
  const roverDiscount = roverOperations(state).constructionDiscount
  const logisticsDiscount = crewLead(state)?.trait === 'logistics' ? { parts: 3, cargo: 0.1 } : { parts: 0, cargo: 0 }
  const cargoAfterDiscounts = Math.max(round(base.cargo * 0.2), round(base.cargo - (discount.cargo ?? 0) - roverDiscount.cargo - logisticsDiscount.cargo))
  return {
    parts: Math.max(round(base.parts * 0.2), round(base.parts - (discount.parts ?? 0) - roverDiscount.parts - logisticsDiscount.parts)),
    cargo: round(cargoAfterDiscounts * (state.policyEffects?.constructionCargoMultiplier ?? 1)),
  }
}

export function buildingRepairCost(state, uid) {
  const building = state.buildings.find((item) => item.uid === uid)
  if (!building || !isCommissioned(building) || building.integrity >= 100) return 0
  const maintenanceRovers = roverOperations(state).assignments.maintenance
  const rate = Math.max(0.27, 0.45 - (maintenanceRovers * 0.06))
  return Math.max(1, Math.ceil((100 - building.integrity) * rate))
}

export function repairBuilding(state, uid) {
  if (state.outcome) return { state, error: 'The mission has concluded.' }
  if (state.transferWindowPending || state.pendingEventId || state.pendingRivalEncounterId || state.pendingOperationalIncidentId) return { state, error: 'Resolve the active command decision first.' }
  const building = state.buildings.find((item) => item.uid === uid)
  if (!building) return { state, error: 'Select a valid structure.' }
  if (!isCommissioned(building)) return { state, error: 'This worksite is still under construction.' }
  if (building.integrity >= 100) return { state, error: 'That structure is already at full integrity.' }
  const cost = buildingRepairCost(state, uid)
  if (state.resources.parts < cost) return { state, error: `Repairs require ${cost} parts.` }
  const definition = BUILDINGS[building.type]
  return {
    error: '',
    state: {
      ...state,
      resources: { ...state.resources, parts: round(state.resources.parts - cost) },
      buildings: state.buildings.map((item) => item.uid === uid ? { ...item, integrity: 100 } : item),
      log: [{ sol: state.sol, tone: 'success', message: `${definition.name} restored to full operating integrity for ${cost} parts.` }, ...state.log].slice(0, 12),
    },
  }
}

export function updateCrewLead(state, memberId) {
  if (state.assignmentCommitment?.sol === state.sol && state.assignmentCommitment.crewLeadId && memberId !== state.assignmentCommitment.crewLeadId) return { state, error: 'The logistics lead is committed to this sol’s construction. Advance one sol before changing command.' }
  if (!ensureCrewMembers(state).some((member) => member.id === memberId && member.health > 0)) return { state, error: 'Select an active mission officer.' }
  return { state: { ...state, crewLeadId: memberId }, error: '' }
}

export function updateRoverAssignment(state, routeId, delta) {
  if (!ROVER_ROUTES[routeId] || !Number.isInteger(delta) || Math.abs(delta) !== 1) {
    return { state, error: 'Select a valid rover dispatch change.' }
  }
  const operations = roverOperations(state)
  if (routeId === 'construction' && delta < 0 && state.assignmentCommitment?.sol === state.sol && operations.assignments.construction <= state.assignmentCommitment.roverAssignments.construction) return { state, error: 'These rovers are committed to this sol’s construction. Advance one sol before recall.' }
  const current = operations.assignments[routeId]
  if (delta < 0 && current === 0) return { state, error: 'No rover is assigned to that route.' }
  if (delta > 0 && operations.available === 0) return { state, error: 'Recall a rover before assigning another route.' }
  return {
    error: '',
    state: {
      ...state,
      roverAssignments: { ...operations.assignments, [routeId]: current + delta },
    },
  }
}

export function updateCrossTraining(state, role) {
  if (!CROSS_TRAINING_ROLES.includes(role)) return { state, error: 'Select a valid cross-training focus.' }
  return { error: '', state: { ...state, crossTraining: role } }
}

export function applySponsorEventChoice(state, choiceId) {
  const event = sponsorEventById(state.pendingEventId)
  if (!event || event.sponsorId !== state.sponsorId) return { state, error: 'No sponsor decision is pending.' }
  const choice = decisionOptions(state, event).find((item) => item.id === choiceId)
  if (!choice) return { state, error: 'Select a valid command option.' }
  const eligibility = decisionEligibility(state, choice)
  if (!eligibility.eligible) return { state, error: eligibility.reason }
  const stats = colonyStats(state)
  const resources = { ...state.resources }
  Object.entries(choice.effects).forEach(([key, value]) => {
    resources[key] = round((resources[key] ?? 0) + value)
  })
  resources.water = clamp(resources.water, 0, stats.waterCapacity)
  resources.oxygen = clamp(resources.oxygen, 0, stats.oxygenCapacity)
  resources.food = clamp(resources.food, 0, 1000)
  resources.parts = clamp(resources.parts, 0, 999)
  resources.cargo = clamp(resources.cargo, 0, 99)
  resources.confidence = clamp(resources.confidence, 0, 100)
  resources.integrity = clamp(resources.integrity, 0, 100)
  return {
    error: '',
    state: {
      ...state,
      crewMembers: applyCrewEffects(ensureCrewMembers(state), choice.crewEffects),
      outcome: resources.integrity <= 0 ? 'failure' : state.outcome,
      pendingEventId: null,
      resolvedEventIds: [...(state.resolvedEventIds ?? []), event.id],
      resources,
      policyEffects: { ...(state.policyEffects ?? {}), ...(choice.policy?.effects ?? {}) },
      decisionLog: [...(state.decisionLog ?? []), { sol: state.sol, category: 'Sponsor directive', title: event.title, choice: choice.title }],
      speed: 0,
      log: [{ sol: state.sol, tone: 'warning', message: choice.consequence }, ...state.log].slice(0, 12),
    },
  }
}

export function applyRivalEncounterChoice(state, choiceId) {
  const encounter = rivalEncounterById(state.pendingRivalEncounterId)
  const rival = rivalSettlementFor(state.sponsorId)
  if (!encounter || !rival || rival.encounter.id !== encounter.id) return { state, error: 'No rival-settlement decision is pending.' }
  const choice = decisionOptions(state, encounter).find((item) => item.id === choiceId)
  if (!choice) return { state, error: 'Select a valid Mars policy.' }
  const eligibility = decisionEligibility(state, choice)
  if (!eligibility.eligible) return { state, error: eligibility.reason }
  const stats = colonyStats(state)
  const resources = { ...state.resources }
  Object.entries(choice.effects).forEach(([key, value]) => {
    resources[key] = round((resources[key] ?? 0) + value)
  })
  resources.water = clamp(resources.water, 0, stats.waterCapacity)
  resources.oxygen = clamp(resources.oxygen, 0, stats.oxygenCapacity)
  resources.food = clamp(resources.food, 0, 1000)
  resources.parts = clamp(resources.parts, 0, 999)
  resources.cargo = clamp(resources.cargo, 0, 99)
  resources.confidence = clamp(resources.confidence, 0, 100)
  resources.integrity = clamp(resources.integrity, 0, 100)
  return {
    error: '',
    state: {
      ...state,
      crewMembers: applyCrewEffects(ensureCrewMembers(state), choice.crewEffects),
      outcome: resources.integrity <= 0 ? 'failure' : state.outcome,
      pendingRivalEncounterId: null,
      resolvedRivalEncounterIds: [...(state.resolvedRivalEncounterIds ?? []), encounter.id],
      rivalRelations: clamp((state.rivalRelations ?? rival.startingRelations) + (choice.relations ?? 0), 0, 100),
      strategicPosition: clamp((state.strategicPosition ?? rival.startingPosition) + (choice.position ?? 0), 0, 100),
      resources,
      decisionLog: [...(state.decisionLog ?? []), { sol: state.sol, category: 'Mars relations', title: encounter.title, choice: choice.title }],
      speed: 0,
      log: [{ sol: state.sol, tone: choice.relations >= 0 ? 'success' : 'warning', message: choice.consequence }, ...state.log].slice(0, 12),
    },
  }
}

export function applyOperationalIncidentChoice(state, choiceId) {
  const incident = operationalIncidentById(state.pendingOperationalIncidentId)
  const choice = decisionOptions(state, incident).find((item) => item.id === choiceId)
  if (!incident || !choice) return { state, error: 'Select a valid settlement response.' }
  const eligibility = decisionEligibility(state, choice)
  if (!eligibility.eligible) return { state, error: eligibility.reason }
  const stats = colonyStats(state)
  const resources = { ...state.resources }
  Object.entries(choice.effects ?? {}).forEach(([key, value]) => { resources[key] = round((resources[key] ?? 0) + value) })
  resources.water = clamp(resources.water, 0, stats.waterCapacity)
  resources.oxygen = clamp(resources.oxygen, 0, stats.oxygenCapacity)
  resources.food = clamp(resources.food, 0, 1000)
  resources.parts = clamp(resources.parts, 0, 999)
  resources.cargo = clamp(resources.cargo, 0, 99)
  resources.confidence = clamp(resources.confidence, 0, 100)
  resources.integrity = clamp(resources.integrity, 0, 100)
  let buildings = state.buildings
  if (choice.damageType && choice.damage) {
    const target = buildings.find((building) => building.type === choice.damageType && isOperational(building))
    if (target) buildings = buildings.map((building) => building.uid === target.uid ? { ...building, integrity: clamp(building.integrity - choice.damage, 0, 100) } : building)
  }
  return {
    error: '',
    state: {
      ...state,
      outcome: resources.integrity <= 0 ? 'failure' : state.outcome,
      pendingOperationalIncidentId: null,
      resolvedOperationalIncidentIds: [...(state.resolvedOperationalIncidentIds ?? []), incident.id],
      resources,
      sciencePoints: (state.sciencePoints ?? 0) + (choice.science ?? 0),
      batteryCharge: clamp((state.batteryCharge ?? 0) + (choice.batteryCharge ?? 0), 0, colonyStats({ ...state, buildings }).batteryCapacity),
      crewMembers: applyCrewEffects(ensureCrewMembers(state), choice.crewEffects),
      buildings,
      speed: 0,
      decisionLog: [...(state.decisionLog ?? []), { sol: state.sol, category: 'Operational incident', title: incident.title, choice: choice.title }],
      log: [{ sol: state.sol, tone: 'warning', message: choice.consequence }, ...state.log].slice(0, 12),
    },
  }
}

export function applyManifest(state, manifestId) {
  if (state.manifestId) return { state, error: 'A transfer manifest is already committed.' }
  if (!state.sponsorId) return { state, error: 'Choose a founding mission first.' }
  const manifest = manifestById(manifestId)
  if (!manifest || manifest.id === LEGACY_MANIFEST.id) return { state, error: 'Select a valid transfer manifest.' }
  if (manifest.sponsorId !== state.sponsorId) return { state, error: 'That payload doctrine belongs to another founding sponsor.' }

  const resources = { ...state.resources }
  Object.entries(manifest.effects).forEach(([key, value]) => {
    resources[key] = round((resources[key] ?? 0) + value)
  })
  const roverAssignments = { ...state.roverAssignments }
  Object.entries(manifest.roverAssignments ?? {}).forEach(([routeId, delta]) => {
    roverAssignments[routeId] = (roverAssignments[routeId] ?? 0) + delta
  })

  return {
    error: '',
    state: {
      ...state,
      manifestId: manifest.id,
      manifestDoctrine: manifest.doctrine,
      buildDiscounts: manifest.discounts ?? {},
      roverFleet: state.roverFleet + (manifest.rovers ?? 0),
      roverAssignments,
      resources,
      decisionLog: [...(state.decisionLog ?? []), { sol: state.sol, category: 'Founding manifest', title: manifest.title, choice: manifest.doctrine }],
      log: [{ sol: state.sol, tone: 'success', message: manifest.consequence }, ...state.log].slice(0, 12),
    },
  }
}

function mergeDiscounts(current, incoming) {
  const merged = { ...(current ?? {}) }
  Object.entries(incoming ?? {}).forEach(([type, discount]) => {
    merged[type] = {
      parts: Math.max(merged[type]?.parts ?? 0, discount.parts ?? 0),
      cargo: Math.max(merged[type]?.cargo ?? 0, discount.cargo ?? 0),
    }
  })
  return merged
}

export function followOnEligibility(state, manifestId) {
  const manifest = followOnManifestById(manifestId)
  if (!manifest) return { eligible: false, reason: 'Unknown follow-on manifest.' }
  if (manifest.sponsorId !== state.sponsorId) return { eligible: false, reason: 'That package belongs to another founding sponsor.' }
  if (!state.transferWindowPending) return { eligible: false, reason: 'The second transfer window is not open.' }
  if (state.resources.confidence < manifest.threshold) {
    return { eligible: false, reason: `Requires ${manifest.threshold}% sponsor confidence.` }
  }
  return { eligible: true, reason: `Authorized by ${state.transferAuthority}.` }
}

export function applyFollowOnManifest(state, manifestId) {
  if (state.secondManifestId) return { state, error: 'A follow-on manifest is already committed.' }
  const manifest = followOnManifestById(manifestId)
  const eligibility = followOnEligibility(state, manifestId)
  if (!manifest || !eligibility.eligible) return { state, error: eligibility.reason }

  const stats = colonyStats(state)
  const resources = { ...state.resources }
  Object.entries(manifest.effects).forEach(([key, value]) => {
    resources[key] = round((resources[key] ?? 0) + value)
  })
  resources.water = clamp(resources.water, 0, stats.waterCapacity)
  resources.oxygen = clamp(resources.oxygen, 0, stats.oxygenCapacity)
  resources.food = clamp(resources.food, 0, 1000)
  resources.parts = clamp(resources.parts, 0, 999)
  resources.confidence = clamp(resources.confidence, 0, 100)

  const nextCrewCount = state.crew + manifest.crew
  const expandedCrew = ensureCrewMembers({ ...state, crew: nextCrewCount, crewCohorts: mergeCohorts(state.crewCohorts, manifest.cohorts) })
  return {
    error: '',
    state: {
      ...state,
      phase: 'expansion',
      transferWindowPending: false,
      secondManifestId: manifest.id,
      secondManifestDoctrine: manifest.doctrine,
      crew: nextCrewCount,
      crewMembers: expandedCrew,
      crewCohorts: mergeCohorts(state.crewCohorts, manifest.cohorts),
      crossTraining: manifest.crossTraining ?? state.crossTraining,
      roverFleet: (state.roverFleet ?? 2) + (manifest.rovers ?? 0),
      buildDiscounts: mergeDiscounts(state.buildDiscounts, manifest.discounts),
      resources,
      decisionLog: [...(state.decisionLog ?? []), { sol: state.sol, category: 'Second transfer', title: manifest.title, choice: manifest.doctrine }],
      log: [{ sol: state.sol, tone: 'success', message: manifest.consequence }, ...state.log].slice(0, 12),
    },
  }
}

export function colonyProfile(state) {
  const types = state.buildings.filter(isOperational).map((building) => building.type)
  const solarCount = types.filter((type) => type === 'solar').length
  const storageCount = types.filter((type) => type === 'storage').length
  const followOnProfile = followOnManifestById(state.secondManifestId)?.profile
  if (followOnProfile) return followOnProfile
  if (types.includes('workshop') && types.includes('nuclear')) return 'Industrial Vanguard'
  if (storageCount >= 2 && types.includes('ice') && types.includes('oxygen')) return 'Resilient Habitat'
  if (!types.includes('nuclear') && solarCount >= 4) return 'Solar Autonomy'
  return manifestById(state.manifestId)?.profile ?? 'Uncommitted Outpost'
}

export function canPlaceBuilding(state, type, col, row) {
  const building = BUILDINGS[type]
  if (!state.manifestId) return { ok: false, reason: 'Authorize a sponsor transfer manifest first.' }
  if (state.transferWindowPending) return { ok: false, reason: 'Resolve the second sponsor transfer window first.' }
  if (state.pendingEventId) return { ok: false, reason: 'Resolve the command decision first.' }
  if (state.pendingRivalEncounterId) return { ok: false, reason: 'Set Mars policy before resuming construction.' }
  if (state.pendingOperationalIncidentId) return { ok: false, reason: 'Resolve the active settlement incident first.' }
  if (!building?.buildable) return { ok: false, reason: 'This structure cannot be constructed.' }
  if (state.outcome) return { ok: false, reason: 'The mission has concluded.' }
  if (state.policyEffects?.restrictedConstructionDuringHazards && (isStormActive(state.sol) || isDebrisActive(state.sol))) {
    return { ok: false, reason: 'The insurance shutdown clause suspends new construction during active dust or debris alerts. Existing operations and repairs may continue; build after the alert passes.' }
  }
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col > 8 || row < 0 || row > 5) return { ok: false, reason: 'Select a surveyed construction cell.' }
  if (state.buildings.some((placed) => placed.col === col && placed.row === row)) return { ok: false, reason: 'That construction cell is occupied.' }
  if (!terrainSupportsBuilding(state, type, col, row)) {
    return { ok: false, reason: type === 'ice' ? 'Ice extraction rigs require a rover-confirmed ice lens.' : 'That cell is reserved as an orbital survey prospect.' }
  }
  const network = buildUtilityNetwork(state.buildings)
  if (!cellWithinUtilityReach(state.buildings, network, col, row)) {
    return { ok: false, reason: 'Outside utility-grid reach. Build within two cells of an online structure.' }
  }
  const cost = buildingCost(state, type)
  if (state.resources.parts < cost.parts) return { ok: false, reason: `Requires ${cost.parts} parts.` }
  if (state.resources.cargo < cost.cargo) return { ok: false, reason: `Requires ${cost.cargo} t imported cargo.` }
  return { ok: true, reason: '' }
}

export function placeBuilding(state, type, col, row) {
  const availability = canPlaceBuilding(state, type, col, row)
  if (!availability.ok) return { state, error: availability.reason }
  const definition = BUILDINGS[type]
  const cost = buildingCost(state, type)
  const uid = nextBuildingUid(state, type)
  return {
    error: '',
    state: {
      ...state,
      resources: {
        ...state.resources,
        parts: round(state.resources.parts - cost.parts),
        cargo: round(state.resources.cargo - cost.cargo),
      },
      buildings: [...state.buildings, { uid, type, col, row, integrity: 100, construction: { requiredWork: CONSTRUCTION_WORK[type], completedWork: 0, paid: { ...cost }, startedSol: state.sol } }],
      selectedUid: uid,
      assignmentCommitment: { sol: state.sol, roverAssignments: { ...roverOperations(state).assignments }, crewLeadId: crewLead(state)?.trait === 'logistics' ? crewLead(state).id : state.assignmentCommitment?.sol === state.sol ? state.assignmentCommitment.crewLeadId : null },
      buildMode: null,
      log: [{ sol: state.sol, tone: 'success', message: `${definition.name} worksite authorized at Grid ${col + 1}-${row + 1}. Commissioning requires ${CONSTRUCTION_WORK[type]} work units; supplies paid once.` }, ...state.log].slice(0, 12),
    },
  }
}

export function cancelConstruction(state, uid) {
  if (state.outcome || state.transferWindowPending || state.pendingEventId || state.pendingRivalEncounterId || state.pendingOperationalIncidentId) return { state, error: 'Resolve the active review or command decision first.' }
  const building = state.buildings.find((b) => b.uid === uid)
  const refund = constructionRefund(building)
  if (!refund) return { state, error: 'Only an unfinished worksite can be cancelled.' }
  const buildings = state.buildings.filter((b) => b.uid !== uid)
  const keepCommitment = buildings.some((b) => b.construction?.startedSol === state.sol)
  return { error: '', state: { ...state, buildings, selectedUid: state.selectedUid === uid ? buildings.find((b) => b.type === 'cargo')?.uid ?? null : state.selectedUid,
    assignmentCommitment: !keepCommitment && state.assignmentCommitment?.sol === state.sol ? null : state.assignmentCommitment,
    resources: { ...state.resources, parts: round(Math.min(999, state.resources.parts + refund.parts)), cargo: round(Math.min(99, state.resources.cargo + refund.cargo)) },
    log: [{ sol: state.sol, tone: 'warning', message: `${BUILDINGS[building.type].name} worksite cancelled. Recovered ${refund.parts} parts and ${refund.cargo} t; already performed work is not refunded.` }, ...state.log].slice(0, 12), speed: 0,
  } }
}

export function advanceSol(state) {
  if (state.outcome || !state.manifestId || state.transferWindowPending || state.pendingEventId || state.pendingRivalEncounterId || state.pendingOperationalIncidentId) return state
  const stats = colonyStats(state)
  const nextSol = state.sol + 1
  const operated = operateSol(state, stats)
  const next = { ...operated, log: [...state.log] }

  for (const b of next.buildings) if (isCommissioned(b) && state.buildings.find((old) => old.uid === b.uid)?.construction) {
    next.log = [{ sol: nextSol, tone: 'success', message: `${BUILDINGS[b.type].name} commissioning complete. It is available from this sol’s operations.` }, ...next.log].slice(0, 12)
  }

  const surveyRovers = roverOperations(state).surveyEffort
  const surveyEffort = surveyRovers > 0 ? surveyRovers + (crewLead(state)?.trait === 'science' ? 1 : 0) : 0
  const survey = advanceSiteSurvey(state, surveyEffort)
  next.siteSurveyProgress = survey.progress
  next.surveyedFeatureIds = survey.surveyedFeatureIds
  if (survey.discoveries.length) {
    const scienceGain = survey.discoveries.reduce((total, feature) => total + feature.science, 0)
    next.sciencePoints = (state.sciencePoints ?? 0) + scienceGain
    survey.discoveries.forEach((feature) => {
      next.log = [{ sol: nextSol, tone: 'success', message: `${feature.title} confirmed: ${feature.purity}-purity ice, projected yield ${feature.yield} L per sol.` }, ...next.log].slice(0, 12)
      next.decisionLog = [...(next.decisionLog ?? []), { sol: nextSol, category: 'Science', title: 'Ground survey discovery', choice: feature.title }]
    })
  }

  if (stats.powerRatio < 1) {
    next.resources.confidence = clamp(round(next.resources.confidence - 1.5), 0, 100)
  }

  if (!state.buildings.some((building) => building.type === 'habitat' && isOperational(building)) && nextSol > 5) {
    next.resources.confidence = clamp(round(next.resources.confidence - 1), 0, 100)
  }

  const depleted = ['water', 'oxygen', 'food'].some((key) => next.resources[key] <= 0)
  if (depleted) {
    next.resources.confidence = clamp(round(next.resources.confidence - 3), 0, 100)
  }

  if (crewLead(next)?.trait === 'command' && next.resources.confidence < state.resources.confidence) {
    next.resources.confidence = clamp(round(next.resources.confidence + 0.5), 0, 100)
  }

  if (state.phase === 'expansion' && next.resources.parts <= 0) {
    next.resources.confidence = clamp(round(next.resources.confidence - 1), 0, 100)
  }

  if (state.phase === 'expansion' && stats.crewCapacity < state.crew) {
    next.resources.confidence = clamp(round(next.resources.confidence - 1), 0, 100)
  }

  if (stats.labor.ratios.support < 1) {
    const supportShortage = 1 - stats.labor.ratios.support
    next.resources.confidence = clamp(round(next.resources.confidence - (supportShortage * 1.5)), 0, 100)
  }

  if (nextSol === 18) {
    next.speed = 0
    next.log = [{ sol: nextSol, tone: 'danger', message: `The dust front has reached ${state.settlementName}. Solar output has collapsed.` }, ...next.log].slice(0, 12)
    const maintenanceRovers = roverOperations(state).assignments.maintenance
    const abrasion = Math.max(4, Math.round((12 * siteForSponsor(state.sponsorId).dustSeverity) - (maintenanceRovers * 4)))
    const solarCount = next.buildings.filter((building) => building.type === 'solar' && isOperational(building)).length
    if (solarCount) {
      next.buildings = next.buildings.map((building) => building.type === 'solar' && isCommissioned(building) ? { ...building, integrity: clamp(round(building.integrity - abrasion), 0, 100) } : building)
      next.log = [{ sol: nextSol, tone: 'warning', message: `Dust abrasion reduced integrity across ${solarCount} solar array${solarCount === 1 ? '' : 's'} by ${abrasion} points.` }, ...next.log].slice(0, 12)
    }
  }
  if (nextSol === 22 && next.resources.integrity > 0) {
    next.stormSurvived = true
    next.resources.confidence = clamp(round(next.resources.confidence + 6), 0, 100)
    next.log = [{ sol: nextSol, tone: 'success', message: 'The dust front has passed. The colony remained pressurized and powered.' }, ...next.log].slice(0, 12)
  }
  if (nextSol === 34 && state.phase === 'expansion') {
    next.speed = 0
    next.log = [{ sol: nextSol, tone: 'danger', message: `A micrometeoroid front is crossing ${state.siteName.split(' · ')[0]}. Inspection cycles and replacement-parts demand have surged.` }, ...next.log].slice(0, 12)
    const candidates = next.buildings.filter((building) => BUILDINGS[building.type]?.buildable && isOperational(building))
    if (candidates.length) {
      const target = candidates[(SPONSOR_DAMAGE_OFFSET[state.sponsorId] ?? 0) % candidates.length]
      const maintenanceRovers = roverOperations(state).assignments.maintenance
      const impact = Math.max(12, 28 - (maintenanceRovers * 8))
      next.buildings = next.buildings.map((building) => building.uid === target.uid ? { ...building, integrity: clamp(round(building.integrity - impact), 0, 100) } : building)
      next.selectedUid = target.uid
      next.log = [{ sol: nextSol, tone: 'danger', message: `${BUILDINGS[target.type].name} took a debris strike and lost ${impact} integrity. Repair crews are awaiting parts authorization.` }, ...next.log].slice(0, 12)
    }
  }
  if (nextSol === 37 && state.phase === 'expansion' && next.resources.integrity > 0) {
    next.debrisSurvived = true
    next.resources.confidence = clamp(round(next.resources.confidence + 3), 0, 100)
    next.log = [{ sol: nextSol, tone: 'success', message: 'The debris front has passed. Local maintenance teams kept every pressure system operational.' }, ...next.log].slice(0, 12)
  }

  // Capacity lost to damage cannot be recovered by repairing before the next tick.
  next.batteryCharge = Math.min(next.batteryCharge, colonyStats(next).batteryCapacity)

  const sponsorEvent = sponsorEventAt(state.sponsorId, nextSol, state.phase, state.resolvedEventIds)
  if (sponsorEvent) {
    next.pendingEventId = sponsorEvent.id
    next.speed = 0
    next.log = [{ sol: nextSol, tone: 'danger', message: `${sponsorEvent.authority} requires an immediate command decision: ${sponsorEvent.title}.` }, ...next.log].slice(0, 12)
  }

  const rivalEncounter = rivalEncounterAt(state.sponsorId, nextSol, state.phase, state.resolvedRivalEncounterIds)
  if (rivalEncounter) {
    next.pendingRivalEncounterId = rivalEncounter.id
    next.speed = 0
    next.log = [{ sol: nextSol, tone: 'warning', message: `${rivalEncounter.authority} requires a settlement policy: ${rivalEncounter.title}.` }, ...next.log].slice(0, 12)
  }

  if (!next.pendingEventId && !next.pendingRivalEncounterId) {
    const operationalIncident = operationalIncidentAt(next, nextSol)
    if (operationalIncident) {
      next.pendingOperationalIncidentId = operationalIncident.id
      next.speed = 0
      next.log = [{ sol: nextSol, tone: 'danger', message: `${operationalIncident.system} reports an immediate incident: ${operationalIncident.title}.` }, ...next.log].slice(0, 12)
    }
  }

  if (next.resources.integrity <= 0) {
    next.outcome = 'failure'
    next.speed = 0
  } else if (nextSol >= 24 && state.phase === 'survival') {
    const complete = missionObjectives(next).every((objective) => objective.complete)
    if (complete && !depleted) {
      next.phase = 'review'
      next.phaseOneCompleted = true
      next.transferWindowPending = true
      next.log = [{ sol: nextSol, tone: 'success', message: `The Sol 24 review confirms ${state.settlementName} as a viable city site. ${state.transferAuthority} has opened a second transfer window.` }, ...next.log].slice(0, 12)
    } else {
      next.outcome = 'dependent-outpost'
    }
    next.speed = 0
  } else if (nextSol >= 42 && state.phase === 'expansion') {
    const complete = missionObjectives(next).every((objective) => objective.complete)
    next.outcome = complete && colonyAssessment(next).viable ? 'permanent-city' : 'fragile-city'
    next.speed = 0
  }

  return next
}

export function serializeState(state) {
  return JSON.stringify(state)
}

export function restoreState(value) {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed?.buildings)) return null
    if (parsed.version === 9 && !validateRestoredState(parsed).valid) return null
    const legacySponsor = sponsorById('american-compact')
    const legacySponsorFields = {
      sponsorId: legacySponsor.id,
      sponsor: legacySponsor.name,
      earthYear: parsed.earthYear ?? legacySponsor.earthYear,
      settlementName: legacySponsor.settlementName,
      siteName: legacySponsor.siteName,
      transferAuthority: legacySponsor.transferAuthority,
    }
    const eventFields = { pendingEventId: null, resolvedEventIds: [] }
    const legacyRival = rivalSettlementFor(parsed.sponsorId ?? legacySponsor.id)
    const rivalFields = {
      rivalSettlementId: legacyRival?.id ?? null,
      rivalRelations: legacyRival?.startingRelations ?? 50,
      strategicPosition: legacyRival?.startingPosition ?? 50,
      pendingRivalEncounterId: null,
      resolvedRivalEncounterIds: [],
    }
    const upgradeToV9 = (candidate) => {
      const base = {
        siteSurveyProgress: 0,
        surveyedFeatureIds: [],
        sciencePoints: 0,
        batteryCharge: 0,
        pendingOperationalIncidentId: null,
        resolvedOperationalIncidentIds: [],
        decisionLog: [],
        ...candidate,
        version: 9,
        mechanicsVersion: 2,
        batteryCharge: candidate.mechanicsVersion === 2 ? candidate.batteryCharge ?? 0 : (candidate.batteryCharge ?? 0) * (6000 / 260),
        roverAssignments: { ...DEFAULT_ROVER_ASSIGNMENTS, ...(candidate.roverAssignments ?? {}) },
      }
      const crewMembers = ensureCrewMembers(base)
      const checked = validateRestoredState({
        ...base,
        crewMembers,
        crewLeadId: crewMembers.some((member) => member.id === base.crewLeadId) ? base.crewLeadId : crewMembers[0]?.id ?? null,
      })
      return checked.valid ? { ...checked.state, batteryCharge: Math.min(checked.state.batteryCharge, colonyStats(checked.state).batteryCapacity) } : null
    }
    if (parsed.version === 9) return upgradeToV9(parsed)
    if (parsed.version === 8) return upgradeToV9(parsed)
    if (parsed.version === 7) return upgradeToV9({ ...parsed, ...rivalFields })
    if (parsed.version === 6) return upgradeToV9({ ...parsed, ...eventFields, ...rivalFields })
    if (parsed.version === 5) {
      return upgradeToV9({ ...parsed, ...legacySponsorFields, ...eventFields, ...rivalFields })
    }
    if (parsed.version === 4) {
      return upgradeToV9({
        ...parsed,
        ...legacySponsorFields,
        ...eventFields,
        ...rivalFields,
        crewCohorts: inferLegacyCohorts(parsed),
        crossTraining: 'engineering',
      })
    }
    if (parsed.version === 3) {
      return upgradeToV9({
        ...parsed,
        ...legacySponsorFields,
        ...eventFields,
        ...rivalFields,
        roverFleet: 2,
        roverAssignments: { ...DEFAULT_ROVER_ASSIGNMENTS },
        crewCohorts: inferLegacyCohorts(parsed),
        crossTraining: 'engineering',
      })
    }
    if (parsed.version === 2) {
      return upgradeToV9({
        ...parsed,
        ...legacySponsorFields,
        ...eventFields,
        ...rivalFields,
        phase: 'survival',
        phaseOneCompleted: parsed.outcome === 'first-city',
        transferWindowPending: false,
        secondManifestId: null,
        secondManifestDoctrine: null,
        debrisSurvived: false,
        buildDiscounts: parsed.buildDiscounts ?? {},
        roverFleet: 2,
        roverAssignments: { ...DEFAULT_ROVER_ASSIGNMENTS },
        crewCohorts: { ...DEFAULT_CREW_COHORTS },
        crossTraining: 'engineering',
      })
    }
    if (parsed.version === 1) {
      return upgradeToV9({
        ...parsed,
        ...legacySponsorFields,
        ...eventFields,
        ...rivalFields,
        manifestId: LEGACY_MANIFEST.id,
        manifestDoctrine: LEGACY_MANIFEST.doctrine,
        buildDiscounts: {},
        phase: 'survival',
        phaseOneCompleted: parsed.outcome === 'first-city',
        transferWindowPending: false,
        secondManifestId: null,
        secondManifestDoctrine: null,
        debrisSurvived: false,
        roverFleet: 2,
        roverAssignments: { ...DEFAULT_ROVER_ASSIGNMENTS },
        crewCohorts: { ...DEFAULT_CREW_COHORTS },
        crossTraining: 'engineering',
      })
    }
    return null
  } catch {
    return null
  }
}
