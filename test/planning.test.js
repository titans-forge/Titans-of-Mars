import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState } from '../src/game/initialState.js'
import { advanceSol, applyManifest, colonyStats, updateRoverAssignment } from '../src/game/simulation.js'
import { LEARNING_SOL_MS, constructionPreview, nextMissionAction, reserveCoverage } from '../src/ui/planning.js'

function start() { return applyManifest(createInitialState('american-compact'), 'industrial-seed').state }

test('first-run guidance starts with surveying and reaches a legal first ice placement without pre-unlocking sites', () => {
  let state = start()
  assert.equal(state.surveyedFeatureIds.length, 0)
  assert.equal(nextMissionAction(state, colonyStats(state)).action, 'rovers')
  const from = Object.entries(state.roverAssignments).find(([id, count]) => id !== 'survey' && count > 0)[0]
  state = updateRoverAssignment(state, from, -1).state
  state = updateRoverAssignment(state, 'survey', 1).state
  assert.equal(nextMissionAction(state, colonyStats(state)).action, 'step')
  state = advanceSol(advanceSol(state))
  const advice = nextMissionAction(state, colonyStats(state))
  assert.equal(advice.action, 'ice')
  assert.match(advice.detail, /column 2, row 6/)
  const before = JSON.stringify(state)
  const preview = constructionPreview(state, 'ice', 1, 5)
  assert.equal(preview.ok, true)
  assert.ok(Number.isFinite(preview.after.waterNet))
  assert.ok(Number.isFinite(preview.storm.powerCapacity))
  assert.equal(JSON.stringify(state), before, 'preview must not spend supplies or mutate the mission')
})

test('construction preview rejects unconfirmed ice and occupied cells with the actual rule reason', () => {
  const state = start()
  const ice = constructionPreview(state, 'ice', 1, 5)
  assert.equal(ice.ok, false)
  assert.match(ice.reason, /rover-confirmed/)
  const occupied = constructionPreview(state, 'nuclear', 1, 2)
  assert.equal(occupied.ok, false)
  assert.match(occupied.reason, /occupied/)
})

test('reserve descriptions distinguish depletion, balance and invalid inputs', () => {
  assert.equal(reserveCoverage(0, 2), 'Empty')
  assert.equal(reserveCoverage(99, -10), '9 sols at current use')
  assert.equal(reserveCoverage(99, 0), 'Stable at current balance')
  assert.equal(reserveCoverage(NaN, -10), 'Unavailable')
  assert.equal(LEARNING_SOL_MS, 5000)
})
