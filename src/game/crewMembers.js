const ROSTERS = {
  'american-compact': [
    ['elena-torres', 'Elena Torres', 'Mission Commander', 'operations', 'command'],
    ['malik-reed', 'Malik Reed', 'Grid Engineer', 'engineering', 'systems'],
    ['dana-cho', 'Dana Cho', 'Surface Operations', 'operations', 'surface'],
    ['priya-shah', 'Priya Shah', 'Flight Surgeon', 'support', 'medical'],
    ['owen-mercer', 'Owen Mercer', 'Planetary Scientist', 'support', 'science'],
    ['tessa-brooks', 'Tessa Brooks', 'Cargo and Supply', 'operations', 'logistics'],
    ['jonah-price', 'Jonah Price', 'Mechanical Engineer', 'engineering', 'systems'],
    ['maya-santos', 'Maya Santos', 'Agronomy Lead', 'support', 'medical'],
    ['caleb-wright', 'Caleb Wright', 'Rover Pilot', 'operations', 'surface'],
    ['nora-kim', 'Nora Kim', 'Civic Systems', 'residents', 'command'],
  ],
  'china-directorate': [
    ['liu-wen', 'Liu Wen', 'Mission Commander', 'operations', 'command'],
    ['chen-rui', 'Chen Rui', 'Grid Engineer', 'engineering', 'systems'],
    ['zhao-min', 'Zhao Min', 'Surface Operations', 'operations', 'surface'],
    ['lin-yue', 'Lin Yue', 'Flight Surgeon', 'support', 'medical'],
    ['wang-hao', 'Wang Hao', 'Planetary Scientist', 'support', 'science'],
    ['sun-jie', 'Sun Jie', 'Cargo and Supply', 'operations', 'logistics'],
    ['gao-jun', 'Gao Jun', 'Mechanical Engineer', 'engineering', 'systems'],
    ['xu-lan', 'Xu Lan', 'Agronomy Lead', 'support', 'medical'],
    ['he-tao', 'He Tao', 'Rover Pilot', 'operations', 'surface'],
    ['ma-qian', 'Ma Qian', 'Civic Systems', 'residents', 'command'],
  ],
  'europe-cooperative': [
    ['amelie-laurent', 'Amelie Laurent', 'Mission Commander', 'operations', 'command'],
    ['lukas-weber', 'Lukas Weber', 'Grid Engineer', 'engineering', 'systems'],
    ['sofia-rossi', 'Sofia Rossi', 'Surface Operations', 'operations', 'surface'],
    ['ingrid-nilsen', 'Ingrid Nilsen', 'Flight Surgeon', 'support', 'medical'],
    ['marek-nowak', 'Marek Nowak', 'Planetary Scientist', 'support', 'science'],
    ['eva-de-vries', 'Eva de Vries', 'Cargo and Supply', 'operations', 'logistics'],
    ['jonas-fischer', 'Jonas Fischer', 'Mechanical Engineer', 'engineering', 'systems'],
    ['clara-mendez', 'Clara Mendez', 'Agronomy Lead', 'support', 'medical'],
    ['ivo-petrovic', 'Ivo Petrovic', 'Rover Pilot', 'operations', 'surface'],
    ['lea-dubois', 'Lea Dubois', 'Civic Systems', 'residents', 'command'],
  ],
  'russia-directorate': [
    ['anna-morozova', 'Anna Morozova', 'Mission Commander', 'operations', 'command'],
    ['mikhail-sokolov', 'Mikhail Sokolov', 'Grid Engineer', 'engineering', 'systems'],
    ['irina-volkova', 'Irina Volkova', 'Surface Operations', 'operations', 'surface'],
    ['lev-petrov', 'Lev Petrov', 'Flight Surgeon', 'support', 'medical'],
    ['yuri-antonov', 'Yuri Antonov', 'Planetary Scientist', 'support', 'science'],
    ['natalia-orlova', 'Natalia Orlova', 'Cargo and Supply', 'operations', 'logistics'],
    ['pavel-kozlov', 'Pavel Kozlov', 'Mechanical Engineer', 'engineering', 'systems'],
    ['vera-smirnova', 'Vera Smirnova', 'Agronomy Lead', 'support', 'medical'],
    ['alexei-baranov', 'Alexei Baranov', 'Rover Pilot', 'operations', 'surface'],
    ['olga-lebedeva', 'Olga Lebedeva', 'Civic Systems', 'residents', 'command'],
  ],
}

export const TRAIT_LABELS = {
  command: 'Command: reduces confidence loss when the settlement is strained.',
  systems: 'Systems: adds engineering coverage while serving as mission lead.',
  surface: 'Surface: adds operations coverage while serving as mission lead.',
  medical: 'Medical: improves fatigue recovery, care for stable injured crew and support coverage.',
  science: 'Science: accelerates an active ground survey.',
  logistics: 'Logistics: slightly reduces construction mass and parts costs.',
}

// Names describe specialties; the assigned shift must match the actual labor budget.
function assignBillets(members, cohorts) {
  if (!cohorts) return members
  const remaining = { ...cohorts }
  const assigned = members.map((member) => {
    if ((remaining[member.cohort] ?? 0) <= 0) return { ...member, cohort: null }
    remaining[member.cohort] -= 1
    return member
  })
  return assigned.map((member) => {
    if (member.cohort) return member
    const cohort = Object.keys(remaining).find((key) => remaining[key] > 0) ?? 'residents'
    remaining[cohort] -= 1
    return { ...member, cohort }
  })
}

export function createCrewMembers(sponsorId, count = 6, cohorts = null) {
  const source = ROSTERS[sponsorId] ?? ROSTERS['american-compact']
  return assignBillets(source.slice(0, count).map(([id, name, role, cohort, trait]) => ({ id, name, role, cohort, trait, health: 100, fatigue: 8 })), cohorts)
}

export function ensureCrewMembers(state) {
  const roster = createCrewMembers(state.sponsorId, state.crew)
  const byId = new Map((state.crewMembers ?? []).map((member) => [member.id, member]))
  return assignBillets(roster.map((member) => ({ ...member, ...(byId.get(member.id) ?? {}) })), state.crewCohorts)
}

export function crewLead(state) {
  const members = ensureCrewMembers(state)
  return members.find((member) => member.id === state.crewLeadId && member.health > 0) ?? members.find((member) => member.health > 0) ?? null
}

export function memberReadiness(member) {
  const fatiguePenalty = Math.max(0, (member?.fatigue ?? 0) - 35) / 100
  return Math.max(0, Math.min(1, ((member?.health ?? 100) / 100) * (1 - fatiguePenalty)))
}

export function crewReadinessByCohort(state) {
  const buckets = { engineering: [], operations: [], support: [], residents: [] }
  ensureCrewMembers(state).forEach((member) => buckets[member.cohort]?.push(memberReadiness(member)))
  return Object.fromEntries(Object.entries(buckets).map(([cohort, values]) => [cohort, values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 1]))
}

export function applyCrewEffects(members, effects = {}) {
  return members.map((member) => {
    const effect = effects[member.id] ?? effects[member.cohort] ?? effects.all
    if (!effect) return member
    return {
      ...member,
      health: Math.max(0, Math.min(100, member.health + (effect.health ?? 0))),
      fatigue: Math.max(0, Math.min(100, member.fatigue + (effect.fatigue ?? 0))),
    }
  })
}

export function advanceCrewStatus(state, stats, depleted) {
  const support = stats.labor.ratios.support
  const lead = crewLead(state)
  const recovery = lead?.trait === 'medical' ? 2.2 : 1.2
  const pressure = (depleted ? 8 : 0) + (stats.powerRatio < 1 ? 4 : 0) + (stats.storm || stats.debris ? 2 : 0) + Math.max(0, 1 - support) * 5
  return ensureCrewMembers(state).map((member, index) => {
    const duty = member.cohort === 'residents' ? 0.4 : 1.2
    const fatigue = Math.max(0, Math.min(100, member.fatigue + pressure + duty - recovery))
    const healthLoss = depleted ? 3 : fatigue >= 78 ? 1.5 : fatigue >= 62 ? 0.5 : 0
    const healing = !depleted && stats.powerRatio >= 0.99 && support >= 1 && fatigue < 35 && member.health > 0 ? (lead?.trait === 'medical' ? 0.8 : 0.4) : 0
    return { ...member, health: Math.max(0, Math.min(100, member.health - healthLoss + healing)), fatigue, active: index < state.crew }
  })
}

export function crewWelfare(state) {
  const members = ensureCrewMembers(state)
  if (!members.length) return { score: 0, averageHealth: 0, averageFatigue: 100, critical: [] }
  const averageHealth = members.reduce((sum, member) => sum + member.health, 0) / members.length
  const averageFatigue = members.reduce((sum, member) => sum + member.fatigue, 0) / members.length
  return {
    score: Math.round(Math.max(0, Math.min(100, averageHealth - (averageFatigue * 0.45)))),
    averageHealth: Math.round(averageHealth),
    averageFatigue: Math.round(averageFatigue),
    critical: members.filter((member) => member.health < 65 || member.fatigue > 75),
  }
}
