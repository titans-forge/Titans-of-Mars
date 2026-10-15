import { BUILDINGS } from './buildings.js'
import { ensureCrewMembers, memberReadiness } from './crewMembers.js'
import { isOperational } from './buildingStatus.js'
import { constructionStatus } from './construction.js'
import { ROVER_ROUTE_ORDER } from './roverOperations.js'
import { iceDepositAt, surveyStatus } from './siteFeatures.js'

const key = (p) => `${p.col}:${p.row}`
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]]
const serviceDirections = [...directions, [1, 1], [1, -1], [-1, 1], [-1, -1]]
const inside = (p) => p.col >= 0 && p.col < 9 && p.row >= 0 && p.row < 6
const distance = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
export function surfacePath(from, to, occupied) {
  const valid = (p) => p && Number.isInteger(p.col) && Number.isInteger(p.row) && inside(p)
  if (!valid(from) || !valid(to) || occupied.has(key(from)) || occupied.has(key(to))) return []
  const queue = [from], previous = new Map([[key(from), null]])
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i]
    if (key(cell) === key(to)) {
      const path = [cell]
      let cursor = previous.get(key(cell))
      while (cursor) { path.unshift(cursor); cursor = previous.get(key(cursor)) }
      return path
    }
    const next = directions.map(([dc, dr]) => ({ col: cell.col + dc, row: cell.row + dr })).sort((a, b) => distance(a, to) - distance(b, to))
    for (const p of next) if (inside(p) && !occupied.has(key(p)) && !previous.has(key(p))) { previous.set(key(p), cell); queue.push(p) }
  }
  return []
}
// Derived presentation only: no saved actor clock, resource awards, or work credit.
export function colonyActivity(state, stats, running = false) {
  const occupied = new Set(state.buildings.map(key))
  const free = Array.from({ length: 54 }, (_, i) => ({ col: i % 9, row: Math.floor(i / 9) })).filter((p) => !occupied.has(key(p)))
  const cargo = state.buildings.find((b) => b.type === 'cargo') ?? { col: 1, row: 2 }
  const hub = free.slice().sort((a, b) => distance(a, cargo) - distance(b, cargo))[0]
  if (!hub || !state.manifestId) return { rovers: [], crew: [], running: false, activityRevision: 'not-authorized' }
  const port = (target, origin = hub) => {
    if (!target) return null
    if (!occupied.has(key(target))) return { col: target.col, row: target.row }
    // Delivered hardware and hand tools can service an exterior corner. Travel
    // still follows free cardinal cells; service reach never changes production.
    const ports = serviceDirections.map(([dc, dr]) => ({ col: target.col + dc, row: target.row + dr })).filter((p) => inside(p) && !occupied.has(key(p)))
    // Favor the visible foreground side so paused workers are not hidden by roofs.
    return ports.sort((a, b) => (b.col + b.row) - (a.col + a.row) || distance(a, origin) - distance(b, origin)).find((p) => surfacePath(origin, p, occupied).length) ?? null
  }
  const pathTo = (target) => surfacePath(hub, port(target), occupied)
  const live = state.buildings.filter((b) => isOperational(b) && stats.production[b.uid]?.online)
  const jobs = constructionStatus(state, stats)
  const survey = surveyStatus(state)
  // The operating ledger assigns haulers by nominal field yield, before damage
  // and staffing reduce delivery. Keep actors on that same actual assignment.
  const ice = live.filter((b) => b.type === 'ice').sort((a, b) => (iceDepositAt(state, b.col, b.row)?.yield ?? 0) - (iceDepositAt(state, a.col, a.row)?.yield ?? 0))
  const maintenance = live.slice().sort((a, b) => a.integrity - b.integrity || (a.type === 'solar' ? -1 : 0))
  const rovers = []
  let serial = 0
  for (const route of ROVER_ROUTE_ORDER) {
    for (let i = 0; i < stats.rovers.assignments[route]; i += 1) {
      serial += 1
      let target, label, status = 'active'
      if (route === 'water') { const assigned = ice[i]; target = assigned && stats.production[assigned.uid].water > 0 ? assigned : null; label = target ? `Hauling water · ${BUILDINGS[target.type].name}` : 'Ice haul standby · no supplied rig for this rover' }
      if (route === 'survey') { target = survey.next; label = target ? `Ground survey · ${target.title}` : 'Survey complete · awaiting reassignment' }
      if (route === 'construction') { target = jobs.capacity > 0 ? jobs.reachable[0] : null; label = target ? `Construction delivery · ${BUILDINGS[target.type].name}` : jobs.queue.length ? jobs.reason : 'Construction support · parked until a site is authorized' }
      if (route === 'maintenance') { target = maintenance[i % Math.max(1, maintenance.length)]; label = target ? `Inspection patrol · ${BUILDINGS[target.type].name}${target.integrity < 100 ? ' · damage requires repair authorization' : ''}` : 'Maintenance standby · no commissioned structure' }
      const path = target ? pathTo(target) : []
      if (!target || !path.length) status = 'standby'
      const parking = free[(serial * 3) % free.length] ?? hub
      rovers.push({ id: `${route}-${i}`, route, status, label, path: path.length ? path : [parking], workCell: port(target), targetCell: target ? { col: target.col, row: target.row } : null, targetUid: target?.uid ?? null })
    }
  }
  for (let i = 0; i < stats.rovers.available; i += 1) rovers.push({ id: `reserve-${i}`, route: 'reserve', status: 'parked', label: 'Unassigned rover · available in dispatch', path: [free[(i * 2 + 2) % free.length] ?? hub], workCell: null })
  const crew = []
  for (const cohort of ['engineering', 'operations', 'support']) {
    const member = ensureCrewMembers(state).filter((m) => m.cohort === cohort && m.health > 0 && m.fatigue < 78 && memberReadiness(m) > 0).sort((a, b) => memberReadiness(b) - memberReadiness(a))[0]
    if (!member) continue
    let target, task, label
    if (cohort === 'engineering') { target = jobs.capacity > 0 ? jobs.reachable[0] : maintenance[0]; task = jobs.capacity > 0 ? 'construction' : 'inspection'; label = jobs.capacity > 0 ? 'Assembly and commissioning' : 'Systems inspection' }
    if (cohort === 'operations') { target = live.find((b) => b.type === 'oxygen' && stats.production[b.uid].oxygen > 0) ?? ice.find((b) => stats.production[b.uid].water > 0); task = 'operations'; label = 'Checking supplied life-support equipment' }
    if (cohort === 'support') { target = live.find((b) => b.type === 'greenhouse' && stats.production[b.uid].food > 0); task = 'crop inspection'; label = 'Greenhouse sampling and crop care' }
    if (!target) continue
    const path = pathTo(target)
    if (!path.length) continue
    const shelter = stats.storm || stats.debris
    crew.push({ id: member.id, cohort, task, status: shelter ? 'shelter' : 'working', label: `${member.name} · ${shelter ? 'Sheltered during hazard; supervising systems remotely' : label}`, path: shelter ? [hub] : path, workCell: port(target), targetCell: { col: target.col, row: target.row }, targetUid: target.uid })
  }
  return { rovers, crew, running: Boolean(running), activityRevision: `${state.sol}:${state.buildings.length}:${jobs.workRemaining}:${ROVER_ROUTE_ORDER.map((r) => stats.rovers.assignments[r]).join('-')}` }
}
