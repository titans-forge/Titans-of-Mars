import { sponsorById } from './sponsors.js'
import { rivalSettlementFor } from './rivalSettlements.js'
import { createCrewMembers } from './crewMembers.js'

export function createInitialState(sponsorId = null) {
  const sponsor = sponsorById(sponsorId)
  const preview = sponsor ?? sponsorById('american-compact')
  const rival = sponsor ? rivalSettlementFor(sponsor.id) : null
  const crewMembers = createCrewMembers(preview.id, 6, preview.crewCohorts)
  return {
    version: 9,
    mechanicsVersion: 2,
    assignmentCommitment: null,
    policyEffects: {},
    sponsorId: sponsor?.id ?? null,
    sponsor: sponsor?.name ?? 'Sponsor awaiting selection',
    earthYear: sponsor?.earthYear ?? 2033,
    settlementName: sponsor?.settlementName ?? 'First City Survey Site',
    siteName: sponsor?.siteName ?? 'MARS LANDING ZONE',
    transferAuthority: sponsor?.transferAuthority ?? 'Transfer authority pending',
    manifestId: null,
    manifestDoctrine: null,
    buildDiscounts: {},
    phase: 'survival',
    phaseOneCompleted: false,
    transferWindowPending: false,
    secondManifestId: null,
    secondManifestDoctrine: null,
    pendingEventId: null,
    resolvedEventIds: [],
    rivalSettlementId: rival?.id ?? null,
    rivalRelations: rival?.startingRelations ?? 50,
    strategicPosition: rival?.startingPosition ?? 50,
    pendingRivalEncounterId: null,
    resolvedRivalEncounterIds: [],
    debrisSurvived: false,
    sol: 1,
    speed: 0,
    resources: { ...preview.resources },
    crew: 6,
    crewMembers,
    crewLeadId: crewMembers[0]?.id ?? null,
    crewCohorts: { ...preview.crewCohorts },
    crossTraining: preview.crossTraining,
    roverFleet: preview.roverFleet,
    roverAssignments: { ...preview.roverAssignments },
    siteSurveyProgress: 0,
    surveyedFeatureIds: [],
    sciencePoints: 0,
    batteryCharge: 0,
    pendingOperationalIncidentId: null,
    resolvedOperationalIncidentIds: [],
    decisionLog: [],
    buildings: [
      { uid: 'cargo-1', type: 'cargo', col: 1, row: 2, integrity: 100 },
      { uid: 'solar-1', type: 'solar', col: 3, row: 1, integrity: 100 },
      { uid: 'storage-1', type: 'storage', col: 3, row: 4, integrity: 100 },
    ],
    selectedUid: 'cargo-1',
    buildMode: null,
    stormSurvived: false,
    outcome: null,
    log: [
      { sol: 1, tone: 'info', message: sponsor?.intro ?? 'Mission command awaits a founding sponsor.' },
      { sol: 1, tone: 'warning', message: 'Orbital weather models place a major dust front at Sol 18.' },
    ],
  }
}
