import test from 'node:test'
import assert from 'node:assert/strict'
import { MAP_CAMERA, clampMapCamera, focusMapCamera, panMapCamera, resetMapCamera, screenToWorld, worldToScreen, zoomMapCamera } from '../src/rendering/mapCamera.js'
import { createInitialState } from '../src/game/initialState.js'
import { applyManifest } from '../src/game/simulation.js'

const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`)
function bounded(view) {
  assert.ok(Number.isFinite(view.zoom) && view.zoom >= MAP_CAMERA.minZoom && view.zoom <= MAP_CAMERA.maxZoom)
  const halfWidth = MAP_CAMERA.width / (2 * view.zoom), halfHeight = MAP_CAMERA.height / (2 * view.zoom)
  assert.ok(Number.isFinite(view.centerX) && view.centerX >= halfWidth - 1e-8 && view.centerX <= MAP_CAMERA.width - halfWidth + 1e-8, 'horizontal viewport remains inside the map')
  assert.ok(Number.isFinite(view.centerY) && view.centerY >= halfHeight - 1e-8 && view.centerY <= MAP_CAMERA.height - halfHeight + 1e-8, 'vertical viewport remains inside the map')
}

test('reset fits the entire map and discards prior zoom and pan', () => {
  const home = resetMapCamera()
  assert.deepEqual(home, { zoom: 1, centerX: 600, centerY: 340 })
  bounded(home)
  const zoomed = panMapCamera(zoomMapCamera(home, 1.2), 400, -300)
  bounded(zoomed)
  assert.deepEqual(resetMapCamera(), home)
  assert.notEqual(resetMapCamera(), home, 'view state is a fresh value, not a mutable shared singleton')
  close(worldToScreen({ x: 0, y: 0 }, home).x, 0)
  close(worldToScreen({ x: MAP_CAMERA.width, y: MAP_CAMERA.height }, home).y, MAP_CAMERA.height)
})

test('zoom and pan remain bounded through repeated extreme inputs', () => {
  let view = resetMapCamera()
  for (let step = 0; step < 120; step += 1) {
    view = zoomMapCamera(view, MAP_CAMERA.zoomStep)
    view = panMapCamera(view, step % 2 ? 1e6 : -1e6, step % 3 ? 1e6 : -1e6)
    bounded(view)
  }
  close(view.zoom, MAP_CAMERA.maxZoom)
  for (let step = 0; step < 120; step += 1) {
    view = zoomMapCamera(view, -MAP_CAMERA.zoomStep)
    view = panMapCamera(view, 1e6, -1e6)
    bounded(view)
  }
  assert.deepEqual(view, resetMapCamera(), 'a full-map view cannot retain a pan offset')
  for (const candidate of [{ zoom: -10, centerX: -1e6, centerY: 1e6 }, { zoom: 100, centerX: 1e6, centerY: -1e6 }, { zoom: NaN, centerX: Infinity, centerY: -Infinity }]) bounded(clampMapCamera(candidate))
})

test('screen pan distance converts to world distance exactly once at the active zoom', () => {
  const view = { zoom: 2, centerX: 600, centerY: 340 }, snapshot = { ...view }
  const next = panMapCamera(view, 96, -40)
  close(next.centerX, 648)
  close(next.centerY, 320)
  close(next.zoom, 2)
  assert.deepEqual(view, snapshot)
  const point = { x: 700, y: 400 }
  close(worldToScreen(point, next).x - worldToScreen(point, view).x, -96)
  close(worldToScreen(point, next).y - worldToScreen(point, view).y, 40)
})

test('world and screen projection round-trip every grid cell through multiple zoom and pan states', () => {
  const points = [{ x: 0, y: 0 }, { x: 1200, y: 680 }, { x: 600, y: 340 }, ...Array.from({ length: 54 }, (_, index) => {
    const col = index % 9, row = Math.floor(index / 9)
    return { x: 600 + (col - row) * 50, y: 178 + (col + row) * 25 }
  })]
  let roundTrips = 0
  for (const zoom of [1, 1.2, 1.6, 2, 2.2]) for (const [centerX, centerY] of [[600, 340], [0, 0], [1200, 680], [475, 425]]) {
    const view = clampMapCamera({ zoom, centerX, centerY }), snapshot = { ...view }
    bounded(view)
    close(worldToScreen({ x: view.centerX, y: view.centerY }, view).x, 600, 'camera center projects to viewport center')
    close(worldToScreen({ x: view.centerX, y: view.centerY }, view).y, 340)
    for (const point of points) {
      const original = { ...point }, projected = worldToScreen(point, view), restored = screenToWorld(projected, view)
      close(restored.x, point.x)
      close(restored.y, point.y)
      const screenAgain = worldToScreen(screenToWorld(point, view), view)
      close(screenAgain.x, point.x)
      close(screenAgain.y, point.y)
      assert.deepEqual(point, original)
      roundTrips += 1
    }
    assert.deepEqual(view, snapshot)
  }
  assert.equal(roundTrips, 1140)
})

test('focus raises overview zoom, preserves closer inspection and clamps edge targets safely', () => {
  const overview = resetMapCamera(), middle = focusMapCamera(overview, { x: 600, y: 340 })
  close(middle.zoom, 1.6)
  close(middle.centerX, 600)
  close(middle.centerY, 340)
  const closeView = { zoom: 2.2, centerX: 600, centerY: 340 }
  const kept = focusMapCamera(closeView, { x: 700, y: 400 }, 1.6)
  close(kept.zoom, 2.2)
  close(kept.centerX, 700)
  close(kept.centerY, 400)
  for (const point of [{ x: 0, y: 0 }, { x: 1200, y: 680 }, { x: -1e6, y: 1e6 }]) bounded(focusMapCamera(overview, point, 100))
  assert.deepEqual(overview, resetMapCamera())
})

test('camera operations and selection projection never mutate the mission or supplied view values', () => {
  const state = applyManifest(createInitialState('american-compact'), 'industrial-seed').state
  const serialized = JSON.stringify(state)
  const view = Object.freeze(resetMapCamera()), point = Object.freeze({ x: 600, y: 178 })
  const focused = focusMapCamera(view, point)
  const panned = panMapCamera(focused, 150, -70)
  const zoomed = zoomMapCamera(panned, 0.4)
  const screen = worldToScreen(point, zoomed)
  const restored = screenToWorld(screen, zoomed)
  close(restored.x, point.x)
  close(restored.y, point.y)
  assert.equal(JSON.stringify(state), serialized, 'view changes cannot alter reserves, buildings, time or saved mission data')
  assert.deepEqual(view, resetMapCamera())
})
