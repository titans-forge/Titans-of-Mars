import Phaser from 'phaser'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BUILDINGS } from '../game/buildings.js'
import { knownSiteFeatures, terrainSupportsBuilding, unknownSurveyProspects } from '../game/siteFeatures.js'
import { cellWithinUtilityReach } from '../game/utilityNetwork.js'
import { ColonyActivity, constructionProgress, constructionStage, drawConstructionSite, preloadColonyActivity } from '../rendering/ColonyActivity.js'
import MapViewControls from './MapViewControls.jsx'
import { appearanceForSponsor } from '../rendering/siteAppearance.js'
import { clampMapCamera, focusMapCamera, panMapCamera, resetMapCamera, screenToWorld, worldToScreen, zoomMapCamera } from '../rendering/mapCamera.js'

const WIDTH = 1200
const HEIGHT = 680
const COLS = 9
const ROWS = 6
const TILE_W = 100
const TILE_H = 50
const ORIGIN_X = 600
const ORIGIN_Y = 178
const inside = (col, row) => col >= 0 && col < COLS && row >= 0 && row < ROWS
const cellToPoint = (col, row) => ({ x: ORIGIN_X + (col - row) * TILE_W / 2, y: ORIGIN_Y + (col + row) * TILE_H / 2 })

function pointToCell(x, y) {
  const dx = x - ORIGIN_X, dy = y - ORIGIN_Y
  return { col: Math.round(((dx / (TILE_W / 2)) + (dy / (TILE_H / 2))) / 2), row: Math.round(((dy / (TILE_H / 2)) - (dx / (TILE_W / 2))) / 2) }
}

function diamond(graphics, col, row, fillColor, fillAlpha, lineColor, lineAlpha = 1, width = 1) {
  const { x, y } = cellToPoint(col, row)
  const points = [new Phaser.Geom.Point(x, y - TILE_H / 2), new Phaser.Geom.Point(x + TILE_W / 2, y), new Phaser.Geom.Point(x, y + TILE_H / 2), new Phaser.Geom.Point(x - TILE_W / 2, y)]
  graphics.fillStyle(fillColor, fillAlpha).fillPoints(points, true)
  graphics.lineStyle(width, lineColor, lineAlpha).strokePoints(points, true)
}

function MapTooltip({ info, hostRef }) {
  const tooltipRef = useRef(null)
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current, host = hostRef.current
    if (!tooltip || !host) return undefined
    const position = () => {
      const width = host.clientWidth, height = host.clientHeight
      const left = Math.max(tooltip.offsetWidth / 2 + 8, Math.min(width - tooltip.offsetWidth / 2 - 8, info.x / WIDTH * width))
      const top = Math.max(8, Math.min(height - tooltip.offsetHeight - 8, info.y / HEIGHT * height + 16))
      Object.assign(tooltip.style, { left: `${left}px`, top: `${top}px`, visibility: 'visible' })
    }
    position()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    observer?.observe(host)
    observer?.observe(tooltip)
    return () => observer?.disconnect()
  }, [info, hostRef])
  return <div ref={tooltipRef} style={{ position: 'absolute', zIndex: 3, visibility: 'hidden', transform: 'translateX(-50%)', width: 'min(290px, 72%)', maxHeight: 'calc(100% - 16px)', overflow: 'hidden', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #749795', background: 'rgba(10,20,22,.94)', color: '#f4eee0', boxShadow: '0 4px 18px #0008', pointerEvents: 'none', fontSize: '12px', lineHeight: 1.5 }}><strong style={{ display: 'block', color: '#f3cf86', fontSize: '13px' }}>{info.title}</strong>{info.detail}</div>
}

class ColonyScene extends Phaser.Scene {
  constructor(callbacks) {
    super('colony')
    this.callbacks = callbacks
    this.buildings = []
    this.network = { connectedUids: [], isolatedUids: [], edges: [], online: 0, total: 0 }
    this.buildMode = null
    this.selectedUid = null
    this.spritesByUid = new Map()
    this.siteState = { sponsorId: null, surveyedFeatureIds: [] }
    this.siteSignature = ''
    this.networkSignature = ''
    this.hoverSignature = ''
    this.hoveredUid = null
    this.feedback = new Set()
    this.storm = false
    this.debris = false
    this.reducedMotion = false
    this.activity = null
    this.motionTime = 0
    this.mapView = resetMapCamera()
    this.panMode = false
    this.gridVisible = false
    this.networkVisible = false
    this.panDisabledObjects = new Set()
    this.dragState = null
    this.pendingTouchAction = null
    this.sceneReady = false
    this.terrainRequest = 0
    this.terrainLoads = new Map()
    this.terrainCleanups = new Set()
    this.appearance = appearanceForSponsor(null)
  }

  preload() {
    this.appearance = appearanceForSponsor(this.siteState.sponsorId)
    this.preloadedTerrainKey = this.appearance.textureKey
    this.load.image(this.appearance.textureKey, this.appearance.asset)
    this.load.spritesheet('building-atlas', './assets/building-atlas.png', { frameWidth: 443, frameHeight: 443 })
    this.load.spritesheet('building-expansion', './assets/building-atlas-expansion.png', { frameWidth: 443, frameHeight: 443 })
    preloadColonyActivity(this)
  }

  create() {
    this.sceneReady = true
    this.terrainBackdrop = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, this.appearance.palette.backdrop).setDepth(-20)
    this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT)
    this.setCameraView(this.mapView)
    const requestedKey = appearanceForSponsor(this.siteState.sponsorId).textureKey
    this.setAppearance(this.siteState.sponsorId, this.preloadedTerrainKey === requestedKey && !this.textures.exists(requestedKey))
    this.features = this.add.graphics()
    this.grid = this.add.graphics()
    this.coverage = this.add.graphics()
    this.links = this.add.graphics()
    this.selection = this.add.graphics()
    this.hover = this.add.graphics()
    this.condition = this.add.graphics().setDepth(1100)
    this.haze = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xcba079, 0).setDepth(1200)
    this.weather = this.add.graphics().setDepth(1201)
    this.dustMotes = Array.from({ length: 38 }, (_, index) => ({ x: (index * 197 + 43) % WIDTH, y: (index * 137 + 71) % HEIGHT, speed: 30 + (index % 7) * 7, size: 1.5 + (index % 4) }))
    this.activityRenderer = new ColonyActivity(this, { cellToPoint, cols: COLS, rows: ROWS })
    this.activityRenderer.setReducedMotion(this.reducedMotion)
    this.events.once('shutdown', () => {
      this.sceneReady = false
      this.terrainRequest += 1
      for (const cleanup of this.terrainCleanups) cleanup()
      this.terrainLoads.clear()
      this.activityRenderer.destroy()
      this.game.canvas.removeEventListener('touchcancel', cancelTouch)
      this.game.canvas.removeEventListener('touchstart', cancelMultitouch)
    })
    const cancelTouch = () => { this.pendingTouchAction = null; this.dragState = null }
    const cancelMultitouch = (event) => { if (event.touches.length > 1) cancelTouch() }
    this.game.canvas.addEventListener('touchcancel', cancelTouch, { passive: true })
    this.game.canvas.addEventListener('touchstart', cancelMultitouch, { passive: true })
    this.drawSiteFeatures()
    this.drawGrid()
    this.syncBuildings(this.buildings, this.network, true)
    this.setWeather(this.storm, this.debris)
    this.setLayers(this.gridVisible, this.networkVisible)
    this.setPanMode(this.panMode)
    this.input.on('pointermove', (pointer) => {
      if (this.pendingTouchAction?.id === pointer.id && !this.touchTapWithinThreshold(pointer)) { this.pendingTouchAction = null; this.clearHover() }
      if (this.panMode) {
        if (this.dragState?.id === pointer.id && pointer.isDown) this.setCameraView(panMapCamera(this.dragState.view, this.dragState.x - pointer.x, this.dragState.y - pointer.y))
        return
      }
      const point = this.pointerToWorld(pointer)
      this.drawHover(point.x, point.y)
    })
    this.input.on('gameout', () => { cancelTouch(); this.clearHover() })
    this.input.on('pointerup', (pointer) => { this.releaseTouchAction(pointer); this.dragState = null })
    this.input.on('pointerupoutside', cancelTouch)
    this.input.on('pointerdown', (pointer) => {
      if (this.panMode) { this.dragState = { id: pointer.id, x: pointer.x, y: pointer.y, view: this.mapView }; this.clearHover(); return }
      const point = this.pointerToWorld(pointer)
      const { col, row } = pointToCell(point.x, point.y)
      if (this.buildMode && inside(col, row)) this.callbacks.onPlace.current(this.buildMode, col, row)
      else this.drawHover(point.x, point.y)
    })
  }

  pointerToWorld(pointer) {
    return screenToWorld({ x: pointer.x, y: pointer.y }, this.mapView)
  }

  deferTouchAction(kind, args) {
    const pointer = this.input?.activePointer
    if (!pointer?.wasTouch || !pointer.isDown) return false
    this.pendingTouchAction = { kind, args, id: pointer.id, x: pointer.x, y: pointer.y }
    return true
  }

  touchTapWithinThreshold(pointer) {
    const pending = this.pendingTouchAction
    if (!pending || pending.id !== pointer.id) return false
    const bounds = this.game.canvas.getBoundingClientRect()
    const dx = (pointer.x - pending.x) * bounds.width / WIDTH, dy = (pointer.y - pending.y) * bounds.height / HEIGHT
    return Math.hypot(dx, dy) <= 10
  }

  releaseTouchAction(pointer) {
    const pending = this.pendingTouchAction
    const isTap = !this.panMode && !pointer.wasCanceled && this.touchTapWithinThreshold(pointer)
    this.pendingTouchAction = null
    if (pending && isTap) this.callbacks[pending.kind].current(...pending.args)
  }

  setCameraView(view) {
    this.pendingTouchAction = null
    this.mapView = clampMapCamera(view)
    if (this.sceneReady) this.cameras.main.setZoom(this.mapView.zoom).centerOn(this.mapView.centerX, this.mapView.centerY)
    this.clearHover()
    this.callbacks.onCamera.current(this.mapView)
  }

  controlCamera(action, x = 0, y = 0) {
    if (action === 'zoom') this.setCameraView(zoomMapCamera(this.mapView, x))
    else if (action === 'pan') this.setCameraView(panMapCamera(this.mapView, x, y))
    else if (action === 'reset') this.setCameraView(resetMapCamera())
    else if (action === 'focus') {
      const selected = this.buildings.find((building) => building.uid === this.selectedUid)
      if (selected) { const point = cellToPoint(selected.col, selected.row); this.setCameraView(focusMapCamera(this.mapView, { x: point.x, y: point.y - 25 })) }
    }
  }

  setPanMode(value) {
    this.panMode = Boolean(value)
    this.dragState = null
    this.pendingTouchAction = null
    this.clearHover()
    if (this.sceneReady) this.game.canvas.style.touchAction = this.panMode ? 'none' : 'pan-y pinch-zoom'
    this.syncInteractionMode()
  }

  syncInteractionMode() {
    if (!this.sceneReady) return
    if (this.panMode) {
      for (const object of this.children.list) if (object.input?.enabled) { object.disableInteractive(); this.panDisabledObjects.add(object) }
    } else {
      for (const object of this.panDisabledObjects) if (object.scene && object.input) object.setInteractive()
      this.panDisabledObjects.clear()
    }
  }

  setLayers(gridVisible, networkVisible) {
    this.gridVisible = Boolean(gridVisible)
    this.networkVisible = Boolean(networkVisible)
    this.grid?.setVisible(this.gridVisible || Boolean(this.buildMode))
    this.links?.setVisible(this.networkVisible)
  }

  loadTerrainTexture(appearance) {
    const { textureKey, asset } = appearance
    if (this.textures.exists(textureKey)) return Promise.resolve(textureKey)
    if (this.terrainLoads.has(textureKey)) return this.terrainLoads.get(textureKey)
    const promise = new Promise((resolve, reject) => {
      const event = `filecomplete-image-${textureKey}`
      const cleanup = () => { this.load.off(event, complete); this.load.off('loaderror', failed); this.terrainCleanups.delete(cleanup) }
      const complete = () => { cleanup(); this.terrainLoads.delete(textureKey); resolve(textureKey) }
      const failed = (file) => { if (file.key !== textureKey) return; cleanup(); this.terrainLoads.delete(textureKey); reject(new Error('Landscape unavailable')) }
      this.terrainCleanups.add(cleanup)
      this.load.once(event, complete)
      this.load.on('loaderror', failed)
      this.load.image(textureKey, asset)
      if (!this.load.isLoading()) this.load.start()
    })
    this.terrainLoads.set(textureKey, promise)
    return promise
  }

  async setAppearance(sponsorId, preloadFailed = false) {
    const appearance = appearanceForSponsor(sponsorId)
    this.appearance = appearance
    if (!this.sceneReady) return
    const request = ++this.terrainRequest
    const current = () => this.sceneReady && request === this.terrainRequest && this.appearance.textureKey === appearance.textureKey
    this.terrainBackdrop.setFillStyle(appearance.palette.backdrop)
    this.drawGrid()
    this.callbacks.onTerrain.current({ loading: true, fallback: false, unavailable: false })
    let key = null, fallback = false
    try {
      if (preloadFailed) throw new Error('Initial landscape unavailable')
      key = await this.loadTerrainTexture(appearance)
    } catch {
      if (!current()) return
      fallback = true
      const overview = appearanceForSponsor(null)
      if (appearance.textureKey !== overview.textureKey) {
        try { key = await this.loadTerrainTexture(overview) } catch { key = null }
      }
    }
    if (!current()) return
    if (key) {
      if (this.terrain) this.terrain.setTexture(key).setDisplaySize(WIDTH, HEIGHT).setVisible(true)
      else this.terrain = this.add.image(WIDTH / 2, HEIGHT / 2, key).setDisplaySize(WIDTH, HEIGHT).setDepth(-10)
    } else this.terrain?.setVisible(false)
    this.callbacks.onTerrain.current({ loading: false, fallback, unavailable: !key })
  }

  drawGrid() {
    if (!this.grid) return
    this.grid.clear()
    for (let row = 0; row < ROWS; row += 1) for (let col = 0; col < COLS; col += 1) {
      diamond(this.grid, col, row, this.appearance.palette.fill, 0.025, this.appearance.palette.grid, 0.3)
      const point = cellToPoint(col, row)
      this.grid.fillStyle(this.appearance.palette.grid, 0.5).fillCircle(point.x, point.y, 1.5)
    }
  }

  drawSiteFeatures() {
    this.features.clear()
    unknownSurveyProspects(this.siteState).forEach((feature) => {
      const color = 0xb49ddd, { x, y } = cellToPoint(feature.col, feature.row)
      diamond(this.features, feature.col, feature.row, color, 0.08, color, 0.7)
      this.features.lineStyle(2, color, 0.9).strokeCircle(x, y, 8)
      this.features.lineBetween(x - 12, y, x - 6, y).lineBetween(x + 6, y, x + 12, y)
    })
    knownSiteFeatures(this.siteState).forEach((feature) => {
      const color = feature.kind === 'ice' ? 0x64c3d3 : 0xe2ad38, { x, y } = cellToPoint(feature.col, feature.row)
      diamond(this.features, feature.col, feature.row, color, feature.kind === 'ice' ? 0.22 : 0.13, color, 0.9)
      if (feature.kind === 'ice') {
        this.features.fillStyle(color, 0.9).fillCircle(x - 10, y, 4).fillCircle(x, y - 5, 4).fillCircle(x + 10, y, 4)
      } else this.features.lineStyle(3, color, 0.9).lineBetween(x - 15, y + 6, x, y - 8).lineBetween(x, y - 8, x + 15, y + 6)
    })
  }

  clearHover() {
    this.hoveredUid = null
    this.hoverSignature = ''
    this.hover?.clear()
    this.callbacks.onInfo.current(null)
  }

  drawHover(x, y) {
    if (!this.hover || this.panMode) return
    const hoveredBuilding = !this.buildMode ? this.buildings.find((building) => building.uid === this.hoveredUid) : null
    const { col, row } = hoveredBuilding ?? pointToCell(x, y)
    if (!inside(col, row)) { this.clearHover(); return }
    const building = hoveredBuilding ?? this.buildings.find((item) => item.col === col && item.row === row)
    const reachable = cellWithinUtilityReach(this.buildings, this.network, col, row)
    const terrainValid = !this.buildMode || terrainSupportsBuilding(this.siteState, this.buildMode, col, row)
    const invalid = Boolean(this.buildMode && (building || !reachable || !terrainValid))
    const color = invalid ? 0xe56b54 : this.buildMode ? 0xf0bf52 : 0x88d4df
    const feature = knownSiteFeatures(this.siteState).find((item) => item.col === col && item.row === row)
    const unknown = unknownSurveyProspects(this.siteState).some((item) => item.col === col && item.row === row)
    const signature = `${col}:${row}:${this.buildMode}:${building?.uid}:${building?.integrity}:${reachable}:${terrainValid}:${feature?.id}:${unknown}`
    if (signature === this.hoverSignature) return
    this.hoverSignature = signature
    this.hover.clear()
    diamond(this.hover, col, row, color, this.buildMode ? 0.19 : 0.08, color, 1, 2)
    let title = `Grid ${col + 1}–${row + 1}`
    let detail = feature ? feature.kind === 'ice' ? `${feature.title} · Base yield ${feature.yield} L/sol before operating limits.` : `${feature.title} · Solar gain +${Math.round((feature.multiplier - 1) * 100)}%.` : unknown ? 'Unconfirmed ice prospect. Assign a ground-survey rover to reveal it.' : 'Surveyed construction ground.'
    if (building) {
      title = BUILDINGS[building.type]?.name ?? 'Structure'
      detail = constructionProgress(building) < 1 ? `${constructionStage(building)} · ${Math.floor(constructionProgress(building) * 100)}% complete · Awaiting commissioning · Grid ${col + 1}–${row + 1}` : `${Math.round(building.integrity)}% integrity · ${building.integrity <= 0 ? 'Destroyed' : this.network.connectedUids.includes(building.uid) ? 'Utility connected' : 'Utility disconnected'} · Grid ${col + 1}–${row + 1}`
    }
    if (this.buildMode) detail = building ? 'Occupied. Choose an empty valid cell.' : !terrainValid ? this.buildMode === 'ice' ? 'An extraction rig needs a confirmed ice lens.' : 'This cell is reserved for ice extraction.' : !reachable ? 'Outside utility reach. Extend from an operating connected structure.' : `Placement ground is valid for ${BUILDINGS[this.buildMode]?.name}. Command will check reserves.`
    const point = cellToPoint(col, row)
    this.callbacks.onInfo.current({ title, detail, x: point.x, y: point.y })
  }

  drawCoverage() {
    this.coverage?.clear()
    if (!this.coverage || !this.buildMode) return
    for (let row = 0; row < ROWS; row += 1) for (let col = 0; col < COLS; col += 1) {
      if (this.buildings.some((building) => building.col === col && building.row === row)) continue
      const valid = cellWithinUtilityReach(this.buildings, this.network, col, row) && terrainSupportsBuilding(this.siteState, this.buildMode, col, row)
      diamond(this.coverage, col, row, valid ? 0x77c7d8 : 0x6f2b27, valid ? 0.1 : 0.035, valid ? 0x77c7d8 : 0x6f2b27, valid ? 0.6 : 0.18)
    }
  }

  setBuildMode(type) {
    if (this.buildMode === type && this.coverage) return
    this.buildMode = type
    this.clearHover()
    this.drawCoverage()
    this.setLayers(this.gridVisible, this.networkVisible)
  }

  setSiteState(siteState) {
    const sponsorChanged = this.siteState.sponsorId !== siteState.sponsorId
    this.siteState = siteState
    if (sponsorChanged) this.setAppearance(siteState.sponsorId)
    const signature = `${siteState.sponsorId}:${[...(siteState.surveyedFeatureIds ?? [])].sort().join(',')}`
    if (!this.features || signature === this.siteSignature) return
    this.siteSignature = signature
    this.drawSiteFeatures()
    this.drawCoverage()
    this.clearHover()
  }

  setSelection(uid) {
    this.selectedUid = uid
    this.drawConditionMarkers()
  }

  drawConditionMarkers() {
    if (!this.condition) return
    this.condition.clear()
    this.selection.clear()
    for (const placed of this.buildings) {
      const { x, y } = cellToPoint(placed.col, placed.row)
      if (placed.uid === this.selectedUid) diamond(this.selection, placed.col, placed.row, 0xf0c35b, 0.08, 0xf7cf70, 1, 3)
      if (constructionProgress(placed) < 1) continue
      if (placed.integrity <= 0 || !this.network.connectedUids.includes(placed.uid)) {
        this.condition.fillStyle(0x241c1c, 0.95).fillCircle(x + 44, y + 18, 8)
        this.condition.lineStyle(2, 0xf09380, 1).strokeCircle(x + 44, y + 18, 8).lineBetween(x + 39, y + 23, x + 49, y + 13)
      } else if (placed.integrity < 100) {
        this.condition.fillStyle(0xeeb86b, 0.95).fillTriangle(x + 35, y + 25, x + 51, y + 25, x + 43, y + 10)
        this.condition.lineStyle(2, 0x3e2316, 1).lineBetween(x + 43, y + 15, x + 43, y + 20)
        this.condition.fillStyle(0x3e2316, 1).fillCircle(x + 43, y + 23, 1)
      }
    }
  }

  pulse(placed, color) {
    if (this.reducedMotion) return
    const marker = this.add.graphics().setDepth(1090)
    diamond(marker, placed.col, placed.row, color, 0.16, color, 1, 3)
    this.feedback.add(marker)
    this.tweens.add({ targets: marker, alpha: 0, duration: 800, ease: 'Sine.Out', onComplete: () => { this.feedback.delete(marker); marker.destroy() } })
  }

  syncBuildings(buildings, network = this.network, initial = false) {
    this.buildings = buildings
    this.network = network
    if (!this.links) return
    const connected = new Set(network.connectedUids)
    const byUid = new Map(buildings.map((building) => [building.uid, building]))
    let changed = false
    for (const [uid, entry] of this.spritesByUid) if (!byUid.has(uid)) {
      this.tweens.killTweensOf(entry.sprite)
      entry.sprite.destroy()
      entry.site?.destroy()
      entry.siteFront?.destroy()
      entry.siteLabel?.destroy()
      entry.siteZone?.destroy()
      this.spritesByUid.delete(uid)
      changed = true
    }
    for (const placed of buildings) {
      const definition = BUILDINGS[placed.type]
      if (!definition) continue
      const point = cellToPoint(placed.col, placed.row)
      const live = placed.integrity > 0 && connected.has(placed.uid)
      const progress = constructionProgress(placed)
      const signature = `${placed.type}:${placed.col}:${placed.row}:${placed.integrity}:${live}:${progress}`
      let entry = this.spritesByUid.get(placed.uid)
      const created = !entry
      if (!entry) {
        const uid = placed.uid
        const sprite = this.add.sprite(point.x, point.y + 18, definition.atlas ?? 'building-atlas', definition.frame).setOrigin(0.5, 0.73).setDisplaySize(154, 154).setDepth(point.y).setInteractive({ useHandCursor: true })
        entry = { sprite, placed, signature: '' }
        this.spritesByUid.set(uid, entry)
        sprite.on('pointerover', () => { if (this.panMode) return; this.hoveredUid = uid; const point = this.pointerToWorld(this.input.activePointer); this.drawHover(point.x, point.y) })
        sprite.on('pointerout', () => { this.hoveredUid = null; this.hoverSignature = ''; this.callbacks.onInfo.current(null) })
        sprite.on('pointerdown', (pointer, _localX, _localY, event) => {
          event?.stopPropagation()
          if (this.panMode) return
          const point = this.pointerToWorld(pointer)
          if (this.buildMode) {
            const { col, row } = pointToCell(point.x, point.y)
            if (inside(col, row)) this.callbacks.onPlace.current(this.buildMode, col, row)
            return
          }
          this.hoveredUid = uid
          this.callbacks.onSelect.current(uid)
          this.drawHover(point.x, point.y)
        })
      }
      if (signature !== entry.signature) {
        changed = true
        const old = entry.placed
        entry.sprite.setTexture(definition.atlas ?? 'building-atlas', definition.frame).setPosition(point.x, point.y + 18).setDepth(point.y)
        entry.sprite.setVisible(true)
        entry.sprite.setTint(placed.integrity <= 0 ? 0x6b625f : !live ? 0xa58b86 : placed.integrity < 75 ? 0xe0b294 : 0xffffff).setAlpha(placed.integrity <= 0 ? 0.46 : live ? 1 : 0.7)
        drawConstructionSite(entry, placed, point, this)
        if (created && !initial) {
          this.pulse(placed, 0xe6c477)
          if (!this.reducedMotion && progress >= 1) { entry.sprite.setAlpha(0.35); this.tweens.add({ targets: entry.sprite, alpha: live ? 1 : 0.7, duration: 280, ease: 'Sine.Out' }) }
        } else if (!created && constructionProgress(old) < 1 && progress >= 1) this.pulse(placed, 0x8bd9c2)
        else if (!created && placed.integrity > old.integrity) this.pulse(placed, 0x8bd9c2)
        else if (!created && placed.integrity < old.integrity) this.pulse(placed, 0xe99a71)
        entry.placed = placed
        entry.signature = signature
      }
    }
    const networkSignature = `${network.edges.map((edge) => `${edge.fromUid}>${edge.toUid}`).join(',')}:${buildings.map((building) => `${building.uid}:${building.col}:${building.row}`).join(',')}`
    if (networkSignature !== this.networkSignature) {
      this.networkSignature = networkSignature
      this.links.clear()
      for (const edge of network.edges) {
        const source = byUid.get(edge.fromUid), target = byUid.get(edge.toUid)
        if (!source || !target) continue
        const from = cellToPoint(source.col, source.row), to = cellToPoint(target.col, target.row)
        this.links.lineStyle(7, 0x26383b, 0.78).lineBetween(from.x, from.y + 12, to.x, to.y + 12)
        this.links.lineStyle(2, 0x64c3d3, 0.86).lineBetween(from.x, from.y + 12, to.x, to.y + 12)
      }
      changed = true
    }
    if (changed || initial) {
      this.drawConditionMarkers()
      this.drawCoverage()
      this.hoverSignature = ''
      if (this.input.activePointer?.isOver && !this.panMode) { const point = this.pointerToWorld(this.input.activePointer); this.drawHover(point.x, point.y) }
    }
    this.activityRenderer?.sync(this.activity, buildings)
    this.syncInteractionMode()
  }

  setActivity(activity) {
    this.activity = activity
    this.activityRenderer?.sync(activity, this.buildings)
    this.syncInteractionMode()
  }

  setReducedMotion(value) {
    this.reducedMotion = value
    this.activityRenderer?.setReducedMotion(value)
    if (value && this.tweens) {
      for (const marker of this.feedback) { this.tweens.killTweensOf(marker); marker.destroy() }
      this.feedback.clear()
      for (const entry of this.spritesByUid.values()) {
        this.tweens.killTweensOf(entry.sprite)
        const live = entry.placed.integrity > 0 && this.network.connectedUids.includes(entry.placed.uid)
        entry.sprite.setAlpha(entry.placed.integrity <= 0 ? 0.46 : live ? 1 : 0.7)
        if (constructionProgress(entry.placed) < 1) drawConstructionSite(entry, entry.placed, cellToPoint(entry.placed.col, entry.placed.row), this)
      }
    }
    if (this.weather) this.drawWeather(0)
  }

  setWeather(storm, debris) {
    this.storm = Boolean(storm)
    this.debris = Boolean(debris)
    if (!this.haze) return
    this.haze.setFillStyle(this.storm ? 0xcba079 : 0xb8b1a4, 1).setAlpha(this.storm ? 0.12 : this.debris ? 0.035 : 0)
    this.weather.clear()
    if (this.storm || this.debris) this.drawWeather(0)
  }

  drawWeather(time) {
    if (!this.weather) return
    this.weather.clear()
    if (!this.storm && !this.debris) return
    const seconds = this.reducedMotion ? 0 : time / 1000
    if (this.storm) {
      this.haze.setAlpha(this.reducedMotion ? 0.12 : 0.12 + Math.sin(seconds * 0.7) * 0.025)
      for (const mote of this.dustMotes) {
        const x = (mote.x + seconds * mote.speed) % (WIDTH + 40) - 20
        const y = (mote.y + seconds * mote.speed * 0.16) % HEIGHT
        this.weather.fillStyle(0xe4c099, 0.18).fillEllipse(x, y, mote.size * 2.8, mote.size)
      }
    } else if (this.debris && !this.reducedMotion) {
      for (let index = 0; index < 5; index += 1) {
        const phase = (seconds * 0.6 + index * 0.173) % 1
        if (phase > 0.12) continue
        const x = ((index * 229 + 113) % WIDTH) + phase * 400
        const y = 30 + index * 65 + phase * 300
        this.weather.lineStyle(1, 0xe2ddcb, (0.12 - phase) * 3).lineBetween(x, y, x - 9, y - 5)
      }
    }
  }

  update(_time, delta) {
    this.activityRenderer?.update(delta)
    if (this.activity?.running !== false) this.motionTime += Math.min(delta || 0, 80)
    if (!this.reducedMotion && (this.storm || this.debris)) this.drawWeather(this.motionTime)
  }
}

export default function MarsMap({ buildings, buildMode, storm, debris = false, network, sponsorId, surveyedFeatureIds, settlementName, siteName, selectedUid = null, activity = null, onPlace, onSelect }) {
  const hostRef = useRef(null)
  const gameRef = useRef(null)
  const sceneRef = useRef(null)
  const panModeRef = useRef(false)
  const [mapInfo, setMapInfo] = useState(null)
  const [mapView, setMapView] = useState(resetMapCamera)
  const [panMode, setPanMode] = useState(false)
  const [gridVisible, setGridVisible] = useState(false)
  const [networkVisible, setNetworkVisible] = useState(false)
  const [terrainStatus, setTerrainStatus] = useState({ loading: true, fallback: false, unavailable: false })
  const appearance = appearanceForSponsor(sponsorId)
  const callbacksRef = useRef({ onPlace: { current: null }, onSelect: { current: null }, onInfo: { current: null }, onCamera: { current: null }, onTerrain: { current: null } })
  callbacksRef.current.onPlace.current = (...args) => { if (!panModeRef.current && !sceneRef.current?.deferTouchAction('onPlace', args)) onPlace?.(...args) }
  callbacksRef.current.onSelect.current = (...args) => { if (!panModeRef.current && !sceneRef.current?.deferTouchAction('onSelect', args)) onSelect?.(...args) }
  callbacksRef.current.onCamera.current = setMapView
  callbacksRef.current.onTerrain.current = setTerrainStatus
  callbacksRef.current.onInfo.current = (info) => {
    if (!info || panModeRef.current) { setMapInfo(null); return }
    const point = worldToScreen(info, sceneRef.current?.mapView ?? resetMapCamera())
    if (point.x < 0 || point.y < 0 || point.x > WIDTH || point.y > HEIGHT) { setMapInfo(null); return }
    setMapInfo({ ...info, ...point })
  }
  const changePanMode = (next = !panModeRef.current) => {
    panModeRef.current = next
    setPanMode(next)
    sceneRef.current?.setPanMode(next)
  }
  const resetView = () => { changePanMode(false); sceneRef.current?.controlCamera('reset') }

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return undefined
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const scene = new ColonyScene(callbacksRef.current)
    Object.assign(scene, { buildings, network, buildMode, selectedUid, siteState: { sponsorId, surveyedFeatureIds }, storm, debris, activity, mapView, panMode, gridVisible, networkVisible, reducedMotion: motion?.matches ?? false })
    sceneRef.current = scene
    gameRef.current = new Phaser.Game({ type: Phaser.AUTO, parent: hostRef.current, width: WIDTH, height: HEIGHT, backgroundColor: '#7a321f', scene, input: { mouse: { preventDefaultWheel: false }, touch: { capture: false }, keyboard: { capture: [] } }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, pixelArt: false } })
    const onMotion = (event) => scene.setReducedMotion(event.matches)
    motion?.addEventListener?.('change', onMotion)
    return () => {
      motion?.removeEventListener?.('change', onMotion)
      gameRef.current?.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  useEffect(() => { sceneRef.current?.syncBuildings(buildings, network) }, [buildings, network])
  useEffect(() => { sceneRef.current?.setBuildMode(buildMode) }, [buildMode])
  useEffect(() => { sceneRef.current?.setSiteState({ sponsorId, surveyedFeatureIds }) }, [sponsorId, surveyedFeatureIds])
  useEffect(() => { sceneRef.current?.setSelection(selectedUid) }, [selectedUid])
  useEffect(() => { sceneRef.current?.setWeather(storm, debris) }, [storm, debris])
  useEffect(() => { sceneRef.current?.setActivity(activity) }, [activity])
  useEffect(() => { sceneRef.current?.setLayers(gridVisible, networkVisible) }, [gridVisible, networkVisible])

  return <div className="mars-map-panel" style={{ '--site-accent': appearance.accent }}>
    <MapViewControls view={mapView} panMode={panMode} gridVisible={gridVisible || Boolean(buildMode)} gridForced={Boolean(buildMode)} networkVisible={networkVisible} hasSelection={buildings.some((building) => building.uid === selectedUid)} appearance={appearance} terrainLoading={terrainStatus.loading} terrainFallback={terrainStatus.fallback} terrainUnavailable={terrainStatus.unavailable} onZoom={(delta) => sceneRef.current?.controlCamera('zoom', delta)} onReset={resetView} onFocus={() => sceneRef.current?.controlCamera('focus')} onPanMode={() => changePanMode()} onPan={(x, y) => sceneRef.current?.controlCamera('pan', x, y)} onGrid={() => setGridVisible((value) => !value)} onNetwork={() => setNetworkVisible((value) => !value)} />
    <div className={`mars-map ${buildMode && !panMode ? 'placing' : ''} ${storm || debris ? 'hazard-active' : ''}`} data-pan-mode={panMode}>
    <div ref={hostRef} className="phaser-host" aria-label="Interactive isometric Mars construction site. Use the precise grid below for keyboard commands." />
    {panMode ? <div className="placement-banner">Pan mode · placement paused</div> : buildMode ? <div className="placement-banner">{buildMode === 'ice' ? 'Choose confirmed ice lens' : 'Choose blue grid cell'}</div> : null}
    {mapInfo ? <MapTooltip info={mapInfo} hostRef={hostRef} /> : null}
    {storm || debris ? <div style={{ position: 'absolute', top: 12, right: 12, padding: '5px 8px', color: '#ffdbaf', background: '#321e18df', border: '1px solid #b7865b', pointerEvents: 'none', fontSize: 11 }}>{storm ? 'DUST FRONT · Reduced solar output' : 'DEBRIS FRONT · Inspect damaged structures'}</div> : null}
    <div className="terrain-legend" aria-label="Surveyed terrain features"><span><i className="unknown-swatch" />Survey prospect</span><span><i className="ice-swatch" />Confirmed ice</span><span><i className="solar-swatch" />Solar ridge</span></div>
    <div className="site-label"><span>{settlementName}</span><strong>{siteName} · GRID {network.online}/{network.total}</strong></div>
    </div>
  </div>
}
