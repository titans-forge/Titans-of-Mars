import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStoredVolume, soundtrackTrackIdForState, soundtrackTracks } from '../src/game/soundtrack.js'

test('soundtrack registry contains the four self-hosted recordings', () => {
  assert.deepEqual(soundtrackTracks.map((track) => track.id), ['bach-aria', 'handel-sarabande', 'holst-venus', 'holst-mars'])
  soundtrackTracks.forEach((track) => {
    assert.match(track.src, /^\.\/audio\/.+\.mp3$/)
    assert.match(track.source, /^https:\/\//)
  })
})

test('stored soundtrack volume accepts only normalized values', () => {
  assert.equal(parseStoredVolume(null), 0.24)
  assert.equal(parseStoredVolume('0.65'), 0.65)
  assert.equal(parseStoredVolume('-1'), 0.24)
  assert.equal(parseStoredVolume('loud'), 0.24)
})

test('soundtrack recommendations follow colony conditions', () => {
  assert.equal(soundtrackTrackIdForState({ phase: 'survival' }, {}), 'bach-aria')
  assert.equal(soundtrackTrackIdForState({ phase: 'survival', pendingEventId: 'event' }, {}), 'handel-sarabande')
  assert.equal(soundtrackTrackIdForState({ phase: 'survival', transferWindowPending: true }, {}), 'handel-sarabande')
  assert.equal(soundtrackTrackIdForState({ phase: 'expansion' }, {}), 'holst-venus')
  assert.equal(soundtrackTrackIdForState({ phase: 'expansion' }, { storm: true }), 'holst-mars')
  assert.equal(soundtrackTrackIdForState({ phase: 'expansion' }, { debris: true }), 'holst-mars')
})


test('music preferences tolerate blocked storage and quota without breaking the game', async () => {
  const { loadMusicVolume, saveMusicVolume } = await import('../src/game/soundtrack.js')
  const blocked = () => { throw new Error('SecurityError') }
  assert.equal(loadMusicVolume(blocked), 0.24)
  assert.equal(saveMusicVolume(blocked, 0.5), false)
  assert.equal(loadMusicVolume(() => ({ getItem() { throw new Error('Denied') } })), 0.24)
  assert.equal(saveMusicVolume(() => ({ setItem() { throw new Error('QuotaExceeded') } }), 0.5), false)
})
