import { constructionStatus } from '../game/construction.js'
import { crewLead } from '../game/crewMembers.js'
import { BUILDINGS } from '../game/buildings.js'
import { buildingCost, canPlaceBuilding, colonyStats, placeBuilding } from '../game/simulation.js'
import { surveyStatus } from '../game/siteFeatures.js'

export const LEARNING_SOL_MS = 5000

export function reserveCoverage(amount, net) {
  if (!Number.isFinite(amount) || !Number.isFinite(net)) return 'Unavailable'
  if (amount <= 0) return 'Empty'
  return net < 0 ? `${Math.floor(amount / -net)} sols at current use` : 'Stable at current balance'
}

export function nextMissionAction(state, stats) {
  const survey = surveyStatus(state)
  if (!state.manifestId) return { title: 'Authorize your founding payload', detail: 'Choose a sponsor and transfer doctrine to begin.', action: null }
  if (state.outcome) return { title: 'Mission complete — inspect your colony', detail: 'The simulation is frozen. Review your reserves, structures and final audit.', action: 'report' }
  const jobs = constructionStatus(state, stats)
  if (jobs.queue.length) return { title: `Commission ${jobs.queue.length} authorized worksite${jobs.queue.length === 1 ? '' : 's'}`, detail: `${jobs.capacity.toFixed(2)} work units per sol; ${jobs.nominalSols ? `about ${jobs.nominalSols} sols at the current work rate.` : jobs.reason} Sites do not supply the grid until complete.`, action: jobs.capacity > 0 ? 'step' : 'rovers', label: jobs.capacity > 0 ? 'Advance 1 construction sol' : 'Review construction dispatch' }
  if (!survey.discovered.length) {
    const assigned = stats.rovers.assignments.survey ?? 0
    const scienceBonus = crewLead(state)?.trait === 'science' ? 1 : 0
    const estimate = assigned ? Math.ceil(Math.max(0, survey.next.surveyThreshold - survey.progress) / (assigned + scienceBonus)) : null
    return assigned
      ? { title: 'Confirm the first ice lens', detail: `Ground Survey needs about ${estimate} more sol${estimate === 1 ? '' : 's'}. Close dispatch and use +1 sol.`, action: 'step', label: 'Advance 1 sol' }
      : { title: 'First: assign a Ground Survey rover', detail: 'Open Rover Dispatch. Remove a rover from another route, then add it to Ground Survey. Ice is not confirmed yet.', action: 'rovers', label: 'Open Rover Dispatch' }
  }
  if (!state.buildings.some((item) => item.type === 'ice' && stats.network.connectedUids.includes(item.uid))) {
    const lens = survey.discovered[0]
    return { title: 'Commission your first ice rig', detail: `${lens.title} is confirmed at column ${lens.col + 1}, row ${lens.row + 1}. Select Ice Extraction Rig and place it there; extend the utility grid if needed.`, action: 'ice', label: 'Plan ice rig' }
  }
  if ((stats.rovers.assignments.water ?? 0) < stats.rovers.activeIceRigs) return { title: 'Restore water hauling', detail: 'A confirmed rig still needs haul capacity. Move a survey rover to Ice Haul for full field yield. Keep surveying later for science.', action: 'rovers', label: 'Manage hauling' }
  if (!state.buildings.some((item) => item.type === 'habitat' && stats.network.connectedUids.includes(item.uid))) return { title: 'Give the crew a pressure habitat', detail: 'Commission connected housing before Sol 6. Check power and the construction forecast.', action: 'habitat', label: 'Plan habitat' }
  if (!state.buildings.some((item) => item.type === 'oxygen' && stats.network.connectedUids.includes(item.uid))) return { title: 'Produce oxygen locally', detail: 'An oxygen plant requires power, water feedstock and staffed operations. Review the forecast before building.', action: 'oxygen', label: 'Plan oxygen plant' }
  if (stats.powerCapacity < stats.powerDemand) return { title: 'Resolve the power shortage', detail: 'Local production is curtailed. Pause, inspect the power balance and add reliable generation.', action: 'nuclear', label: 'Plan resilient power' }
  if (stats.labor.ratios.engineering < 0.75 || stats.labor.ratios.operations < 0.75) return { title: 'Review essential staffing', detail: 'Crew readiness and cross-training change effective production. Avoid building beyond your workforce.', action: 'crew', label: 'Open Crew Roster' }
  return { title: 'Review reserves before advancing', detail: 'Complete every mission objective and inspect declining reserves. Further Ground Survey improves science; the next review assesses viable life support, not just buildings.', action: 'objectives', label: 'View objectives' }
}

export function constructionPreview(state, type, col, row) {
  if (!BUILDINGS[type]?.buildable) return null
  const availability = canPlaceBuilding(state, type, col, row)
  const cost = buildingCost(state, type)
  if (!availability.ok) return { ...availability, cost }
  const result = placeBuilding(state, type, col, row)
  if (result.error) return { ok: false, reason: result.error, cost }
  const during = colonyStats(result.state)
  const commissioned = { ...result.state, buildings: result.state.buildings.map((b) => b.construction ? { ...b, construction: null } : b) }
  const after = colonyStats(commissioned)
  const storm = colonyStats({ ...commissioned, sol: 18 })
  return { ok: true, cost, during, construction: constructionStatus(result.state, during), after, storm, name: BUILDINGS[type].name }
}
