const SPENDABLE = new Set(['water', 'oxygen', 'food', 'parts', 'cargo'])
const UNITS = { water: 'L water', oxygen: 'L oxygen', food: 'kg food', parts: 'parts', cargo: 't cargo' }
export function decisionEligibility(state, choice) {
  if (!choice) return { eligible: false, reason: 'Choose a valid response.' }
  const missing = Object.entries(choice.effects ?? {}).filter(([key, value]) => SPENDABLE.has(key) && value < 0 && (state.resources[key] ?? 0) + value < -0.00001)
  return missing.length ? { eligible: false, reason: 'Requires ' + missing.map(([key, value]) => `${-value} ${UNITS[key]}`).join(', ') + '.' } : { eligible: true, reason: 'All required resources are available.' }
}
export function decisionOptions(state, definition) {
  const choices = definition?.choices ?? []
  if (!choices.length || choices.some((choice) => decisionEligibility(state, choice).eligible)) return choices
  return [...choices, { id: 'emergency-standdown', title: 'Order an emergency stand-down', posture: 'Emergency response', description: 'Isolate the affected work and use no imported supplies. Accept colony strain and lost confidence instead.', effects: { confidence: -4, integrity: -4 }, crewEffects: { all: { fatigue: 6 } }, consequence: 'With no affordable response, command isolates the affected work. No supplies are created or spent; the improvised isolation costs integrity, confidence and crew fatigue.' }]
}
