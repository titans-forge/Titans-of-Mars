import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { SITE_APPEARANCES, appearanceForSponsor } from '../src/rendering/siteAppearance.js'
import { createInitialState } from '../src/game/initialState.js'
import { siteForSponsor } from '../src/game/siteFeatures.js'

const expected = {
  'american-compact': { key: 'arcadia', name: 'Arcadia Planitia' },
  'china-directorate': { key: 'utopia', name: 'Utopia Planitia' },
  'europe-cooperative': { key: 'elysium', name: 'Elysium Planitia' },
  'russia-directorate': { key: 'isidis', name: 'Isidis Planitia' },
}

test('each founding sponsor has the correct distinct visual site identity', () => {
  assert.deepEqual(Object.keys(SITE_APPEARANCES).sort(), Object.keys(expected).sort())
  for (const [sponsorId, identity] of Object.entries(expected)) {
    const theme = appearanceForSponsor(sponsorId), state = createInitialState(sponsorId), snapshot = structuredClone(state)
    assert.equal(theme.key, identity.key)
    assert.equal(theme.name, identity.name)
    assert.ok(siteForSponsor(sponsorId).name.startsWith(theme.name), 'the appearance must describe the sponsor’s actual operating site')
    assert.match(theme.landform, /\S/)
    assert.match(theme.accent, /^#[0-9a-f]{6}$/i)
    assert.deepEqual(Object.keys(theme.palette).sort(), ['backdrop', 'fill', 'grid'])
    for (const color of Object.values(theme.palette)) assert.ok(Number.isInteger(color) && color >= 0 && color <= 0xffffff)
    const source = new URL(theme.source)
    assert.equal(source.protocol, 'https:')
    assert.ok(['science.nasa.gov', 'www.jpl.nasa.gov'].includes(source.hostname), 'reference metadata identifies its NASA/JPL source')
    assert.deepEqual(state, snapshot)
  }
  for (const field of ['key', 'name', 'textureKey', 'asset', 'accent']) assert.equal(new Set(Object.values(SITE_APPEARANCES).map((theme) => theme[field])).size, 4, `all four ${field} identities are distinct`)
  assert.equal(new Set(Object.values(SITE_APPEARANCES).map((theme) => JSON.stringify(theme.palette))).size, 4)
})

test('unselected or unknown sponsor values consistently fall back to Arcadia', () => {
  const fallback = SITE_APPEARANCES['american-compact']
  for (const id of [null, undefined, '', 'unknown-sponsor', '__proto__', 'constructor', 'toString']) assert.strictEqual(appearanceForSponsor(id), fallback, String(id))
})

test('appearance configuration cannot be mutated across missions', () => {
  assert.equal(Object.isFrozen(SITE_APPEARANCES), true)
  const before = JSON.stringify(SITE_APPEARANCES)
  for (const sponsorId of Object.keys(expected)) {
    const appearance = appearanceForSponsor(sponsorId)
    assert.equal(Object.isFrozen(appearance), true)
    assert.equal(Object.isFrozen(appearance.palette), true)
    assert.throws(() => { appearance.palette.grid = 0 }, TypeError)
  }
  assert.equal(JSON.stringify(SITE_APPEARANCES), before)
})

test('all four sponsor terrain references resolve to nonempty self-hosted PNG assets', () => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const hashes = new Set()
  for (const theme of Object.values(SITE_APPEARANCES)) {
    assert.match(theme.asset, /^\.\/assets\/[a-z0-9/-]+\.png$/)
    const content = readFileSync(new URL(`../public/${theme.asset.slice(2)}`, import.meta.url))
    assert.ok(content.length > 24, theme.asset)
    assert.ok(content.subarray(0, 8).equals(signature), `${theme.asset} is a real PNG`)
    assert.ok(content.readUInt32BE(16) > 0 && content.readUInt32BE(20) > 0, 'the PNG has a nonempty image canvas')
    hashes.add(createHash('sha256').update(content).digest('hex'))
  }
  assert.equal(hashes.size, 4, 'distinct sponsor filenames must also load four distinct terrain images')
})
