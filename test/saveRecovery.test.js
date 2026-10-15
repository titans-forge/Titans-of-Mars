import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createInitialState } from '../src/game/initialState.js'
import { applyManifest, placeBuilding, restoreState } from '../src/game/simulation.js'
import { SAVE_KEY, createSavePersistence } from '../src/game/persistence.js'
import { validateRestoredState } from '../src/game/saveValidation.js'

const clone = (value) => structuredClone(value)
const mission = () => applyManifest(createInitialState('american-compact'), 'industrial-seed').state
const raw = (state) => JSON.stringify(state)
const validatedRestore = (value) => {
  const migrated = restoreState(value)
  if (!migrated) return null
  const checked = validateRestoredState(migrated)
  return checked.valid ? checked.state : null
}
function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries))
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }
}
const persistence = (storage) => createSavePersistence({ storage, restore: validatedRestore })

// A reconstructed early-version fixture containing only fields used by the v1
// implementation/migration contract, rather than a v9 save with its number edited.
function earlyV1Fixture() {
  return {
    version: 1, sol: 4, speed: 12, crew: 6,
    resources: { water: 2100, oxygen: 1500, food: 310, parts: 120, cargo: 5.1, confidence: 70, integrity: 100 },
    buildings: [
      { uid: 'cargo-1', type: 'cargo', col: 1, row: 2, integrity: 100 },
      { uid: 'solar-1', type: 'solar', col: 3, row: 1, integrity: 100 },
      { uid: 'storage-1', type: 'storage', col: 3, row: 4, integrity: 100 },
    ],
    selectedUid: 'cargo-1', buildMode: null, stormSurvived: false, outcome: null,
    log: [{ sol: 1, tone: 'info', message: 'Pathfinder has landed.' }],
  }
}

test('current sponsor selection and all sponsor payloads round-trip; running restores pause', () => {
  const initial = createInitialState()
  assert.equal(validateRestoredState(initial).valid, true)
  assert.equal(validatedRestore(raw(initial)).sponsorId, null)
  for (const [sponsorId, manifestId] of [['american-compact', 'industrial-seed'], ['china-directorate', 'cn-industrial-base'], ['europe-cooperative', 'eu-solar-microgrid'], ['russia-directorate', 'ru-surface-logistics']]) {
    const state = { ...applyManifest(createInitialState(sponsorId), manifestId).state, speed: 12 }
    const restored = validatedRestore(raw(state))
    assert.ok(restored, sponsorId)
    assert.equal(restored.speed, 0)
    assert.deepEqual(restored.resources, state.resources)
    assert.deepEqual(restored.buildings, state.buildings)
  }
})

test('early v1 data without newer fields migrates to a usable paused mission', () => {
  const restored = validatedRestore(raw(earlyV1Fixture()))
  assert.ok(restored)
  assert.equal(restored.version, 9)
  assert.equal(restored.manifestId, 'legacy-balanced')
  assert.equal(restored.sponsorId, 'american-compact')
  assert.equal(restored.sol, 4)
  assert.equal(restored.speed, 0)
  assert.equal(restored.crewMembers.length, restored.crew)
  assert.deepEqual(restored.resolvedEventIds, [])
})

test('pending construction round-trips its paid receipt and progress; missing or null jobs stay commissioned', () => {
  const result = placeBuilding(mission(), 'storage', 2, 2)
  assert.equal(result.error, '')
  const state = result.state
  assert.ok(state.buildings.at(-1).construction, 'a native placement must save an unfinished job')
  const restored = validatedRestore(raw(state))
  assert.ok(restored)
  assert.deepEqual(restored.buildings, state.buildings)
  assert.equal(restored.version, 9)
  assert.equal(restored.mechanicsVersion, 2)
  assert.equal(restored.batteryCharge, state.batteryCharge, 'construction must not remigrate stored energy')
  const legacy = clone(mission())
  legacy.buildings[1].construction = null
  assert.ok(validatedRestore(raw(legacy)))
  assert.deepEqual(validatedRestore(raw(legacy)).buildings, legacy.buildings)
})

test('saved construction rejects invalid work, receipts, ownership and future starts', () => {
  const state = placeBuilding(mission(), 'storage', 2, 2).state
  const job = () => state.buildings.at(-1).construction
  assert.ok(job())
  for (const mutate of [
    (copy) => { copy.buildings.at(-1).construction = [] },
    (copy) => { copy.buildings.at(-1).construction = 'finished' },
    (copy) => { copy.buildings.at(-1).construction.requiredWork = 0 },
    (copy) => { copy.buildings.at(-1).construction.requiredWork = 21 },
    (copy) => { copy.buildings.at(-1).construction.requiredWork = 0.1 },
    (copy) => { copy.buildings.at(-1).construction.completedWork = -1 },
    (copy) => { copy.buildings.at(-1).construction.completedWork = job().requiredWork },
    (copy) => { copy.buildings.at(-1).construction.completedWork = Infinity },
    (copy) => { copy.buildings.at(-1).construction.startedSol = 0 },
    (copy) => { copy.buildings.at(-1).construction.startedSol = copy.sol + 1 },
    (copy) => { copy.buildings.at(-1).construction.startedSol = 1.5 },
    (copy) => { copy.buildings.at(-1).construction.paid = null },
    (copy) => { delete copy.buildings.at(-1).construction.paid.cargo },
    (copy) => { copy.buildings.at(-1).construction.paid.parts = -1 },
    (copy) => { copy.buildings.at(-1).construction.paid.parts = 31 },
    (copy) => { copy.buildings.at(-1).construction.paid.cargo = 2.1 },
    (copy) => { copy.buildings.at(-1).construction.paid.cargo = NaN },
    (copy) => { copy.buildings.at(-1).construction.paid.water = 10 },
    (copy) => { copy.buildings.at(-1).construction.commissioned = true },
    (copy) => { copy.buildings[0].construction = clone(job()) },
  ]) {
    const copy = clone(state); mutate(copy)
    assert.equal(validateRestoredState(copy).valid, false, mutate.toString())
    assert.equal(validatedRestore(raw(copy)), null, mutate.toString())
  }
  const policyCost = clone(state)
  policyCost.buildings.at(-1).construction.paid = { parts: 30, cargo: 2 }
  assert.equal(validateRestoredState(policyCost).valid, true, 'valid historical policy cost is bounded by the full accepted multiplier range')
})

test('invalid scalar, resource and enum values are rejected rather than defaulted', () => {
  const mutations = [
    (state) => { state.resources = null },
    (state) => { state.resources.water = -1 },
    (state) => { state.resources.oxygen = '1200' },
    (state) => { state.resources.integrity = 101 },
    (state) => { state.resources.cargo = null },
    (state) => { state.resources.darkMatter = 20 },
    (state) => { state.sol = 0 },
    (state) => { state.sol = 3.5 },
    (state) => { state.speed = 99 },
    (state) => { state.phase = 'imaginary' },
    (state) => { state.outcome = 'won-everything' },
    (state) => { state.buildMode = 'reactor-free' },
    (state) => { state.crossTraining = 'wizard' },
  ]
  for (const mutate of mutations) {
    const state = clone(mission()); mutate(state)
    assert.equal(validateRestoredState(state).valid, false, mutate.toString())
    assert.equal(validatedRestore(raw(state)), null, mutate.toString())
  }
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const state = clone(mission()); state.resources.parts = invalid
    assert.equal(validateRestoredState(state).valid, false)
    assert.equal(validatedRestore(raw(state)), null)
  }
  const zero = mission()
  zero.resources.water = 0
  zero.resources.parts = 0
  assert.equal(validateRestoredState(zero).valid, true)
})

test('building IDs, types, coordinates, integrity and selected references are validated', () => {
  for (const mutate of [
    (state) => { state.buildings[1].type = 'unknown' },
    (state) => { state.buildings[1].type = '__proto__' },
    (state) => { state.buildings[1].uid = state.buildings[0].uid },
    (state) => { state.buildings[1].col = 9 },
    (state) => { state.buildings[1].row = -1 },
    (state) => { state.buildings[1].col = 0.5 },
    (state) => { state.buildings[1].col = 1; state.buildings[1].row = 2 },
    (state) => { state.buildings[1].integrity = -2 },
    (state) => { state.selectedUid = 'does-not-exist' },
    (state) => { state.buildings = [] },
  ]) {
    const state = clone(mission()); mutate(state)
    assert.equal(validatedRestore(raw(state)), null, mutate.toString())
  }
})

test('sponsor, manifest, cohorts, rover assignments and site relationships cannot contradict', () => {
  for (const mutate of [
    (state) => { state.sponsorId = 'fake-sponsor' },
    (state) => { state.manifestId = 'cn-industrial-base' },
    (state) => { state.manifestDoctrine = 'Free money' },
    (state) => { state.secondManifestId = 'eu-civic-charter' },
    (state) => { state.crewCohorts.engineering += 1 },
    (state) => { state.crewCohorts.support = -1 },
    (state) => { state.roverAssignments.water = 10 },
    (state) => { state.roverAssignments.airlift = 0 },
    (state) => { state.roverFleet = 9 },
    (state) => { state.surveyedFeatureIds = ['elysium-west'] },
    (state) => { state.crewMembers[1].id = state.crewMembers[0].id },
    (state) => { state.crewMembers[0].trait = 'systems' },
    (state) => { state.crewLeadId = 'not-in-crew' },
    (state) => { state.buildDiscounts = { nuclear: { parts: 500, cargo: 1 } } },
    (state) => { state.rivalSettlementId = 'kepler-network' },
  ]) {
    const state = clone(mission()); mutate(state)
    assert.equal(validatedRestore(raw(state)), null, mutate.toString())
  }
})

test('pending and resolved decisions must match the sponsor, mission phase and sol', () => {
  const valid = { ...mission(), sol: 12, pendingEventId: 'us-congressional-audit' }
  assert.ok(validatedRestore(raw(valid)))
  for (const mutate of [
    (state) => { state.pendingEventId = 'cn-production-quota' },
    (state) => { state.pendingEventId = 'not-real' },
    (state) => { state.sol = 11 },
    (state) => { state.resolvedEventIds = ['us-congressional-audit'] },
    (state) => { state.resolvedEventIds = ['us-insurance-control'] },
    (state) => { state.resolvedEventIds = ['us-congressional-audit', 'us-congressional-audit'] },
    (state) => { state.pendingOperationalIncidentId = 'dust-lock-contamination' },
    (state) => { state.pendingRivalEncounterId = 'us-orbital-relay' },
  ]) {
    const state = clone(valid); mutate(state)
    assert.equal(validatedRestore(raw(state)), null, mutate.toString())
  }
  const incident = { ...mission(), sol: 7, pendingOperationalIncidentId: 'dust-lock-contamination' }
  assert.ok(validatedRestore(raw(incident)))
})

test('new policy and assignment fields are bounded when present', () => {
  const state = {
    ...mission(), mechanicsVersion: 2,
    policyEffects: { maintenanceMultiplier: 0.9, constructionCargoMultiplier: 1.1, surveyBonus: 1 },
    assignmentCommitment: { sol: 1, roverAssignments: { water: 1, construction: 1, maintenance: 0, survey: 0 }, crewLeadId: 'elena-torres' },
  }
  assert.equal(validateRestoredState(state).valid, true)
  for (const mutate of [
    (copy) => { copy.policyEffects.surveyBonus = 50 },
    (copy) => { copy.policyEffects.maintenanceMultiplier = -1 },
    (copy) => { copy.assignmentCommitment.sol = 400 },
    (copy) => { copy.assignmentCommitment.crewLeadId = 'nobody' },
    (copy) => { copy.assignmentCommitment.roverAssignments.survey = 10 },
    (copy) => { copy.mechanicsVersion = 999 },
  ]) {
    const copy = clone(state); mutate(copy)
    assert.equal(validateRestoredState(copy).valid, false)
  }
})

test('blocked localStorage getter, reads and writes never throw or prevent play/export', () => {
  for (const storage of [
    () => { throw new Error('SecurityError') },
    { getItem() { throw new Error('SecurityError') }, setItem() { throw new Error('SecurityError') } },
    null,
  ]) {
    const saves = persistence(storage)
    assert.equal(saves.load().status, 'unavailable')
    const state = mission()
    const saved = saves.save(state)
    assert.equal(saved.status, 'unavailable')
    assert.equal(saved.state, state)
    assert.ok(JSON.parse(saves.exportSave(state)).resources)
  }
})

test('corrupt primary is never overwritten by an automatic fresh mission save', () => {
  const damaged = '{broken original campaign'
  const store = memoryStorage({ [SAVE_KEY]: damaged })
  const saves = persistence(store)
  const loaded = saves.load()
  assert.equal(loaded.status, 'corrupt')
  assert.equal(loaded.state, null)
  assert.equal(loaded.recoveryRaw, damaged)
  assert.equal(store.data.get(`${SAVE_KEY}:recovery`), damaged)
  assert.equal(saves.save(createInitialState()).status, 'corrupt')
  assert.equal(store.data.get(SAVE_KEY), damaged)
  const reset = saves.reset(createInitialState())
  assert.equal(reset.status, 'saved')
  assert.equal(store.data.get(`${SAVE_KEY}:recovery`), damaged)
  assert.ok(validatedRestore(store.data.get(SAVE_KEY)))
})

test('corrupt primary restores a valid backup paused while preserving the exact original', () => {
  const backup = { ...mission(), speed: 12 }
  const damaged = raw({ ...mission(), resources: {} })
  const store = memoryStorage({ [SAVE_KEY]: damaged, [`${SAVE_KEY}:backup`]: raw(backup) })
  const saves = persistence(store)
  const loaded = saves.load()
  assert.equal(loaded.status, 'recovered')
  assert.equal(loaded.state.speed, 0)
  assert.equal(loaded.backupAvailable, true)
  assert.equal(loaded.recoveryRaw, damaged)
  assert.equal(store.data.get(SAVE_KEY), damaged)
  assert.equal(store.data.get(`${SAVE_KEY}:recovery`), damaged)
  assert.equal(saves.save(loaded.state).status, 'saved')
  assert.equal(store.data.get(`${SAVE_KEY}:backup`), raw(backup))
  assert.equal(store.data.get(`${SAVE_KEY}:recovery`), damaged)
})

test('quota during backup or primary write preserves the last good mission', () => {
  for (const failingSlot of [`${SAVE_KEY}:backup`, SAVE_KEY]) {
    const old = mission()
    const store = memoryStorage({ [SAVE_KEY]: raw(old) })
    const normalSet = store.setItem
    store.setItem = (key, value) => { if (key === failingSlot) throw new Error('QuotaExceededError'); normalSet(key, value) }
    const saves = persistence(store)
    assert.equal(saves.load().status, 'saved')
    const changed = clone(old); changed.resources.parts -= 10
    const result = saves.save(changed)
    assert.equal(result.status, 'unsaved')
    assert.equal(store.data.get(SAVE_KEY), raw(old))
    assert.equal(JSON.parse(saves.exportSave(changed)).resources.parts, changed.resources.parts)
  }
})

test('if damaged-original preservation fails, autosave holds the original and recovery stays exportable', () => {
  const damaged = 'bad but recoverable bytes'
  const store = memoryStorage({ [SAVE_KEY]: damaged, [`${SAVE_KEY}:backup`]: raw(mission()) })
  store.setItem = () => { throw new Error('QuotaExceededError') }
  const saves = persistence(store)
  const loaded = saves.load()
  assert.equal(loaded.status, 'recovered')
  assert.equal(loaded.recoveryRaw, damaged)
  assert.equal(saves.save(loaded.state).status, 'corrupt')
  assert.equal(store.data.get(SAVE_KEY), damaged)
})

test('new-mission reset creates a recoverable previous-good backup instead of deleting the mission', () => {
  const previous = mission()
  const store = memoryStorage({ [SAVE_KEY]: raw(previous) })
  const saves = persistence(store)
  saves.load()
  const reset = saves.reset(createInitialState())
  assert.equal(reset.status, 'saved')
  assert.equal(reset.backupAvailable, true)
  assert.equal(store.data.get(`${SAVE_KEY}:backup`), raw(previous))
  const recovered = saves.recoverBackup()
  assert.equal(recovered.state.manifestId, previous.manifestId)
  assert.equal(recovered.state.speed, 0)
  assert.equal(recovered.status, 'saved')
})

test('invalid imports leave primary/backup untouched, and valid imports back up and pause', () => {
  const state = mission()
  const store = memoryStorage({ [SAVE_KEY]: raw(state) })
  const saves = persistence(store)
  saves.load()
  for (const invalid of ['{bad', 'null', raw({ ...state, outcome: '???' })]) {
    assert.equal(saves.importSave(invalid).status, 'invalid')
    assert.equal(store.data.get(SAVE_KEY), raw(state))
    assert.equal(store.data.has(`${SAVE_KEY}:backup`), false)
  }
  const incoming = clone(state); incoming.resources.parts -= 30; incoming.speed = 12
  const imported = saves.importSave(raw(incoming))
  assert.equal(imported.status, 'saved')
  assert.equal(imported.state.speed, 0)
  assert.equal(imported.state.resources.parts, incoming.resources.parts)
  assert.equal(store.data.get(`${SAVE_KEY}:backup`), raw(state))
  assert.equal(JSON.parse(store.data.get(SAVE_KEY)).speed, 0)
})

test('malformed field shapes and prototype-like identifiers fail without throwing', () => {
  const baseline = mission()
  for (const key of Object.keys(baseline)) {
    for (const invalid of ['__proto__', 'constructor', {}, [], null, 12, false, '']) {
      const state = clone(baseline)
      state[key] = invalid
      assert.doesNotThrow(() => validateRestoredState(state), `${key}: ${String(invalid)}`)
    }
  }
  assert.equal(validatedRestore('{"version":9,"buildings":[{"type":"unknown"}]}'), null)
})

test('a second damaged primary does not silently erase the first preserved original', () => {
  const first = 'first damaged campaign'
  const second = 'second damaged campaign'
  const store = memoryStorage({ [SAVE_KEY]: second, [`${SAVE_KEY}:recovery`]: first })
  const saves = persistence(store)
  const loaded = saves.load()
  assert.equal(loaded.recoveryRaw, second)
  assert.equal(store.data.get(`${SAVE_KEY}:recovery`), second)
  assert.equal(store.data.get(`${SAVE_KEY}:recovery:previous`), first)
  assert.equal(store.data.get(SAVE_KEY), second)
})


test('actual pre-upgrade v9 Sol 41 audit checkpoint retains its campaign and migrates battery once', () => {
  const before = JSON.parse(readFileSync(new URL('./fixtures/audited-v9-sol41.json', import.meta.url), 'utf8'))
  assert.equal(validateRestoredState(before).valid, true)
  const restored = restoreState(raw(before))
  assert.ok(restored)
  assert.equal(restored.sol, 41)
  assert.equal(restored.secondManifestId, before.secondManifestId)
  assert.equal(restored.crew, 10)
  assert.deepEqual(restored.resources, before.resources)
  assert.deepEqual(restored.buildings, before.buildings)
  assert.deepEqual(restored.decisionLog, before.decisionLog)
  assert.equal(restored.speed, 0)
  assert.equal(restored.mechanicsVersion, 2)
  assert.equal(restored.batteryCharge, before.batteryCharge * (6000 / 260))
  const secondRestore = restoreState(raw(restored))
  assert.ok(secondRestore)
  assert.equal(secondRestore.batteryCharge, restored.batteryCharge)
})
