import { BUILDINGS } from './buildings.js'
import { CONSTRUCTION_WORK } from './construction.js'
import { CROSS_TRAINING_ROLES } from './crewLabor.js'
import { createCrewMembers } from './crewMembers.js'
import { followOnManifestById } from './followOnManifests.js'
import { manifestById } from './manifests.js'
import { INCIDENT_SLOTS, operationalIncidentById } from './operationalIncidents.js'
import { rivalSettlementFor } from './rivalSettlements.js'
import { ROVER_ROUTE_ORDER } from './roverOperations.js'
import { siteForSponsor } from './siteFeatures.js'
import { sponsorEventById } from './sponsorEvents.js'
import { sponsorById } from './sponsors.js'

const COHORTS = ['engineering', 'operations', 'support', 'residents']
const OUTCOMES = [null, 'first-city', 'dependent-outpost', 'permanent-city', 'fragile-city', 'failure']
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const finite = (value, min = 0, max = 1e6) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const integer = (value, min = 0, max = 1e6) => finite(value, min, max) && Number.isInteger(value)
const text = (value, max = 1000) => typeof value === 'string' && value.length > 0 && value.length <= max
const id = (value) => text(value, 100) && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)

// Called only after version-specific migration. It does not import simulation.js,
// so a restore can validate its complete state before any simulation code runs.
export function validateRestoredState(candidate) {
  const errors = []
  const check = (condition, message) => { if (!condition && errors.length < 24) errors.push(message) }
  if (!record(candidate)) return { valid: false, state: null, errors: ['The save must contain one mission object.'] }
  let nodes = 0
  const safeTree = (value, depth = 0) => {
    if (++nodes > 15000 || depth > 14) return false
    if (typeof value === 'number') return Number.isFinite(value)
    if (value === null || ['string', 'boolean'].includes(typeof value)) return typeof value !== 'string' || value.length <= 10000
    if (Array.isArray(value)) return value.length <= 1000 && value.every((child) => safeTree(child, depth + 1))
    return record(value) && Object.entries(value).every(([key, child]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeTree(child, depth + 1))
  }
  check(safeTree(candidate), 'The save contains unsupported values or is too large.')
  check(candidate.version === 9, 'Unsupported migrated save version.')
  check(candidate.mechanicsVersion === undefined || candidate.mechanicsVersion === 2, 'Unsupported simulation rules version.')
  check(integer(candidate.sol, 1, 1000), 'Sol must be a positive whole number.')
  check([0, 1, 4, 12].includes(candidate.speed), 'Unknown simulation speed.')
  check(['survival', 'review', 'expansion'].includes(candidate.phase), 'Unknown mission phase.')
  check(OUTCOMES.includes(candidate.outcome), 'Unknown mission outcome.')
  for (const field of ['phaseOneCompleted', 'transferWindowPending', 'debrisSurvived', 'stormSurvived']) check(typeof candidate[field] === 'boolean', `Missing or invalid ${field}.`)
  for (const field of ['sponsor', 'settlementName', 'siteName', 'transferAuthority']) check(text(candidate[field], 200), `Missing or invalid ${field}.`)
  check(integer(candidate.earthYear, 2000, 2200), 'Invalid mission year.')
  const sponsorDefinition = typeof candidate.sponsorId === 'string' ? sponsorById(candidate.sponsorId) : null
  const sponsor = sponsorDefinition?.id === candidate.sponsorId && typeof sponsorDefinition?.id === 'string' ? sponsorDefinition : null
  check(candidate.sponsorId === null || Boolean(sponsor), 'Unknown founding sponsor.')
  const manifestDefinition = typeof candidate.manifestId === 'string' ? manifestById(candidate.manifestId) : null
  const manifest = manifestDefinition?.id === candidate.manifestId && typeof manifestDefinition?.id === 'string' ? manifestDefinition : null
  check(candidate.manifestId === null || Boolean(manifest), 'Unknown founding manifest.')
  check(!manifest || manifest.sponsorId === candidate.sponsorId, 'Founding manifest belongs to another sponsor.')
  check(manifest ? candidate.manifestDoctrine === manifest.doctrine : candidate.manifestDoctrine === null, 'Founding doctrine does not match the manifest.')
  const secondDefinition = typeof candidate.secondManifestId === 'string' ? followOnManifestById(candidate.secondManifestId) : null
  const second = secondDefinition?.id === candidate.secondManifestId && typeof secondDefinition?.id === 'string' ? secondDefinition : null
  check(candidate.secondManifestId === null || Boolean(second), 'Unknown follow-on manifest.')
  check(!second || (Boolean(manifest) && second.sponsorId === candidate.sponsorId), 'Follow-on manifest belongs to another sponsor.')
  check(second ? candidate.secondManifestDoctrine === second.doctrine : candidate.secondManifestDoctrine === null, 'Follow-on doctrine does not match its manifest.')
  check(!second || candidate.phase === 'expansion', 'A follow-on manifest requires the expansion phase.')
  check(candidate.phase !== 'expansion' || (Boolean(second) && candidate.phaseOneCompleted && candidate.sol >= 24), 'Expansion has no completed first review or follow-on manifest.')
  check(candidate.phase !== 'review' || (candidate.phaseOneCompleted && candidate.transferWindowPending && !second && candidate.sol >= 24), 'Invalid second-window review state.')
  check(!candidate.transferWindowPending || candidate.phase === 'review', 'Transfer decision is outside the review phase.')
  check(Boolean(manifest) || (candidate.sol === 1 && candidate.phase === 'survival' && !candidate.outcome), 'An active mission needs a founding manifest.')
  check(candidate.sponsorId !== null || !manifest, 'Select a sponsor before a manifest.')

  const resources = candidate.resources
  check(record(resources), 'Missing resource reserves.')
  if (record(resources)) {
    for (const key of ['water', 'oxygen', 'food', 'parts', 'cargo', 'confidence', 'integrity']) {
      const maximum = ['confidence', 'integrity'].includes(key) ? 100 : 1e6
      check(own(resources, key) && finite(resources[key], 0, maximum), `Invalid ${key} reserve.`)
    }
    check(Object.keys(resources).every((key) => ['water', 'oxygen', 'food', 'parts', 'cargo', 'confidence', 'integrity'].includes(key)), 'Unknown resource type.')
  }
  check(integer(candidate.crew, 1, 10) && candidate.crew === 6 + (second?.crew ?? 0), 'Crew count does not match the accepted transfers.')
  check(record(candidate.crewCohorts) && Object.keys(candidate.crewCohorts).length === COHORTS.length, 'Invalid crew cohort record.')
  if (record(candidate.crewCohorts)) {
    check(COHORTS.every((key) => integer(candidate.crewCohorts[key], 0, 10)), 'Invalid crew cohort size.')
    check(Object.keys(candidate.crewCohorts).every((key) => COHORTS.includes(key)), 'Unknown crew cohort.')
    check(Object.values(candidate.crewCohorts).reduce((sum, value) => sum + value, 0) === candidate.crew, 'Crew cohort sizes do not match the crew total.')
  }
  check(CROSS_TRAINING_ROLES.includes(candidate.crossTraining), 'Unknown cross-training role.')
  const members = candidate.crewMembers
  const roster = createCrewMembers(sponsor?.id, 10)
  const rosterById = new Map(roster.map((member) => [member.id, member]))
  check(Array.isArray(members) && members.length === candidate.crew, 'Crew roster does not match the crew total.')
  if (Array.isArray(members)) {
    const seen = new Set()
    members.forEach((member) => {
      check(record(member), 'Invalid crew member.')
      if (!record(member)) return
      const original = rosterById.get(member.id)
      check(Boolean(original) && !seen.has(member.id), 'Unknown or duplicate crew member ID.')
      seen.add(member.id)
      check(text(member.name, 100) && text(member.role, 100) && COHORTS.includes(member.cohort), 'Invalid crew identity or role.')
      check(original?.trait === member.trait, 'Crew specialty does not match the named officer.')
      check(finite(member.health, 0, 100) && finite(member.fatigue, 0, 100), 'Invalid crew health or fatigue.')
      check(member.active === undefined || typeof member.active === 'boolean', 'Invalid crew activity flag.')
    })
    check(members.some((member) => member?.id === candidate.crewLeadId), 'Mission lead is not a current crew member.')
  }
  const expectedFleet = (sponsor?.roverFleet ?? 2) + (manifest?.rovers ?? 0) + (second?.rovers ?? 0)
  check(integer(candidate.roverFleet, 0, 10) && candidate.roverFleet === expectedFleet, 'Rover fleet does not match the accepted transfers.')
  check(record(candidate.roverAssignments), 'Missing rover assignments.')
  if (record(candidate.roverAssignments)) {
    check(Object.keys(candidate.roverAssignments).length === ROVER_ROUTE_ORDER.length && Object.keys(candidate.roverAssignments).every((route) => ROVER_ROUTE_ORDER.includes(route)), 'Unknown rover route.')
    check(ROVER_ROUTE_ORDER.every((route) => integer(candidate.roverAssignments[route], 0, candidate.roverFleet)), 'Invalid rover assignment count.')
    check(Object.values(candidate.roverAssignments).reduce((sum, count) => sum + count, 0) <= candidate.roverFleet, 'More rovers assigned than available.')
  }
  check(record(candidate.buildDiscounts), 'Invalid construction discounts.')
  if (record(candidate.buildDiscounts)) Object.entries(candidate.buildDiscounts).forEach(([type, discount]) => {
    check(Boolean(BUILDINGS[type]?.cost) && record(discount), 'Unknown construction discount.')
    if (!record(discount)) return
    check(Object.keys(discount).every((key) => ['parts', 'cargo'].includes(key)), 'Unknown construction discount resource.')
    for (const key of ['parts', 'cargo']) {
      const allowed = Math.max(manifest?.discounts?.[type]?.[key] ?? 0, second?.discounts?.[type]?.[key] ?? 0)
      check(finite(discount[key], 0, allowed), 'Construction discount exceeds its accepted manifest.')
    }
  })

  const buildings = candidate.buildings
  check(Array.isArray(buildings) && buildings.length > 0 && buildings.length <= 54, 'Invalid building list.')
  const buildingIds = new Set()
  const cells = new Set()
  if (Array.isArray(buildings)) {
    buildings.forEach((building) => {
      check(record(building), 'Invalid building record.')
      if (!record(building)) return
      check(id(building.uid) && !buildingIds.has(building.uid), 'Invalid or duplicate building ID.')
      buildingIds.add(building.uid)
      check(own(BUILDINGS, building.type), 'Unknown building type.')
      check(integer(building.col, 0, 8) && integer(building.row, 0, 5), 'Building is outside the settlement grid.')
      const cell = `${building.col},${building.row}`
      check(!cells.has(cell), 'Two buildings occupy the same grid cell.')
      cells.add(cell)
      check(finite(building.integrity, 0, 100), 'Invalid building integrity.')
      // Missing/null jobs are commissioned legacy structures. A persisted job
      // must still have work left; commissioning removes it atomically.
      if (building.construction !== undefined && building.construction !== null) {
        const job = building.construction
        const definition = BUILDINGS[building.type]
        check(definition?.buildable === true, 'A landed command shelter cannot be under construction.')
        check(record(job) && Object.keys(job).length === 4 && Object.keys(job).every((key) => ['requiredWork', 'completedWork', 'paid', 'startedSol'].includes(key)), 'Invalid construction job record.')
        if (!record(job)) return
        check(finite(job.requiredWork, Number.MIN_VALUE, 20) && job.requiredWork === CONSTRUCTION_WORK[building.type], 'Invalid required construction work.')
        check(finite(job.completedWork, 0, 20) && job.completedWork < job.requiredWork, 'Invalid completed construction work.')
        check(integer(job.startedSol, 1, candidate.sol), 'Invalid construction start sol.')
        const paid = job.paid
        check(record(paid) && Object.keys(paid).length === 2 && Object.keys(paid).every((key) => ['parts', 'cargo'].includes(key)), 'Invalid paid construction cost.')
        if (record(paid)) {
          const partsLimit = Math.min(1000, definition?.cost?.parts ?? 0)
          // The insurance clause can increase imported mass after discounts.
          const cargoLimit = Math.min(99, Math.round((definition?.cost?.cargo ?? 0) * 2 * 10) / 10)
          check(finite(paid.parts, 0, partsLimit) && finite(paid.cargo, 0, cargoLimit), 'Paid construction cost exceeds the building capital cost.')
        }
      }
    })
    check(buildings.filter((building) => building?.type === 'cargo').length === 1, 'A mission must retain its single landed command shelter.')
  }
  check(candidate.selectedUid === null || buildingIds.has(candidate.selectedUid), 'Selected building does not exist.')
  check(candidate.buildMode === null || BUILDINGS[candidate.buildMode]?.buildable === true, 'Unknown construction selection.')
  check(finite(candidate.siteSurveyProgress, 0, 1e5) && finite(candidate.sciencePoints, 0, 1e5), 'Invalid survey progress or science total.')
  check(finite(candidate.batteryCharge, 0, 1e6), 'Invalid stored energy.')
  if (candidate.policyEffects !== undefined) {
    const effects = candidate.policyEffects
    check(record(effects) && Object.keys(effects).every((key) => ['maintenanceMultiplier', 'constructionCargoMultiplier', 'surveyBonus', 'restrictedConstructionDuringHazards'].includes(key)), 'Invalid persistent policy effects.')
    if (record(effects)) {
      check(effects.maintenanceMultiplier === undefined || finite(effects.maintenanceMultiplier, 0.5, 2), 'Invalid policy maintenance multiplier.')
      check(effects.constructionCargoMultiplier === undefined || finite(effects.constructionCargoMultiplier, 0.5, 2), 'Invalid policy construction multiplier.')
      check(effects.restrictedConstructionDuringHazards === undefined || typeof effects.restrictedConstructionDuringHazards === 'boolean', 'Invalid policy construction hazard flag.')
      check(effects.surveyBonus === undefined || integer(effects.surveyBonus, 0, 2), 'Invalid policy survey bonus.')
    }
  }
  if (candidate.assignmentCommitment !== undefined && candidate.assignmentCommitment !== null) {
    const commitment = candidate.assignmentCommitment
    check(record(commitment), 'Invalid assignment commitment.')
    if (record(commitment)) {
      check(integer(commitment.sol, 1, candidate.sol), 'Invalid assignment commitment sol.')
      check(commitment.crewLeadId === null || (Array.isArray(members) && members.some((member) => member?.id === commitment.crewLeadId)), 'Assignment commitment names an unknown mission officer.')
      const assignments = commitment.roverAssignments
      check(record(assignments) && Object.keys(assignments).length === ROVER_ROUTE_ORDER.length && Object.keys(assignments).every((route) => ROVER_ROUTE_ORDER.includes(route)), 'Invalid committed rover routes.')
      if (record(assignments)) {
        check(ROVER_ROUTE_ORDER.every((route) => integer(assignments[route], 0, candidate.roverFleet)), 'Invalid committed rover assignment.')
        check(Object.values(assignments).reduce((sum, count) => sum + count, 0) <= candidate.roverFleet, 'Committed assignments exceed the rover fleet.')
      }
    }
  }
  const site = siteForSponsor(sponsor?.id)
  check(Array.isArray(candidate.surveyedFeatureIds) && candidate.surveyedFeatureIds.length <= site.features.length, 'Invalid surveyed-site record.')
  if (Array.isArray(candidate.surveyedFeatureIds)) {
    check(new Set(candidate.surveyedFeatureIds).size === candidate.surveyedFeatureIds.length, 'Duplicate surveyed feature.')
    check(candidate.surveyedFeatureIds.every((featureId) => site.features.some((feature) => feature.id === featureId && feature.requiresSurvey)), 'Surveyed feature belongs to another site.')
  }

  const validateIds = (values, lookup, label) => {
    check(Array.isArray(values) && values.length <= 20, `Invalid resolved ${label} list.`)
    if (!Array.isArray(values)) return []
    check(new Set(values).size === values.length && values.every((value) => typeof value === 'string' && Boolean(lookup(value))), `Unknown or duplicate resolved ${label}.`)
    return values
  }
  const sponsorEventForMission = (eventId) => { const event = sponsorEventById(eventId); return event?.sponsorId === candidate.sponsorId && event.sol <= candidate.sol ? event : null }
  const resolvedEvents = validateIds(candidate.resolvedEventIds, sponsorEventForMission, 'sponsor event')
  const rival = sponsor ? rivalSettlementFor(sponsor.id) : null
  check(candidate.rivalSettlementId === (rival?.id ?? null), 'Rival settlement does not match the founding sponsor.')
  check(finite(candidate.rivalRelations, 0, 100) && finite(candidate.strategicPosition, 0, 100), 'Invalid Mars relations score.')
  const rivalForMission = (eventId) => rival?.encounter.id === eventId && rival.encounter.sol <= candidate.sol ? rival.encounter : null
  const resolvedRivals = validateIds(candidate.resolvedRivalEncounterIds, rivalForMission, 'rival encounter')
  const incidentForMission = (eventId) => {
    const incident = operationalIncidentById(eventId)
    return incident && (incident.phase === 'survival' ? candidate.sol >= 7 : candidate.sol >= 32 && candidate.phase === 'expansion') ? incident : null
  }
  const resolvedIncidents = validateIds(candidate.resolvedOperationalIncidentIds, incidentForMission, 'operational incident')
  const pending = [candidate.pendingEventId, candidate.pendingRivalEncounterId, candidate.pendingOperationalIncidentId]
  check(pending.every((value) => value === null || typeof value === 'string') && pending.filter(Boolean).length <= 1, 'Conflicting pending command decisions.')
  if (candidate.pendingEventId !== null) {
    const event = sponsorEventForMission(candidate.pendingEventId)
    check(Boolean(event) && event.phase === candidate.phase && event.sol === candidate.sol && !resolvedEvents.includes(event.id), 'Invalid pending sponsor decision.')
  }
  if (candidate.pendingRivalEncounterId !== null) {
    const event = rivalForMission(candidate.pendingRivalEncounterId)
    check(Boolean(event) && candidate.phase === 'expansion' && event.sol === candidate.sol && !resolvedRivals.includes(event.id), 'Invalid pending rival encounter.')
  }
  if (candidate.pendingOperationalIncidentId !== null) {
    const incident = incidentForMission(candidate.pendingOperationalIncidentId)
    check(Boolean(incident) && incident.phase === candidate.phase && (INCIDENT_SLOTS[candidate.phase] ?? []).includes(candidate.sol) && !resolvedIncidents.includes(incident.id), 'Invalid pending operational incident.')
  }
  check(!candidate.transferWindowPending || pending.every((value) => value === null), 'Review conflicts with another pending decision.')
  check(Array.isArray(candidate.log) && candidate.log.length <= 100, 'Invalid mission log.')
  if (Array.isArray(candidate.log)) candidate.log.forEach((entry) => check(record(entry) && integer(entry.sol, 1, candidate.sol) && ['info', 'success', 'warning', 'danger'].includes(entry.tone) && text(entry.message, 3000), 'Invalid mission log entry.'))
  check(Array.isArray(candidate.decisionLog) && candidate.decisionLog.length <= 1000, 'Invalid decision chronicle.')
  if (Array.isArray(candidate.decisionLog)) candidate.decisionLog.forEach((entry) => check(record(entry) && integer(entry.sol, 1, candidate.sol) && text(entry.category, 100) && text(entry.title, 300) && text(entry.choice, 1000), 'Invalid decision chronicle entry.'))
  if (errors.length) return { valid: false, state: null, errors }
  return { valid: true, errors: [], state: { ...candidate, speed: 0 } }
}
