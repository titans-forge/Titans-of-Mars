import { crewWelfare } from './crewMembers.js'
import { marsOrder, rivalSettlementFor } from './rivalSettlements.js'
import { surveyStatus } from './siteFeatures.js'
import { colonyProfile, colonyStats, colonyAssessment } from './simulation.js'

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)))

export function letterGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export function campaignReport(state, objectives) {
  const stats = colonyStats(state)
  const welfare = crewWelfare(state)
  const survey = surveyStatus(state)
  const assessment = colonyAssessment(state)
  const completion = objectives.length ? objectives.filter((objective) => objective.complete).length / objectives.length : 0
  const essentialPositive = ['water', 'oxygen', 'food'].every((key) => state.resources[key] > 0)
  const resilienceRaw = clampScore(state.resources.integrity * 0.45 + completion * 25 + (assessment.firstFailureSol === null ? 20 : assessment.firstFailureSol / assessment.horizon * 20) + (state.stormSurvived ? 5 : 0) + (state.debrisSurvived ? 5 : 0))
  const resilience = !essentialPositive ? Math.min(35, resilienceRaw) : !assessment.viable ? Math.min(69, resilienceRaw) : resilienceRaw
  const replacement = (out, use) => use <= 0 ? 1 : Math.max(0, Math.min(1, out / use))
  const independenceRaw = clampScore(25 * replacement(stats.waterOutput, stats.waterUse) + 25 * replacement(stats.oxygenOutput, stats.oxygenUse) + 20 * replacement(stats.foodOutput, stats.foodUse) + 15 * replacement(stats.partsOutput, stats.maintenance) + 15 * replacement(stats.basePowerCapacity, stats.powerDemand))
  const independence = !essentialPositive ? Math.min(35, independenceRaw) : !assessment.independent ? Math.min(89, independenceRaw) : independenceRaw
  const science = clampScore((survey.discovered.length / Math.max(1, survey.total)) * 70 + Math.min(30, (state.sciencePoints ?? 0) * 1.2))
  const sponsor = clampScore(state.resources.confidence)
  const rival = rivalSettlementFor(state.sponsorId)
  const rawDiplomacy = (state.rivalRelations ?? 50) * 0.55 + (state.strategicPosition ?? 50) * 0.45
  const bestAvailable = rival ? Math.max(...rival.encounter.choices.map((choice) => (rival.startingRelations + choice.relations) * 0.55 + (rival.startingPosition + choice.position) * 0.45)) : 100
  const encountered = rival && state.resolvedRivalEncounterIds?.includes(rival.encounter.id)
  const diplomacy = encountered ? clampScore(rawDiplomacy / bestAvailable * 100) : Math.min(60, clampScore(rawDiplomacy / bestAvailable * 100))
  const grades = [
    { id: 'resilience', label: 'Resilience', score: resilience, grade: letterGrade(resilience) },
    { id: 'independence', label: 'Independence', score: independence, grade: letterGrade(independence) },
    { id: 'science', label: 'Science', score: science, grade: letterGrade(science) },
    { id: 'crew', label: 'Crew welfare', score: welfare.score, grade: letterGrade(welfare.score) },
    { id: 'sponsor', label: 'Sponsor legitimacy', score: sponsor, grade: letterGrade(sponsor) },
    { id: 'diplomacy', label: 'Mars diplomacy', score: diplomacy, grade: letterGrade(diplomacy) },
  ]
  const overallRaw = clampScore(grades.reduce((sum, item) => sum + item.score, 0) / grades.length)
  const unsuccessful = ['fragile-city', 'dependent-outpost', 'failure'].includes(state.outcome)
  const overall = !essentialPositive ? Math.min(35, overallRaw) : !assessment.viable || unsuccessful ? Math.min(69, overallRaw) : overallRaw
  const overallExplanation = !essentialPositive ? 'Overall capped at 35: an essential reserve is empty.' : !assessment.viable || unsuccessful ? 'Overall capped at 69: operating viability or a required campaign objective is unmet.' : 'Average of six categories; operating viability passes.'
  const report = {
    grades,
    overall,
    overallGrade: letterGrade(overall),
    overallExplanation,
    profile: colonyProfile(state),
    order: marsOrder(state),
    welfare,
    survey,
    stats,
    assessment,
    explanations: {
      resilience: `Integrity, completed objectives and a ${assessment.horizon}-sol no-delivery operating forecast. ${assessment.viable ? 'Forecast and operating requirements pass.' : assessment.constraints.join(' ')}`,
      independence: assessment.independent ? 'Current local production replaces daily water, oxygen, food, parts and electrical needs.' : 'Reserve-supported: current local production does not replace every daily need. A requires nonnegative essential flows and generation without draining a battery.',
      science: `${survey.discovered.length}/${survey.total} prospects surveyed; ${state.sciencePoints ?? 0} research points. Survey completeness contributes 70%; research contributes 30%.`,
      sponsor: 'Sponsor confidence at the review. This is political support, not a measure of scientific accuracy.',
      diplomacy: encountered ? 'Relationship and position relative to the best reachable negotiated outcome for this sponsor; competitive leverage is also described separately in Mars order.' : 'No Mars encounter completed yet; diplomacy is capped at 60 until a policy is implemented.',
      crew: `Average health ${welfare.averageHealth}%, fatigue ${welfare.averageFatigue}%.`,
    },
  }
  report.grades = grades.map((item) => ({ ...item, explanation: report.explanations[item.id] }))
  return report
}

export function campaignShareText(state, report) {
  const gradeLine = report.grades.map((item) => `${item.label} ${item.grade}`).join(' | ')
  const result = state.outcome === 'permanent-city' && !report.assessment.viable ? 'saved permanent-city result; current operating review needs work' : ({ 'permanent-city': 'permanent city', 'fragile-city': 'fragile city', 'dependent-outpost': 'dependent outpost', failure: 'mission lost', 'first-city': 'first city' })[state.outcome] ?? 'campaign in progress'
  return `My ${state.settlementName} campaign in Titans of Mars: First City: ${result}. ${report.profile}; ${report.order.title}. Overall ${report.overallGrade} (${report.overall}/100). ${gradeLine}.`
}

export async function downloadCampaignCard(state, report) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 675
  const context = canvas.getContext('2d')
  context.fillStyle = '#0b1011'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#141b1d'
  context.fillRect(56, 54, 1088, 567)
  context.strokeStyle = '#caa43a'
  context.lineWidth = 2
  context.strokeRect(56, 54, 1088, 567)
  context.fillStyle = '#caa43a'
  context.font = '700 22px Arial'
  context.fillText('TITANS OF MARS: FIRST CITY', 96, 105)
  context.fillStyle = '#f1eee4'
  context.font = '52px Georgia'
  context.fillText(state.settlementName, 96, 178)
  context.fillStyle = '#7fc4c4'
  context.font = '20px Arial'
  context.fillText(`${report.profile}  /  ${report.order.title}`, 96, 218)
  context.fillStyle = '#caa43a'
  context.font = '700 120px Georgia'
  context.fillText(report.overallGrade, 952, 196)
  context.fillStyle = '#9b9992'
  context.font = '15px Arial'
  context.fillText(`OVERALL ${report.overall}/100`, 932, 225)
  report.grades.forEach((item, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = 96 + (col * 330)
    const y = 315 + (row * 130)
    context.fillStyle = '#0e1415'
    context.fillRect(x, y - 46, 292, 96)
    context.strokeStyle = '#343d3f'
    context.strokeRect(x, y - 46, 292, 96)
    context.fillStyle = '#9b9992'
    context.font = '14px Arial'
    context.fillText(item.label.toUpperCase(), x + 18, y - 17)
    context.fillStyle = '#f1eee4'
    context.font = '700 42px Georgia'
    context.fillText(item.grade, x + 18, y + 31)
    context.fillStyle = '#caa43a'
    context.font = '16px Arial'
    context.fillText(`${item.score}/100`, x + 72, y + 27)
  })
  context.fillStyle = '#777d7d'
  context.font = '14px Arial'
  context.fillText(`Sol ${state.sol} | ${state.sponsor} | ${state.outcome === 'permanent-city' && !report.assessment.viable ? 'Saved result: current forecast fails' : state.outcome ?? 'In progress'}`, 96, 582)
  const link = document.createElement('a')
  link.download = `titans-of-mars-${state.settlementName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.png`
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The browser could not encode the result card.')
  const url = URL.createObjectURL(blob)
  link.href = url
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
