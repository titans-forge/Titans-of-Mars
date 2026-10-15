import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { colonyAssessment, colonyStats, missionObjectives, restoreState } from '../src/game/simulation.js'
import { operateSol } from '../src/game/operations.js'
import { evaluateNativePermutations, finiteJSON, runNativeCampaign } from './helpers/nativeCampaign.js'

const results = evaluateNativePermutations()
const solar = runNativeCampaign('europe-cooperative', 'eu-solar-microgrid', 'eu-consensus-reserve', { solar: true })
const output = process.env.MARS_QA_OUTPUT ? path.resolve(process.env.MARS_QA_OUTPUT) : null

for (const route of results) test(`native campaign: ${route.openingId} → ${route.followOnId}`, () => {
  assert.equal(route.initial.sol, 1)
  assert.deepEqual(route.initial.surveyed, [], 'must begin with no confirmed ice')
  assert.equal(route.initial.buildings.length, 3, 'only the actual landed infrastructure exists initially')
  assert.equal(route.failures.length, 0, route.failures.join('; '))
  assert.equal(route.state.sol, 42)
  assert.equal(route.state.outcome, 'permanent-city', JSON.stringify(route.summary))
  assert.equal(route.state.secondManifestId, route.followOnId)
  assert.equal(route.followOnStatus.eligible, true, 'second payload must meet the actual confidence threshold')
  assert.equal(route.assessment.viable, true)
  assert.ok(route.assessment.checks.every((check) => check.complete))
  assert.ok(missionObjectives(route.state).every((objective) => objective.complete))
  assert.equal(route.ticks.length, 41)
  assert.ok(route.ticks.some((tick) => tick.constructionBefore.length > 0), 'paid queues must consume actual elapsed work ticks')
  assert.equal(route.ticks.reduce((count, tick) => count + tick.commissioned.length, 0), route.actions.filter((action) => action.action === 'construct').length, 'every placed site must commission through actual work')
  assert.equal(route.state.buildings.some((building) => building.construction), false)
  assert.ok(route.ticks.every((tick) => tick.predictedResourcesMatch), 'actual reserve changes must match the displayed current production ledger')
  assert.equal(route.ticks.filter((tick) => tick.storm).length, 4)
  assert.ok(route.ticks.filter((tick) => tick.storm).every((tick) => tick.powerRatio >= 0.99))
  const finalIce = route.state.buildings.find((building) => building.type === 'ice')
  const lastSurveyTick = route.ticks.find((tick) => tick.toSol === route.actions.find((action) => action.action === 'construct' && action.type === 'ice').sol)
  assert.ok(finalIce)
  assert.ok(lastSurveyTick, 'ice is commissioned after actual elapsed survey ticks')
  assert.ok(route.actions.some((action) => action.action === 'assign rover' && action.route === 'survey'))
  assert.ok(restoreState(JSON.stringify(route.state)), 'completed native campaign must remain a valid exportable save')
})

test('solar microgrid and a real 6 MWh battery survive every dust tick and complete an independent city', () => {
  assert.equal(solar.failures.length, 0)
  assert.equal(solar.state.buildings.some((building) => building.type === 'nuclear'), false)
  assert.equal(solar.state.buildings.filter((building) => building.type === 'solar').length, 4)
  assert.equal(solar.state.buildings.filter((building) => building.type === 'battery').length, 1)
  const dustyTicks = solar.ticks.filter((tick) => tick.storm)
  assert.deepEqual(dustyTicks.map((tick) => tick.fromSol), [18, 19, 20, 21])
  assert.ok(dustyTicks.every((tick) => tick.batteryBefore > tick.batteryAfter && tick.batteryDispatchKWh > 0), 'the battery must actually carry an energy deficit, not merely exist')
  assert.ok(dustyTicks.every((tick) => tick.powerRatio >= 0.99))
  assert.ok(dustyTicks.every((tick) => tick.batteryAfter >= 0))
  assert.equal(solar.state.outcome, 'permanent-city')
  assert.equal(solar.assessment.viable, true)
  assert.equal(solar.assessment.independent, true)
  assert.ok(solar.report.grades.every((grade) => grade.score >= 90), 'there must be a legitimate A route through every category')
})

test('final viability forecast uses the actual finished staffing and evolving ledger, with no deliveries or input injection', () => {
  for (const route of [...results, solar]) {
    const assessment = colonyAssessment(route.state)
    assert.deepEqual(assessment.stats, colonyStats(route.state))
    let shadow = route.state
    for (let day = 0; day < assessment.horizon; day += 1) {
      const actual = colonyStats(shadow)
      assert.ok(actual.powerRatio >= 0.99, `${route.openingId}: forecast day ${day} power`)
      assert.ok(actual.crewCapacity >= shadow.crew)
      shadow = operateSol(shadow, actual)
      assert.ok(['water', 'oxygen', 'food', 'parts'].every((key) => shadow.resources[key] > 0), `${route.openingId}: forecast reserves`)
      assert.ok(shadow.resources.integrity >= 70)
    }
    assert.equal(shadow.sol, route.state.sol + 30)
  }
})

test('write native campaign qualification receipts after successful evaluation', () => {
  assert.equal(results.length, 36)
  assert.ok(results.every((route) => route.state.outcome === 'permanent-city' && route.assessment.viable && !route.failures.length))
  if (!output) return // Evidence export is opt-in; tests work in any checkout.
  fs.mkdirSync(output, { recursive: true })
  const summary = {
    generatedAt: new Date().toISOString(), method: 'Untouched createInitialState sponsor state; only legal public manifest, rover, lead, cross-training, placement, decision, repair and advanceSol functions. No injected resources, buildings or surveyed ice.',
    qualification: '36 sponsor × opening × follow-on campaign permutations plus one battery-backed solar campaign; deterministic developer strategy, not novice-human balance certification.',
    qualifiedRoutes: results.length, nativeTickCount: [...results, solar].reduce((sum, route) => sum + route.ticks.length, 0),
    strategy: 'Construction support and logistics lead are real assignments. Every placed site waits for its finite shared work queue to commission through elapsed sols before rovers move to survey or hauling. Survey uses real rover time and completes all prospects. Fission core and workshop precede expansion. Medical-led recovery shifts preserve crew condition, then balanced staffing meets review requirements. Affordable cooperative/transparent policies are chosen. Damage is repaired through the actual paid command.',
    results: results.map((route) => route.summary), solar: solar.summary,
  }
  fs.writeFileSync(path.join(output, 'NATIVE_CAMPAIGN_MATRIX.json'), JSON.stringify(summary, finiteJSON, 2) + '\n')
  fs.writeFileSync(path.join(output, 'NATIVE_CAMPAIGN_DETAILS.json'), JSON.stringify([...results, solar].map((route) => ({ sponsorId: route.sponsorId, openingId: route.openingId, followOnId: route.followOnId, solar: route.solar, initial: route.initial, actions: route.actions, ticks: route.ticks, finalSummary: route.summary })), finiteJSON, 2) + '\n')
  fs.writeFileSync(path.join(output, 'NATIVE_SOLAR_CAMPAIGN.json'), JSON.stringify({ ...solar.summary, actions: solar.actions, ticks: solar.ticks, finalState: solar.state, assessment: { ...solar.assessment, stats: undefined }, report: solar.report }, finiteJSON, 2) + '\n')
})
