import { BUILDINGS } from './buildings.js'
import { ensureCrewMembers, memberReadiness } from './crewMembers.js'
import { isCommissioned } from './buildingStatus.js'
import { cellWithinUtilityReach } from './utilityNetwork.js'

export const CONSTRUCTION_WORK = Object.freeze({ solar: 2, nuclear: 4, habitat: 3, oxygen: 2, ice: 2, workshop: 3, storage: 1, battery: 2, greenhouse: 3, recycling: 2 })
const down = (n) => Math.floor((n + 1e-8) * 10) / 10
const workRound = (n) => Math.round(n * 1000) / 1000
export function constructionStage(building) {
  if (isCommissioned(building)) return 'Operational'
  const fraction = building.construction.completedWork / building.construction.requiredWork
  return fraction < 0.2 ? 'Foundation' : fraction < 0.46 ? 'Frame & services' : fraction < 0.85 ? 'Assembly' : 'Commissioning'
}
export function constructionRefund(building) {
  if (!building?.construction) return null
  const job = building.construction
  const share = job.completedWork <= 0 ? 1 : (1 - job.completedWork / job.requiredWork) * 0.75
  return { parts: job.completedWork <= 0 ? job.paid.parts : down(job.paid.parts * share), cargo: job.completedWork <= 0 ? job.paid.cargo : down(job.paid.cargo * share) }
}
export function constructionStatus(state, stats) {
  // Stable ordering is shared by the work ledger, coaching and surface actors.
  const queue = state.buildings.filter((b) => b.construction).sort((a, b) => a.construction.startedSol - b.construction.startedSol)
  const reachable = queue.filter((b) => b.integrity > 0 && cellWithinUtilityReach(state.buildings, stats.network, b.col, b.row))
  const engineer = ensureCrewMembers(state).some((m) => m.cohort === 'engineering' && m.health > 0 && memberReadiness(m) > 0)
  const hold = Boolean(state.policyEffects?.restrictedConstructionDuringHazards && (stats.storm || stats.debris))
  const coverage = Math.min(stats.labor.ratios.engineering, stats.labor.readiness.engineering)
  const crewWork = stats.storm || stats.debris ? 0 : 0.5
  const capacity = !engineer || hold || !reachable.length ? 0 : Math.floor((crewWork + stats.rovers.assignments.construction) * coverage * 1000) / 1000
  const workRemaining = queue.reduce((n, b) => n + b.construction.requiredWork - b.construction.completedWork, 0)
  const reason = !queue.length ? 'No sites in the construction queue.' : hold ? 'Insurer hold during the active hazard; repairs and operating systems remain available.' : !engineer ? 'A medically fit assigned engineer must supervise construction.' : !reachable.length ? 'No pending site is within the commissioned utility network.' : capacity <= 0 ? 'Crew are sheltered. Assign Construction Support for remotely supervised rover work.' : 'One shared work budget is applied in queue order after this sol’s operating ledger.'
  return { queue, reachable, capacity, workRemaining: workRound(workRemaining), nominalSols: capacity > 0 ? Math.ceil(workRemaining / capacity) : null, reason, engineer, hold }
}
// Called only by the shared sol reducer. A completion cannot bridge another job
// in this tick: all reachable sites and the finite budget come from the old grid.
export function advanceConstruction(state, stats) {
  const status = constructionStatus(state, stats)
  if (status.capacity <= 0) return state.buildings
  let budget = status.capacity
  const reachable = new Set(status.reachable.map((b) => b.uid))
  const updates = new Map()
  for (const b of status.queue) {
    if (budget <= 0 || !reachable.has(b.uid)) continue
    const job = b.construction
    const work = Math.min(budget, job.requiredWork - job.completedWork)
    budget = workRound(budget - work)
    const completedWork = workRound(job.completedWork + work)
    updates.set(b.uid, { ...b, construction: completedWork >= job.requiredWork - 1e-8 ? null : { ...job, completedWork } })
  }
  return state.buildings.map((b) => updates.get(b.uid) ?? b)
}
export function nextBuildingUid(state, type) {
  const ids = new Set(state.buildings.map((b) => b.uid))
  let n = state.buildings.length + 1
  while (ids.has(`${type}-${state.sol}-${n}`)) n += 1
  return `${type}-${state.sol}-${n}`
}
