import { createInitialState } from '../../src/game/initialState.js'
import { manifestsForSponsor } from '../../src/game/manifests.js'
import { followOnManifestsForSponsor } from '../../src/game/followOnManifests.js'
import { siteForSponsor, surveyStatus } from '../../src/game/siteFeatures.js'
import { sponsorEventById } from '../../src/game/sponsorEvents.js'
import { rivalEncounterById } from '../../src/game/rivalSettlements.js'
import { operationalIncidentById } from '../../src/game/operationalIncidents.js'
import { ensureCrewMembers } from '../../src/game/crewMembers.js'
import { BUILDINGS } from '../../src/game/buildings.js'
import { advanceSol, applyManifest, applyFollowOnManifest, applySponsorEventChoice, applyRivalEncounterChoice, applyOperationalIncidentChoice, buildingCost, canPlaceBuilding, colonyAssessment, colonyStats, decisionEligibility, decisionOptions, followOnEligibility, missionObjectives, placeBuilding, repairBuilding, updateCrewLead, updateCrossTraining, updateRoverAssignment } from '../../src/game/simulation.js'
import { campaignReport } from '../../src/game/campaignReport.js'

const POSITION = { nuclear: [[4, 2]], habitat: [[4, 3], [5, 4]], oxygen: [[2, 3], [5, 2]], workshop: [[2, 2]], greenhouse: [[5, 3]], recycling: [[3, 3]], storage: [[4, 4]], battery: [[3, 2]] }
const finiteJSON = (key, value) => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value
export { finiteJSON }

export function runNativeCampaign(sponsorId, openingId, followOnId, { solar = false, stopAt = 42 } = {}) {
  let state = createInitialState(sponsorId)
  const initial = { sol: state.sol, surveyed: [...state.surveyedFeatureIds], resources: { ...state.resources }, buildings: state.buildings.map((b) => ({ ...b })) }
  const actions = [], ticks = [], failures = [], checkpoints = {}
  let attempts = 0
  const commit = (result, action, details = {}) => {
    attempts += 1
    if (attempts > 1000) throw new Error('Native campaign action guard exceeded')
    if (result.error) return false
    state = result.state
    actions.push({ sol: state.sol, action, ...details })
    return true
  }
  const assign = (desired) => {
    for (const route of ['water', 'construction', 'maintenance', 'survey']) {
      while ((state.roverAssignments[route] ?? 0) > (desired[route] ?? 0)) {
        if (!commit(updateRoverAssignment(state, route, -1), 'recall rover', { route })) return false
      }
    }
    for (const route of ['water', 'construction', 'maintenance', 'survey']) {
      while ((state.roverAssignments[route] ?? 0) < (desired[route] ?? 0)) {
        if (!commit(updateRoverAssignment(state, route, 1), 'assign rover', { route })) return false
      }
    }
    return true
  }
  const lead = (trait) => {
    const member = ensureCrewMembers(state).find((m) => m.trait === trait && m.health > 0)
    return member ? commit(updateCrewLead(state, member.id), 'set mission lead', { memberId: member.id, trait }) : false
  }
  const optimizeStaffing = () => {
    let best = null
    for (const member of ensureCrewMembers(state)) for (const focus of ['engineering', 'operations', 'support']) {
      const officer = updateCrewLead(state, member.id)
      if (officer.error) continue
      const trained = updateCrossTraining(officer.state, focus)
      if (trained.error) continue
      const stats = colonyStats(trained.state)
      const minRatio = Math.min(...Object.values(stats.labor.ratios))
      // A medically led recovery shift is a real opportunity cost, not a free stat boost.
      // Use it before the final review while minimum operating coverage remains >=70%.
      const restPreference = member.trait === 'medical' && state.sol < 41 && minRatio >= 0.7 ? 200 : 0
      const score = minRatio * 1000 + stats.labor.ratios.operations * 10 + restPreference
      if (!best || score > best.score) best = { score, memberId: member.id, focus }
    }
    if (best) {
      if (state.crewLeadId !== best.memberId) commit(updateCrewLead(state, best.memberId), 'balance lead', { memberId: best.memberId })
      if (state.crossTraining !== best.focus) commit(updateCrossTraining(state, best.focus), 'balance training', { focus: best.focus })
    }
  }
  const candidates = (type) => {
    if (type === 'ice') return surveyStatus(state).discovered.slice().sort((a, b) => b.yield - a.yield).map((f) => [f.col, f.row])
    const ridge = siteForSponsor(sponsorId).features.filter((f) => f.kind === 'solar')
    if (type === 'solar') return [...ridge.map((f) => [f.col, f.row]), ...Array.from({ length: 54 }, (_, i) => [i % 9, Math.floor(i / 9)])]
    return [...(POSITION[type] ?? []), ...Array.from({ length: 54 }, (_, i) => [i % 9, Math.floor(i / 9)])].filter(([col, row]) => !ridge.some((f) => f.col === col && f.row === row))
  }
  const build = (type) => {
    for (const [col, row] of candidates(type)) {
      if (!canPlaceBuilding(state, type, col, row).ok) continue
      const cost = buildingCost(state, type)
      const result = placeBuilding(state, type, col, row)
      const placed = result.state.buildings.at(-1)
      return commit(result, 'construct', { type, col, row, cost, uid: placed.uid, requiredWork: placed.construction?.requiredWork })
    }
    return false
  }
  const resolve = () => {
    let guard = 0
    while ((state.pendingEventId || state.pendingRivalEncounterId || state.pendingOperationalIncidentId) && !state.outcome) {
      if (guard++ > 5) throw new Error('Decision guard exceeded')
      const kind = state.pendingEventId ? 'sponsor' : state.pendingRivalEncounterId ? 'rival' : 'incident'
      const definition = kind === 'sponsor' ? sponsorEventById(state.pendingEventId) : kind === 'rival' ? rivalEncounterById(state.pendingRivalEncounterId) : operationalIncidentById(state.pendingOperationalIncidentId)
      const options = decisionOptions(state, definition).filter((choice) => decisionEligibility(state, choice).eligible)
      const value = (choice) => {
        const crew = Object.values(choice.crewEffects ?? {}).reduce((n, fx) => n + (fx.health ?? 0) * 2 - (fx.fatigue ?? 0), 0)
        return (choice.effects?.confidence ?? 0) * (state.sol < 24 ? 4 : 1) + (choice.relations ?? 0) + (choice.science ?? 0) * 2 + crew + (choice.effects?.parts ?? 0) * 0.08 - (choice.damage ?? 0) - (choice.effects?.cargo < 0 ? 4 : 0)
      }
      options.sort((a, b) => value(b) - value(a))
      const choice = options[0]
      if (!choice) throw new Error('No affordable incident resolution')
      const handler = kind === 'sponsor' ? applySponsorEventChoice : kind === 'rival' ? applyRivalEncounterChoice : applyOperationalIncidentChoice
      if (!commit(handler(state, choice.id), 'resolve decision', { kind, decision: definition.id, choice: choice.id })) throw new Error('A displayed affordable choice failed')
    }
  }
  const repair = () => {
    const damaged = state.buildings.filter((b) => b.integrity < 100).sort((a, b) => a.integrity - b.integrity)
    for (const b of damaged) commit(repairBuilding(state, b.uid), 'repair', { uid: b.uid, type: b.type })
  }
  const step = () => {
    resolve()
    if (state.outcome || state.transferWindowPending) return false
    const before = state
    const stats = colonyStats(before)
    state = advanceSol(before)
    if (state.sol !== before.sol + 1) throw new Error(`Expected one native sol at ${before.sol}`)
    const delivered = ['water', 'oxygen', 'food', 'parts'].every((key) => {
      const cap = key === 'water' ? stats.waterCapacity : key === 'oxygen' ? stats.oxygenCapacity : key === 'food' ? 1000 : 999
      const expected = Math.max(0, Math.min(cap, Math.round((before.resources[key] + stats[`${key}Net`]) * 10) / 10))
      return Math.abs(state.resources[key] - expected) < 0.11
    })
    const jobs = (mission) => mission.buildings.filter((building) => building.construction).map((building) => ({ uid: building.uid, type: building.type, requiredWork: building.construction.requiredWork, completedWork: building.construction.completedWork }))
    const constructionBefore = jobs(before), constructionAfter = jobs(state)
    const commissioned = constructionBefore.filter((job) => state.buildings.some((building) => building.uid === job.uid && !building.construction)).map((job) => job.uid)
    ticks.push({ fromSol: before.sol, toSol: state.sol, phase: before.phase, storm: stats.storm, batteryBefore: before.batteryCharge, batteryAfter: state.batteryCharge, powerRatio: stats.powerRatio, batteryDispatchKWh: stats.batteryEnergyDispatched, predictedResourcesMatch: delivered, constructionBefore, constructionAfter, commissioned, resources: { ...state.resources }, labor: { ...stats.labor.ratios } })
    resolve()
    return true
  }
  const commissionQueue = () => {
    let guard = 0
    while (state.buildings.some((building) => building.construction) && !state.outcome && !state.transferWindowPending) {
      if (guard++ >= 20) { failures.push('Construction queue did not commission within 20 native sols'); return false }
      repair()
      optimizeStaffing()
      if (!step()) return false
    }
    return !state.buildings.some((building) => building.construction)
  }
  commit(applyManifest(state, openingId), 'authorize opening', { openingId })
  // Two support rovers are actual allocations, with one-sol construction commitments respected.
  assign({ construction: state.roverFleet })
  lead('logistics')
  if (solar) {
    for (let i = 0; i < 3; i += 1) if (!build('solar')) failures.push('Initial ridge solar unavailable')
    if (!build('battery')) failures.push('Initial battery unavailable')
  } else if (!build('nuclear')) failures.push('Initial reactor unavailable')
  for (const type of ['habitat', 'oxygen', 'workshop']) if (!build(type)) failures.push(`Initial ${type} unavailable`)
  commissionQueue()
  assign({ survey: state.roverFleet })
  lead('science')
  while (!surveyStatus(state).complete && !state.outcome && state.sol < 16) step()
  assign({ construction: state.roverFleet })
  lead('logistics')
  let icePlaced = build('ice')
  // A low-capital opening may need an already commissioned workshop to earn
  // the last spares before authorizing its rig. Waiting pays real daily costs.
  for (let guard = 0; !icePlaced && state.resources.parts < buildingCost(state, 'ice').parts && colonyStats(state).partsNet > 0 && state.sol < 16 && guard < 6; guard += 1) {
    if (!step()) break
    icePlaced = build('ice')
  }
  if (!icePlaced) failures.push('Confirmed ice placement unavailable')
  commissionQueue()
  assign({ water: 1, maintenance: state.roverFleet - 1 })
  optimizeStaffing()
  while (!state.outcome && !state.transferWindowPending && state.sol < 25) { repair(); optimizeStaffing(); step() }
  let followOnStatus = null
  if (state.transferWindowPending) checkpoints.review = state
  if (state.transferWindowPending && stopAt > 24) {
    followOnStatus = followOnEligibility(state, followOnId)
    if (followOnStatus.eligible) {
      commit(applyFollowOnManifest(state, followOnId), 'authorize follow-on', { followOnId })
      assign({ construction: state.roverFleet })
      lead('logistics')
      if (state.crew > 8 && !build('habitat')) failures.push('Permanent crew housing unavailable')
      for (const type of ['greenhouse', 'recycling', 'storage']) if (!build(type)) failures.push(`Expansion ${type} unavailable`)
      if (state.crew > 8 && !build('oxygen')) failures.push('Second oxygen plant unavailable')
      checkpoints.expansion = state
      commissionQueue()
      assign({ water: 1, maintenance: state.roverFleet - 1 })
      optimizeStaffing()
      while (!state.outcome && state.sol < stopAt) { repair(); optimizeStaffing(); step() }
    } else failures.push(`Follow-on legitimately locked: ${followOnStatus.reason}`)
  }
  const stats = colonyStats(state), assessment = colonyAssessment(state), objectives = missionObjectives(state), report = campaignReport(state, objectives)
  return { sponsorId, openingId, followOnId, solar, initial, state, actions, ticks, failures, checkpoints, followOnStatus, assessment, report, summary: { sponsorId, openingId, followOnId, solar, sol: state.sol, outcome: state.outcome, phase: state.phase, confidence: state.resources.confidence, resources: state.resources, totals: { waterNet: stats.waterNet, oxygenNet: stats.oxygenNet, foodNet: stats.foodNet, partsNet: stats.partsNet, powerReserve: stats.powerCapacity - stats.powerDemand }, labor: stats.labor.ratios, objectives: objectives.map((o) => ({ id: o.id, complete: o.complete })), viable: assessment.viable, independent: assessment.independent, constraints: assessment.constraints, overallGrade: report.overallGrade, grades: report.grades.map((g) => ({ id: g.id, grade: g.grade, score: g.score })), failures, actionCount: actions.length, ticks: ticks.length, dustTickCount: ticks.filter((tick) => tick.storm).length, forecastsMatchActualTicks: ticks.every((tick) => tick.predictedResourcesMatch) } }
}

export function evaluateNativePermutations() {
  const results = []
  for (const sponsor of ['american-compact', 'china-directorate', 'europe-cooperative', 'russia-directorate']) for (const opening of manifestsForSponsor(sponsor)) for (const followOn of followOnManifestsForSponsor(sponsor)) results.push(runNativeCampaign(sponsor, opening.id, followOn.id))
  return results
}
