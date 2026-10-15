export const SPONSOR_EVENTS = {
  'us-congressional-audit': {
    id: 'us-congressional-audit',
    sponsorId: 'american-compact',
    sol: 12,
    phase: 'survival',
    authority: 'Congressional Mars Review Staff',
    title: 'The Telemetry Audit',
    brief: 'A contractor concealed repeated pump faults from public mission reports. Congress wants the raw telemetry before the dust front arrives.',
    stakes: 'Transparency can stabilize the coalition, but the inspection will consume engineering time and replacement hardware.',
    choices: [
      { id: 'publish', title: 'Publish the telemetry', description: 'Accept an independent engineering review and replace the suspect pump assembly.', effects: { parts: -20, confidence: 5 }, consequence: 'The full telemetry is released. Engineers lose scarce spares to the inspection, but sponsor confidence rises.' },
      { id: 'schedule', title: 'Protect the launch schedule', description: 'Keep the fault review inside the contractor team and preserve the hardware reserve.', effects: { parts: 20, confidence: -4 }, consequence: 'The contractor schedule holds and spare hardware is preserved, but political confidence falls when the closed review becomes public.' },
    ],
  },
  'us-insurance-control': {
    id: 'us-insurance-control',
    sponsorId: 'american-compact',
    sol: 30,
    phase: 'expansion',
    authority: 'Launch Insurance Consortium',
    title: 'The Shutdown Clause',
    brief: 'Earth insurers will cover the next cargo train only if they receive authority to halt high-risk surface construction remotely.',
    stakes: 'Insurance restores spares now, but new construction uses 25% more imported cargo and stops during active dust or debris alerts. Self-insurance spends reserves now to keep local authority and reduce daily maintenance by 15%.',
    choices: [
      { id: 'accept', title: 'Accept the clause', description: 'Secure coverage and replenish the common spares account. Insurer certification raises future construction cargo by 25%; new orders and queued construction pause during active dust and debris alerts. Commissioned operations and repairs continue.', effects: { parts: 30, confidence: 4 }, policy: { description: 'Future construction uses 25% more imported cargo after discounts. New orders and queued construction pause during active dust or debris alerts; commissioned operations and repairs remain available.', effects: { constructionCargoMultiplier: 1.25, restrictedConstructionDuringHazards: true } }, consequence: 'The settlement accepts insurance coverage and the restored spares account. Certified construction now costs 25% more cargo, and insurers suspend new orders and queued work during dust and debris alerts.' },
      { id: 'self-insure', title: 'Self-insure the city', description: 'Spend settlement reserves to retain local authority and inspection planning. Daily maintenance uses 15% fewer parts, construction keeps its normal cargo cost, and no insurer hazard veto applies.', effects: { parts: -25, confidence: -2 }, policy: { description: 'Daily maintenance uses 15% fewer parts. Construction retains normal cargo costs and remains under local control during hazards.', effects: { maintenanceMultiplier: 0.85, constructionCargoMultiplier: 1, restrictedConstructionDuringHazards: false } }, consequence: 'Mars pays its own risk reserve and retains construction authority. Local inspection planning reduces daily maintenance parts by 15%; construction keeps normal cargo costs even during alerts.' },
    ],
  },
  'cn-production-quota': {
    id: 'cn-production-quota',
    sponsorId: 'china-directorate',
    sol: 12,
    phase: 'survival',
    authority: 'State Council Mars Commission',
    title: 'The First Output Quota',
    brief: 'Earth planners expect the first extraction quota before the storm, but surface crews report that the target assumes uninterrupted machinery.',
    stakes: 'Meeting the published target protects confidence while consuming the hardware reserve needed for the dust front.',
    choices: [
      { id: 'revise', title: 'Revise the quota openly', description: 'Preserve machinery and report a lower, technically defensible target.', effects: { parts: 20, confidence: -2 }, consequence: 'The commission accepts a revised quota. Tianwen preserves hardware, but the public plan loses some authority.' },
      { id: 'meet', title: 'Meet the published target', description: 'Use reserve components to maintain the original production schedule.', effects: { parts: -30, confidence: 4 }, consequence: 'The published quota is met through an intensive maintenance push. Confidence rises while the spare-parts reserve falls.' },
    ],
  },
  'cn-command-boundary': {
    id: 'cn-command-boundary',
    sponsorId: 'china-directorate',
    sol: 30,
    phase: 'expansion',
    authority: 'National Mars Settlement Office',
    title: 'Two Chains of Command',
    brief: 'The industrial bureau and settlement office have issued conflicting rover priorities during expansion.',
    stakes: 'A single command restores clarity; local discretion may produce better operations but weakens the formal plan.',
    choices: [
      { id: 'unify', title: 'Unify command under the settlement office', description: 'Cancel duplicate work orders and centralize all surface scheduling.', effects: { parts: 20, confidence: 3 }, consequence: 'Surface command is unified under the settlement office. Duplicate work ends and the state plan regains authority.' },
      { id: 'delegate', title: 'Delegate to the surface commander', description: 'Let the Mars crew arbitrate bureau priorities from operational conditions.', effects: { parts: 35, confidence: -3 }, consequence: 'The surface commander receives broad discretion. Operations recover additional hardware, but Earth sees a weakening chain of command.' },
    ],
  },
  'eu-interface-dispute': {
    id: 'eu-interface-dispute',
    sponsorId: 'europe-cooperative',
    sol: 12,
    phase: 'survival',
    authority: 'European Mars Council',
    title: 'The Interface Dispute',
    brief: 'Two national contractors delivered incompatible coolant couplings for the same modular standard.',
    stakes: 'Reworking the hardware protects the common system; accepting national variants saves parts now and creates future complexity.',
    choices: [
      { id: 'standardize', title: 'Enforce the common interface', description: 'Rework both assemblies and preserve one settlement-wide standard.', effects: { parts: -20, confidence: 5 }, consequence: 'Both assemblies are reworked to the common interface. The decision costs parts and restores coalition confidence.' },
      { id: 'variants', title: 'Accept national variants', description: 'Use adapters and preserve the immediate hardware reserve.', effects: { parts: 25, confidence: -3 }, consequence: 'National variants remain in service. Kepler preserves parts now while adding a maintenance burden and political friction.' },
    ],
  },
  'eu-budget-veto': {
    id: 'eu-budget-veto',
    sponsorId: 'europe-cooperative',
    sol: 30,
    phase: 'expansion',
    authority: 'Coalition Budget Council',
    title: 'The Expansion Veto',
    brief: 'A partner government threatens to veto expansion unless more maintenance contracts are distributed across the coalition.',
    stakes: 'Sharing contracts protects the coalition but raises near-term cost; consolidation is cheaper and politically brittle.',
    choices: [
      { id: 'share', title: 'Distribute the contracts', description: 'Accept duplicate administration to keep every partner invested.', effects: { parts: -20, confidence: 5 }, consequence: 'Maintenance contracts are spread across the coalition. Parts are lost to duplication, but the expansion vote holds.' },
      { id: 'consolidate', title: 'Consolidate technical authority', description: 'Keep procurement with the most capable engineering lead.', effects: { parts: 30, confidence: -4 }, consequence: 'Technical authority is consolidated and useful hardware is recovered. The offended partners cut political support.' },
    ],
  },
  'ru-damaged-cargo': {
    id: 'ru-damaged-cargo',
    sponsorId: 'russia-directorate',
    sol: 12,
    phase: 'survival',
    authority: 'Expedition Transport Bureau',
    title: 'The Damaged Cargo Module',
    brief: 'A landed cargo module has a failed thermal controller. Its payload can be recovered only by cannibalizing rover and utility spares.',
    stakes: 'Recovering the cargo expands the narrow landed reserve but reduces repair margin before the storm.',
    choices: [
      { id: 'recover', title: 'Cannibalize spares and recover it', description: 'Trade replacement parts for the stranded cargo and a visible operational success.', effects: { parts: -25, cargo: 1.5, confidence: 3 }, consequence: 'The module is recovered using rover and utility spares. Cargo and confidence rise while the parts reserve narrows.' },
      { id: 'abandon', title: 'Abandon the module', description: 'Protect repair stocks and write off the damaged payload.', effects: { confidence: -3 }, consequence: 'The damaged module is abandoned. Zvezda preserves its repair stock but absorbs a public failure.' },
    ],
  },
  'ru-resupply-delay': {
    id: 'ru-resupply-delay',
    sponsorId: 'russia-directorate',
    sol: 30,
    phase: 'expansion',
    authority: 'Interagency Mars Commission',
    title: 'The Delayed Resupply Window',
    brief: 'An Earth launch-stage fault has pushed the next Russian cargo window back by months.',
    stakes: 'Immediate rationing protects the hardware reserve; maintaining the published schedule preserves confidence and consumes stores.',
    choices: [
      { id: 'ration', title: 'Begin immediate rationing', description: 'Slow optional work and transfer hardware into the emergency reserve.', effects: { parts: 30, confidence: -2 }, consequence: 'Optional work is curtailed and parts move into reserve. The settlement gains margin while public confidence slips.' },
      { id: 'schedule', title: 'Maintain the published schedule', description: 'Preserve momentum by consuming food and replacement stock.', effects: { food: -80, parts: -20, confidence: 4 }, consequence: 'Zvezda holds the published schedule through reserve consumption. Confidence rises as food and parts fall.' },
    ],
  },
}

export function sponsorEventById(id) {
  return SPONSOR_EVENTS[id] ?? null
}

export function sponsorEventsFor(sponsorId) {
  return Object.values(SPONSOR_EVENTS).filter((event) => event.sponsorId === sponsorId)
}

export function sponsorEventAt(sponsorId, sol, phase, resolvedEventIds = []) {
  const resolved = new Set(resolvedEventIds)
  return sponsorEventsFor(sponsorId).find((event) => event.sol === sol && event.phase === phase && !resolved.has(event.id)) ?? null
}
