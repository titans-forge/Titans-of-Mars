import { isOperational } from './buildingStatus.js'
const incident = (id, phase, title, system, brief, stakes, condition, choices) => ({ id, phase, title, system, brief, stakes, condition, choices })

export const OPERATIONAL_INCIDENTS = [
  incident('dust-lock-contamination', 'survival', 'Dust in the Pressure Lock', 'Habitat operations',
    'Fine electrostatic dust has crossed the outer lock seals and reached suit bearings and electrical contacts.',
    'A full cleaning consumes spares and duty hours. Deferring it preserves the schedule while spreading wear through surface equipment.',
    () => true,
    [
      { id: 'clean', title: 'Strip and clean the lock', description: 'Spend parts and stop surface work long enough to protect the pressure boundary.', effects: { parts: -12, confidence: 1 }, crewEffects: { operations: { fatigue: 4 } }, consequence: 'The operations team strips the lock, cleans every bearing, and restores a reliable pressure boundary.' },
      { id: 'defer', title: 'Hold the work schedule', description: 'Keep the lock in service and accept accelerated wear across exposed equipment.', effects: { confidence: -2 }, damageType: 'solar', damage: 8, consequence: 'Surface work continues, but contaminated seals and contacts increase wear across the exposed power system.' },
    ]),
  incident('ice-purity-alert', 'survival', 'The Ice Is Not Uniform', 'Resource survey',
    'Ground radar and drill cuttings disagree about the purity of the confirmed ice lens feeding the settlement plan.',
    'Recalibration improves the science model but consumes reserve water. Driving the pumps harder may recover useful throughput at a maintenance cost.',
    (state) => (state.surveyedFeatureIds?.length ?? 0) > 0,
    [
      { id: 'recalibrate', title: 'Recalibrate the resource model', description: 'Pause extraction tests, consume reserve water, and improve the site model.', effects: { water: -80 }, science: 6, consequence: 'The drill team reconciles radar and core samples. The revised ice model is slower to produce and far more trustworthy.' },
      { id: 'push', title: 'Push the field pumps', description: 'Treat variable purity as an engineering problem and recover more usable equipment.', effects: { parts: 14 }, crewEffects: { operations: { fatigue: 7 } }, consequence: 'The surface team drives the pumps through mixed material and recovers reusable fittings, at the cost of a punishing shift.' },
    ]),
  incident('solar-particle-watch', 'survival', 'Solar Particle Watch', 'Crew safety',
    'Orbital monitors report an energetic particle event. The crew can shelter now or use the warning interval for one final exterior recovery run.',
    'Sheltering protects the crew and loses tempo. A last sortie may recover hardware but exposes the surface team.',
    (state) => state.buildings.some((building) => building.type === 'habitat' && isOperational(building)),
    [
      { id: 'shelter', title: 'Move the crew into shelter', description: 'Suspend exterior work and protect the mission team.', effects: { confidence: -1 }, crewEffects: { all: { fatigue: -7 } }, consequence: 'The settlement enters radiation shelter before the particle front arrives. Exterior work pauses and the crew recovers.' },
      { id: 'sortie', title: 'Authorize one final sortie', description: 'Recover exposed cargo before sealing the habitat.', effects: { parts: 22, confidence: 2 }, crewEffects: { operations: { health: -4, fatigue: 8 } }, consequence: 'The surface team recovers valuable hardware and reaches shelter before peak flux, carrying measurable exposure and fatigue.' },
    ]),
  incident('crew-sleep-deficit', 'survival', 'The Crew Is Running a Sleep Debt', 'Crew welfare',
    'Compressed shifts and constant alarms have left the mission team making slower checks and repeating simple mistakes.',
    'A protected stand-down costs immediate output. Maintaining tempo protects the schedule while increasing fatigue and operational risk.',
    () => true,
    [
      { id: 'stand-down', title: 'Order a protected stand-down', description: 'Use reserve parts to cover delayed work and restore the duty cycle.', effects: { parts: -6, confidence: 1 }, crewEffects: { all: { fatigue: -12 } }, consequence: 'Command cancels nonessential work. Sleep discipline returns before fatigue becomes a mission-wide hazard.' },
      { id: 'tempo', title: 'Maintain mission tempo', description: 'Keep every work package moving through the review window.', effects: { confidence: 2, integrity: -2 }, crewEffects: { all: { fatigue: 10 } }, consequence: 'The schedule holds, but the entire crew carries the cost in fatigue and avoidable mistakes.' },
    ]),
  incident('greenhouse-blight', 'expansion', 'Blight in the First Greenhouse', 'Food system',
    'A fungal bloom has appeared in one sealed crop bay. It can be isolated for study or suppressed with imported nutrients and sterilants.',
    'Isolation protects the long-term crop model at an immediate food cost. Suppression preserves output while consuming scarce cargo.',
    (state) => state.buildings.some((building) => building.type === 'greenhouse' && isOperational(building)),
    [
      { id: 'isolate', title: 'Isolate and study the bay', description: 'Sacrifice the crop and learn how the closed environment failed.', effects: { food: -35 }, science: 8, crewEffects: { support: { fatigue: 5 } }, consequence: 'The bay is sealed and sampled. The crop is lost, but the settlement gains a defensible disease-control protocol.' },
      { id: 'suppress', title: 'Suppress it with imported stores', description: 'Preserve near-term food output with Earth-supplied nutrients and sterilants.', effects: { food: 55, cargo: -0.5 }, consequence: 'The crop survives after an aggressive treatment, leaving the greenhouse productive and more dependent on imported stores.' },
    ]),
  incident('battery-thermal-run', 'expansion', 'Battery Thermal Excursion', 'Power storage',
    'One storage rack is heating beyond its modeled envelope during a high-load discharge cycle.',
    'Taking the bank offline protects the grid at a parts and reserve-power cost. Bypassing protection preserves output while risking permanent damage.',
    (state) => state.buildings.some((building) => building.type === 'battery' && isOperational(building)),
    [
      { id: 'offline', title: 'Take the bank offline', description: 'Discharge the rack, replace the suspect contactor, and accept losing 2 MWh of stored energy.', effects: { parts: -10 }, batteryCharge: -2000, crewEffects: { engineering: { fatigue: 5 } }, consequence: 'Engineers isolate the rack and replace the contactor. The grid loses stored energy but avoids a cascading fault.' },
      { id: 'bypass', title: 'Bypass the thermal limit', description: 'Preserve the schedule, damage the bank and expose engineers to a hot-rack emergency. Repairing hardware cannot undo crew injury or lost stored energy.', effects: { confidence: 2 }, damageType: 'battery', damage: 18, crewEffects: { engineering: { health: -3, fatigue: 10 } }, consequence: 'The bank holds the load but loses usable energy capacity. Engineers suffer heat injury and fatigue that need recovery time even after hardware repairs.' },
    ]),
  incident('recycler-biofilm', 'expansion', 'Biofilm in the Water Loop', 'Water recycling',
    'Sensors detect a fast-growing biofilm across the reclamation plant membrane train.',
    'Steam sterilization consumes water and parts. A chemical purge preserves more equipment while spending imported reagents.',
    (state) => state.buildings.some((building) => building.type === 'recycling' && isOperational(building)),
    [
      { id: 'sterilize', title: 'Steam-sterilize the loop', description: 'Use water and replacement membranes to reset the system completely.', effects: { water: -110, parts: -8 }, science: 4, consequence: 'The reclamation loop is sterilized and rebuilt around a better sampling schedule.' },
      { id: 'purge', title: 'Use the imported chemical reserve', description: 'Preserve throughput by consuming a portion of landed reagent cargo.', effects: { cargo: -0.4, confidence: 1 }, consequence: 'The chemical purge clears the membrane train without stopping the city water loop.' },
    ]),
  incident('pressure-microfracture', 'expansion', 'A Microfracture in the Utility Spine', 'Settlement integrity',
    'Acoustic monitors have located a slow pressure leak inside the buried utility spine connecting the growing settlement.',
    'A permanent repair consumes parts now. Isolating the segment preserves stock and forces the crew into a narrower operating margin.',
    () => true,
    [
      { id: 'repair', title: 'Excavate and patch the spine', description: 'Commit parts and engineering time to a permanent pressure repair.', effects: { parts: -20, integrity: 2 }, crewEffects: { engineering: { fatigue: 6 } }, consequence: 'The utility spine is excavated and patched before the fracture propagates.' },
      { id: 'isolate', title: 'Isolate the damaged segment', description: 'Preserve parts while accepting a confidence and crew-fatigue cost.', effects: { confidence: -3 }, crewEffects: { all: { fatigue: 6 } }, consequence: 'The damaged segment is isolated. The city remains pressurized through a more brittle temporary network.' },
    ]),
]

export const INCIDENT_SLOTS = { survival: [7, 15], expansion: [32, 38] }

export function operationalIncidentById(id) {
  return OPERATIONAL_INCIDENTS.find((item) => item.id === id) ?? null
}

function stableIndex(value, length) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return Math.abs(hash) % length
}

export function operationalIncidentAt(state, sol) {
  if (!(INCIDENT_SLOTS[state.phase] ?? []).includes(sol)) return null
  const resolved = new Set(state.resolvedOperationalIncidentIds ?? [])
  const candidates = OPERATIONAL_INCIDENTS.filter((item) => item.phase === state.phase && !resolved.has(item.id) && item.condition(state))
  if (!candidates.length) return null
  return candidates[stableIndex(`${state.sponsorId}:${state.manifestId}:${sol}`, candidates.length)]
}
