// Presentation only. Camera state is deliberately absent from colony saves.
export const MAP_CAMERA = Object.freeze({ width: 1200, height: 680, minZoom: 1, maxZoom: 2.2, zoomStep: 0.2, panStep: 96 })
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback

export function resetMapCamera() {
  return { zoom: 1, centerX: MAP_CAMERA.width / 2, centerY: MAP_CAMERA.height / 2 }
}

export function clampMapCamera(view = {}) {
  const zoom = clamp(finite(view.zoom, 1), MAP_CAMERA.minZoom, MAP_CAMERA.maxZoom)
  const halfWidth = MAP_CAMERA.width / (2 * zoom), halfHeight = MAP_CAMERA.height / (2 * zoom)
  return { zoom, centerX: clamp(finite(view.centerX, MAP_CAMERA.width / 2), halfWidth, MAP_CAMERA.width - halfWidth), centerY: clamp(finite(view.centerY, MAP_CAMERA.height / 2), halfHeight, MAP_CAMERA.height - halfHeight) }
}

export function zoomMapCamera(view, delta) {
  const current = clampMapCamera(view)
  return clampMapCamera({ ...current, zoom: Math.round((current.zoom + finite(delta, 0)) * 1000) / 1000 })
}

export function panMapCamera(view, screenDx, screenDy) {
  const current = clampMapCamera(view)
  return clampMapCamera({ ...current, centerX: current.centerX + finite(screenDx, 0) / current.zoom, centerY: current.centerY + finite(screenDy, 0) / current.zoom })
}

export function focusMapCamera(view, point, zoom = 1.6) {
  const current = clampMapCamera(view)
  return clampMapCamera({ zoom: Math.max(current.zoom, finite(zoom, 1.6)), centerX: point?.x, centerY: point?.y })
}

export function worldToScreen(point, view) {
  const current = clampMapCamera(view)
  return { x: (point.x - current.centerX) * current.zoom + MAP_CAMERA.width / 2, y: (point.y - current.centerY) * current.zoom + MAP_CAMERA.height / 2 }
}

export function screenToWorld(point, view) {
  const current = clampMapCamera(view)
  return { x: (point.x - MAP_CAMERA.width / 2) / current.zoom + current.centerX, y: (point.y - MAP_CAMERA.height / 2) / current.zoom + current.centerY }
}
