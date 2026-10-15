// Colony activity is a view of assigned simulation jobs. This module owns only
// presentation time: it never awards resources, work, or survey discoveries.
import { constructionStage } from '../game/construction.js'
export { constructionStage } from '../game/construction.js'

const ATLAS = 'colony-activity'
const CARDINALS = [[1, 0], [0, 1], [-1, 0], [0, -1]]
const STOPPED = /idle|unassigned|offline|unavailable|blocked|shelter|parked|standby/i
const keyOf = ({ col, row }) => `${col}:${row}`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const hash = (value) => [...String(value)].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) >>> 0, 0)

export function constructionProgress(building) {
  if (!building.construction) return 1
  const { requiredWork, completedWork } = building.construction
  return clamp(Number(completedWork || 0) / Math.max(0.001, Number(requiredWork || 1)), 0, 1)
}

export function preloadColonyActivity(scene) {
  scene.load.image(ATLAS, './assets/colony-activity-atlas.png')
}

function polygon(graphics, points, fill, alpha = 1, line = null) {
  graphics.fillStyle(fill, alpha).fillPoints(points, true)
  if (line !== null) graphics.lineStyle(1, line, alpha).strokePoints(points, true)
}

// Construction remains legible before a building's finished roof is present.
// The original building art is revealed from the ground upward during assembly.
export function drawConstructionSite(entry, building, point, scene) {
  const progress = constructionProgress(building)
  const pending = progress < 1
  entry.sprite.setCrop()
  if (!pending && !entry.site) return
  if (!entry.site) {
    entry.site = scene.add.graphics()
    entry.siteFront = scene.add.graphics()
    entry.siteLabel = scene.add.text(0, 0, '', { fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#f2d6a6', backgroundColor: '#39291edb', padding: { x: 4, y: 2 } }).setOrigin(0.5, 0)
    entry.siteZone = scene.add.zone(point.x, point.y + 5, 78, 46).setInteractive({ useHandCursor: true })
    const uid = building.uid
    entry.siteZone.on('pointerover', () => { scene.hoveredUid = uid; scene.hoverSignature = ''; const pointer = scene.input.activePointer; scene.drawHover(pointer.worldX, pointer.worldY) })
    entry.siteZone.on('pointerout', () => { scene.hoveredUid = null; scene.hoverSignature = ''; scene.callbacks.onInfo.current(null) })
    entry.siteZone.on('pointerdown', (_pointer, _localX, _localY, event) => {
      event?.stopPropagation()
      if (scene.buildMode) scene.callbacks.onPlace.current(scene.buildMode, entry.placed.col, entry.placed.row)
      else { scene.callbacks.onSelect.current(uid); scene.hoveredUid = uid; const pointer = scene.input.activePointer; scene.drawHover(pointer.worldX, pointer.worldY) }
    })
  }
  let g = entry.site
  g.clear().setPosition(point.x, point.y).setDepth(point.y - 0.5)
  entry.siteFront.clear().setPosition(point.x, point.y).setDepth(point.y + 1)
  entry.siteZone.setVisible(pending).setPosition(point.x, point.y + 5).setDepth(point.y + 0.5)
  entry.siteLabel.setVisible(pending).setPosition(point.x, point.y + 37).setDepth(point.y + 2)
  if (!pending) { g.setVisible(false); entry.siteFront.setVisible(false); return }
  g.setVisible(true)
  entry.siteFront.setVisible(true)
  const stage = constructionStage(building)
  entry.siteLabel.setText(`${stage.toUpperCase()}  ${Math.floor(progress * 100)}%`)
  // A slab, low retaining edge, anchor plates and actual delivered cargo.
  polygon(g, [{ x: -41, y: 6 }, { x: 0, y: -15 }, { x: 42, y: 6 }, { x: 0, y: 28 }], 0x44372e, 0.46)
  polygon(g, [{ x: -38, y: 2 }, { x: 0, y: -17 }, { x: 38, y: 2 }, { x: 0, y: 22 }], progress < 0.2 ? 0x92735b : 0xaaa08b, 0.96, 0xb9a78d)
  polygon(g, [{ x: -38, y: 2 }, { x: 0, y: 22 }, { x: 0, y: 26 }, { x: -38, y: 6 }], 0x706b5e)
  polygon(g, [{ x: 0, y: 22 }, { x: 38, y: 2 }, { x: 38, y: 6 }, { x: 0, y: 26 }], 0x837e6d)
  for (const [x, y] of [[-28, 2], [0, -11], [28, 2], [0, 17]]) {
    g.fillStyle(0x454d4a, 1).fillEllipse(x, y, 5, 3)
    g.fillStyle(0xbbb4a2, 1).fillCircle(x, y - 1, 1)
  }
  if (progress < 0.85) {
    for (let index = 0; index < 3; index += 1) {
      const x = -36 + index * 7, y = 20 + index * 3.5
      polygon(g, [{ x, y }, { x: x + 8, y: y - 4 }, { x: x + 15, y }, { x: x + 7, y: y + 4 }], 0xb8ae91, 1, 0x4c5148)
      polygon(g, [{ x, y }, { x: x + 7, y: y + 4 }, { x: x + 7, y: y + 9 }, { x, y: y + 5 }], 0x716c5b)
      polygon(g, [{ x: x + 7, y: y + 4 }, { x: x + 15, y }, { x: x + 15, y: y + 5 }, { x: x + 7, y: y + 9 }], 0x8d8b73)
      g.lineStyle(1, 0x4d554f, 0.8).lineBetween(x + 4, y + 2, x + 4, y + 7)
    }
  }
  const assembly = clamp((progress - 0.36) / 0.49, 0, 1)
  entry.sprite.setVisible(assembly > 0)
  if (assembly > 0 && assembly < 1) {
    const frame = entry.sprite.frame
    const reveal = 0.25 + assembly * 0.75
    entry.sprite.setCrop(0, frame.realHeight * (1 - reveal), frame.realWidth, frame.realHeight * reveal)
    entry.sprite.setAlpha(0.9).setTint(0xddd3ba)
  } else if (assembly >= 1) entry.sprite.setAlpha(0.96).setTint(0xf0ddbb)
  // Front scaffold is constructed from narrow grounded uprights and crossbars.
  g = entry.siteFront
  if (progress >= 0.2 && progress < 0.85) {
    const height = 22 + clamp((progress - 0.2) / 0.3, 0, 1) * 27
    for (const [x, y] of [[-31, 8], [0, 24], [31, 8]]) {
      g.fillStyle(0x3b3a32, 0.4).fillEllipse(x + 1, y + 1, 8, 4)
      g.lineStyle(2, 0xb4b3a1, 1).lineBetween(x, y, x, y - height)
      g.lineStyle(1, 0x554d3e, 1).lineBetween(x + 2, y, x + 2, y - height)
    }
    for (const lift of [0, height * 0.5, height]) {
      g.lineStyle(2, 0x999b89, 1).lineBetween(-31, 8 - lift, 0, 24 - lift).lineBetween(0, 24 - lift, 31, 8 - lift)
    }
    g.lineStyle(1, 0xaeb0a0, 0.95).lineBetween(-31, 8, 0, 24 - height).lineBetween(0, 24, 31, 8 - height)
    g.lineStyle(2, 0xe3a14b, 0.9).lineBetween(-31, 8 - height, 0, 24 - height).lineBetween(0, 24 - height, 31, 8 - height)
  }
  if (progress >= 0.85) {
    // A test cabinet and a lead to the completed service connection.
    g.fillStyle(0x51605a, 1).fillRect(31, 9, 7, 10)
    g.fillStyle(0xe8b65a, 1).fillRect(33, 11, 3, 2)
    g.lineStyle(1, 0x2d3937, 1).lineBetween(34, 19, 25, 24).lineBetween(25, 24, 15, 20)
  }
  g.fillStyle(0x282b25, 0.95).fillRoundedRect(-26, 29, 52, 4, 1)
  g.fillStyle(0xdfb46b, 1).fillRoundedRect(-26, 29, Math.max(2, 52 * progress), 4, 1)
}

function closestFree(cell, occupied, cols, rows, toward = null) {
  const valid = ({ col, row }) => col >= 0 && row >= 0 && col < cols && row < rows && !occupied.has(keyOf({ col, row }))
  if (valid(cell)) return cell
  const queue = [cell], seen = new Set([keyOf(cell)])
  while (queue.length) {
    const current = queue.shift()
    const options = CARDINALS.map(([dc, dr]) => ({ col: current.col + dc, row: current.row + dr }))
    if (toward) options.sort((a, b) => Math.hypot(a.col - toward.col, a.row - toward.row) - Math.hypot(b.col - toward.col, b.row - toward.row))
    for (const next of options) {
      if (valid(next)) return next
      if (next.col < 0 || next.row < 0 || next.col >= cols || next.row >= rows || seen.has(keyOf(next))) continue
      seen.add(keyOf(next)); queue.push(next)
    }
  }
  return null
}

function connectCells(from, to, occupied, cols, rows) {
  const queue = [from], previous = new Map([[keyOf(from), null]])
  while (queue.length) {
    const cell = queue.shift()
    if (keyOf(cell) === keyOf(to)) {
      const path = [cell]
      let cursor = previous.get(keyOf(cell))
      while (cursor) { path.unshift(cursor); cursor = previous.get(keyOf(cursor)) }
      return path
    }
    const neighbors = CARDINALS.map(([dc, dr]) => ({ col: cell.col + dc, row: cell.row + dr })).sort((a, b) => Math.abs(a.col - to.col) + Math.abs(a.row - to.row) - Math.abs(b.col - to.col) - Math.abs(b.row - to.row))
    for (const next of neighbors) {
      if (next.col < 0 || next.row < 0 || next.col >= cols || next.row >= rows || occupied.has(keyOf(next)) || previous.has(keyOf(next))) continue
      previous.set(keyOf(next), cell); queue.push(next)
    }
  }
  return []
}

function routeCells(descriptor, occupied, cols, rows) {
  const supplied = (descriptor.path ?? []).filter((cell) => Number.isFinite(cell?.col) && Number.isFinite(cell?.row)).map((cell) => ({ col: Math.round(cell.col), row: Math.round(cell.row) }))
  if (!supplied.length && descriptor.workCell) supplied.push(descriptor.workCell)
  const route = []
  for (let index = 0; index < supplied.length; index += 1) {
    const safe = closestFree(supplied[index], occupied, cols, rows, supplied[index + 1] ?? supplied[index - 1])
    if (!safe) continue
    if (!route.length) route.push(safe)
    else if (keyOf(route.at(-1)) !== keyOf(safe)) {
      const connected = connectCells(route.at(-1), safe, occupied, cols, rows)
      if (connected.length) route.push(...connected.slice(1))
    }
  }
  return route
}

function taskOf(descriptor) {
  const text = `${descriptor.task ?? ''} ${descriptor.route ?? ''} ${descriptor.label ?? ''}`.toLowerCase()
  return /survey|sample|prospect/.test(text) ? 'survey' : /water|ice|haul/.test(text) ? 'water' : /construct|build|assembl|commission/.test(text) ? 'construction' : /repair/.test(text) ? 'repair' : /maint|inspection|engineering/.test(text) ? 'inspection' : 'operations'
}

function facingOf(dx, dy, previous = 0) {
  if (Math.abs(dx) + Math.abs(dy) < 0.01) return previous
  return dx >= 0 ? dy >= 0 ? 0 : 3 : dy >= 0 ? 1 : 2
}

export class ColonyActivity {
  constructor(scene, { cellToPoint, cols, rows }) {
    this.scene = scene
    this.cellToPoint = cellToPoint
    this.cols = cols
    this.rows = rows
    this.actors = new Map()
    this.running = false
    this.reducedMotion = false
    this.clock = 0
    this.activity = null
    this.hasAtlas = scene.textures.exists(ATLAS)
    if (this.hasAtlas) {
      const texture = scene.textures.get(ATLAS), source = texture.getSourceImage()
      // The supplied 1254px sheet has alternating 313/314px cells; explicit
      // boundaries avoid cumulative clipping from a fixed-width spritesheet.
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) {
        const x = Math.floor(col * source.width / 4), y = Math.floor(row * source.height / 4)
        const width = Math.floor((col + 1) * source.width / 4) - x, height = Math.floor((row + 1) * source.height / 4) - y
        if (!texture.has(row * 4 + col)) texture.add(row * 4 + col, 0, x, y, width, height)
      }
    }
  }

  sync(activity, buildings) {
    this.activity = activity ?? { rovers: [], crew: [], running: false }
    this.running = Boolean(activity?.running)
    const occupied = new Set(buildings.map(keyOf))
    const occupiedSignature = [...occupied].sort().join('|')
    const seen = new Set()
    for (const [kind, descriptors] of [['rover', activity?.rovers ?? []], ['crew', activity?.crew ?? []]]) {
      for (const descriptor of descriptors) {
        const id = `${kind}:${descriptor.id}`
        seen.add(id)
        let actor = this.actors.get(id)
        const created = !actor
        const cells = routeCells(descriptor, occupied, this.cols, this.rows)
        if (!cells.length) { if (actor) actor.container.setVisible(false); continue }
        if (!actor) {
          actor = this.createActor(id, kind, descriptor)
          const point = this.cellToPoint(cells[0].col, cells[0].row)
          actor.x = point.x; actor.y = point.y + 9
          this.actors.set(id, actor)
        }
        const sheltered = kind === 'crew' && /shelter/i.test(descriptor.status ?? '')
        actor.container.setVisible(!sheltered)
        actor.descriptor = descriptor
        actor.task = taskOf(descriptor)
        actor.holdAtEnd = cells.length === 1
        const signature = cells.map(keyOf).join('|')
        if (signature !== actor.routeSignature || (actor.connectorBlocked && actor.occupiedSignature !== occupiedSignature)) {
          const points = cells.map((cell) => this.actorPoint(actor, cell))
          actor.connectorBlocked = false
          // A route can change after commissioning or reassignment; retain the
          // same node and start from its current position rather than respawn.
          if (!sheltered && actor.routeSignature && Math.hypot(points[0].x - actor.x, points[0].y - actor.y) > 1) {
            const nearest = closestFree(this.pointToCell(actor.x, actor.y - 9), occupied, this.cols, this.rows, cells[0])
            const connector = nearest ? connectCells(nearest, cells[0], occupied, this.cols, this.rows) : []
            if (connector.length) {
              const approach = connector.slice(0, -1).map((cell) => this.actorPoint(actor, cell))
              points.unshift({ x: actor.x, y: actor.y }, ...approach)
            } else {
              // A newly placed structure may close a corridor. Hold the
              // existing node until a free route exists, never cross a roof.
              points.splice(0, points.length, { x: actor.x, y: actor.y })
              actor.connectorBlocked = true
            }
          }
          actor.points = points
          actor.routeSignature = signature
          actor.occupiedSignature = occupiedSignature
          actor.index = 0; actor.direction = 1; actor.dwell = 0.25 + (hash(id) % 8) / 10
        }
        actor.active = !actor.connectorBlocked && !STOPPED.test(descriptor.status ?? '') && actor.points.length > 1 && (!actor.holdAtEnd || actor.index < actor.points.length - 1)
        if (created) this.seedActor(actor)
        if (sheltered) {
          actor.x = actor.points[0].x; actor.y = actor.points[0].y
          actor.index = 0; actor.direction = 1
        }
        this.drawActor(actor, actor.moving && !this.reducedMotion)
      }
    }
    for (const [id, actor] of this.actors) if (!seen.has(id)) { actor.container.destroy(true); this.actors.delete(id) }
  }

  pointToCell(x, y) {
    const origin = this.cellToPoint(0, 0), diagonal = this.cellToPoint(1, 0)
    const dx = (x - origin.x) / (diagonal.x - origin.x), dy = (y - origin.y) / (diagonal.y - origin.y)
    return { col: clamp(Math.round((dx + dy) / 2), 0, this.cols - 1), row: clamp(Math.round((dy - dx) / 2), 0, this.rows - 1) }
  }

  actorPoint(actor, cell) {
    const point = this.cellToPoint(cell.col, cell.row)
    // EVA uses a narrow pedestrian lane within the same free cells; a worker
    // at a loading stop stays visible beside, rather than under, the rover.
    return { x: point.x + (actor.kind === 'crew' ? hash(actor.id) % 2 ? -8 : 8 : 0), y: point.y + (actor.kind === 'crew' ? 13 : 9) }
  }

  seedActor(actor) {
    const points = actor.points, seed = hash(actor.id), last = points.length - 1
    actor.x = points[0].x; actor.y = points[0].y
    if (!actor.active || last < 1) return
    // A colony opened while paused still shows the current assignment at work.
    // This phase is chosen once per new ID; ordinary syncs never reseed actors.
    if (actor.kind === 'crew' || seed % 4 === 0) {
      actor.index = last; actor.direction = -1
      actor.x = points[last].x; actor.y = points[last].y
      actor.facing = facingOf(points[last].x - points[last - 1].x, points[last].y - points[last - 1].y, actor.facing)
      actor.dwell = actor.kind === 'crew' ? 5 + seed % 7 : actor.task === 'survey' ? 6 : 4
      return
    }
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y))
    let remaining = lengths.reduce((total, length) => total + length, 0) * (0.28 + ((seed >>> 4) % 63) / 100)
    for (let index = 0; index < lengths.length; index += 1) {
      if (remaining > lengths[index] && index < lengths.length - 1) { remaining -= lengths[index]; continue }
      const fraction = lengths[index] ? remaining / lengths[index] : 0
      actor.x = points[index].x + (points[index + 1].x - points[index].x) * fraction
      actor.y = points[index].y + (points[index + 1].y - points[index].y) * fraction
      actor.direction = seed % 2 ? 1 : -1
      actor.index = actor.direction === 1 ? index : index + 1
      const target = points[actor.index + actor.direction]
      actor.facing = facingOf(target.x - actor.x, target.y - actor.y, actor.facing)
      actor.dwell = 0
      actor.distance += remaining
      return
    }
  }

  createActor(id, kind, descriptor) {
    const container = this.scene.add.container(0, 0)
    const shadow = this.scene.add.ellipse(1, 0.5, kind === 'rover' ? 34 : 9, kind === 'rover' ? 12 : 4, 0x261b16, kind === 'rover' ? 0.29 : 0.35)
    const detail = this.scene.add.graphics()
    const body = this.hasAtlas ? this.scene.add.sprite(0, 0, ATLAS, kind === 'rover' ? 0 : 4).setOrigin(0.5, kind === 'rover' ? 0.865 : 0.89).setDisplaySize(kind === 'rover' ? 64 : 33, kind === 'rover' ? 64 : 33) : this.scene.add.graphics()
    container.add([shadow, detail, body])
    const hitWidth = kind === 'rover' ? 51 : 18, hitHeight = kind === 'rover' ? 34 : 28
    container.setSize(hitWidth, hitHeight).setInteractive({ useHandCursor: false })
    container.on('pointerover', () => {
      const actor = this.actors.get(id)
      if (!actor || this.scene.buildMode) return
      const status = actor.descriptor.status ?? 'Assigned'
      this.scene.callbacks.onInfo.current({ title: actor.descriptor.label ?? (kind === 'rover' ? 'Assigned rover' : 'EVA team'), detail: `${status} · ${actor.task === 'water' ? 'Ice haul: load, transit and delivery' : actor.task === 'survey' ? 'Ground survey: transit, stop and sample' : actor.task === 'construction' ? 'Construction shift: transit and site work' : actor.task === 'repair' ? 'Authorized repair: transit and site work' : actor.task === 'inspection' ? 'Inspection shift: transit and instrument checks' : 'Assigned colony operations'}`, x: actor.x, y: actor.y })
    })
    container.on('pointerout', () => this.scene.callbacks.onInfo.current(null))
    return { id, kind, descriptor, container, shadow, body, detail, points: [], routeSignature: '', x: 0, y: 0, index: 0, direction: 1, facing: hash(id) % 4, dwell: 0, distance: hash(id) % 7, moving: false, task: 'operations' }
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value)
    for (const actor of this.actors.values()) this.drawActor(actor, false)
  }

  update(delta) {
    if (!this.running || this.reducedMotion) return
    const dt = clamp(Number(delta) || 0, 0, 80) / 1000
    this.clock += dt
    for (const actor of this.actors.values()) {
      let moving = false
      if (actor.active && actor.points.length > 1) {
        if (actor.dwell > 0) actor.dwell = Math.max(0, actor.dwell - dt)
        else {
          const next = actor.points[actor.index + actor.direction]
          if (next) {
            const dx = next.x - actor.x, dy = next.y - actor.y, remaining = Math.hypot(dx, dy)
            // Visual travel is independent of simulation fast-forward. Values
            // are screen pixels/second at the map's native 1200px width.
            const speed = actor.kind === 'rover' ? 15 : 8.5
            const step = Math.min(remaining, speed * dt)
            if (remaining > 0.001) {
              actor.x += dx / remaining * step; actor.y += dy / remaining * step
              actor.facing = facingOf(dx, dy, actor.facing)
              actor.distance += step; moving = step > 0
            }
            if (remaining <= step + 0.001) {
              actor.index += actor.direction
              if (actor.holdAtEnd && actor.index === actor.points.length - 1) {
                actor.active = false; actor.direction = 0; actor.dwell = 0
              } else if (actor.index === actor.points.length - 1 || actor.index === 0) {
                actor.direction *= -1
                actor.dwell = actor.index === 0 ? actor.task === 'water' ? 5 : 3 : actor.task === 'survey' ? 8 : actor.task === 'water' ? 6 : actor.kind === 'crew' ? 12 : 7
              }
            }
          }
        }
      }
      this.drawActor(actor, moving)
    }
  }

  drawActor(actor, moving) {
    actor.moving = moving
    const workPoint = actor.points.at(-1)
    const atWork = !moving && !actor.connectorBlocked && actor.index === actor.points.length - 1 && workPoint && Math.hypot(workPoint.x - actor.x, workPoint.y - actor.y) < 1 && !STOPPED.test(actor.descriptor.status ?? '')
    const targetCell = actor.descriptor.targetCell ?? actor.descriptor.workCell
    if (atWork && targetCell) {
      const work = this.cellToPoint(targetCell.col, targetCell.row)
      if (Math.hypot(work.x - actor.x, work.y - actor.y) > 12) actor.facing = facingOf(work.x - actor.x, work.y - actor.y, actor.facing)
    }
    actor.container.setPosition(actor.x, actor.y).setDepth(actor.y + 1)
    actor.shadow.setAlpha(actor.kind === 'rover' ? 0.29 : 0.35)
    actor.detail.clear()
    if (this.hasAtlas) {
      const walkingPhase = Math.floor(actor.distance / 3.8) % 2
      const row = actor.kind === 'rover' ? 0 : atWork ? 3 : moving && !this.reducedMotion ? 1 + walkingPhase : 1
      const column = actor.kind === 'rover' ? [1, 0, 2, 2][actor.facing] : actor.facing === 3 ? 2 : actor.facing
      const flipped = actor.kind === 'rover' ? actor.facing === 2 : actor.facing === 3
      actor.body.setFrame(row * 4 + column).setFlipX(flipped).setOrigin(0.5, actor.kind === 'rover' ? 0.865 : row === 3 ? 0.83 : 0.89)
      actor.body.y = actor.kind === 'crew' && moving ? -(Math.sin((actor.distance / 3.8) * Math.PI) ** 2) * 0.32 : 0
    } else this.drawFallback(actor, moving)
    if (actor.kind === 'rover' && atWork && actor.task === 'survey') {
      // The sampling arm is only present during the assigned survey stop.
      const sign = actor.facing === 0 || actor.facing === 3 ? 1 : -1
      actor.detail.lineStyle(1.2, 0xb7b6a7, 1).lineBetween(8 * sign, -10, 19 * sign, -3).lineBetween(19 * sign, -3, 18 * sign, 1)
      actor.detail.fillStyle(0x4b5147, 1).fillEllipse(18 * sign, 1, 5, 2)
    }
    if (actor.kind === 'crew' && atWork && ['repair', 'construction'].includes(actor.task)) {
      actor.detail.lineStyle(1, 0x727b70, 0.85).lineBetween(3, -6, 8, -8)
      actor.detail.fillStyle(0xcba65a, 0.9).fillRect(7, -10, 3, 3)
    }
  }

  drawFallback(actor, moving) {
    // Small, restrained vector fallback if an optional art asset cannot load.
    const g = actor.body
    g.clear()
    const right = actor.facing === 0 || actor.facing === 3
    if (actor.kind === 'rover') {
      const wheel = actor.distance * 0.35
      for (const [x, y] of [[-13, 0], [0, 6], [13, 0]]) {
        g.fillStyle(0x242b29, 1).fillEllipse(x, y - 2, 8, 9)
        g.lineStyle(1, 0x73796d, 1).strokeEllipse(x, y - 2, 5, 6)
        g.lineBetween(x + Math.cos(wheel) * 2, y - 2 + Math.sin(wheel) * 2, x - Math.cos(wheel) * 2, y - 2 - Math.sin(wheel) * 2)
      }
      polygon(g, [{ x: -17, y: -10 }, { x: 1, y: -19 }, { x: 18, y: -10 }, { x: 0, y: -1 }], 0xc9c4aa, 1, 0x6b776e)
      polygon(g, [{ x: -17, y: -10 }, { x: 0, y: -1 }, { x: 0, y: 4 }, { x: -17, y: -5 }], 0x89958b)
      polygon(g, [{ x: 0, y: -1 }, { x: 18, y: -10 }, { x: 18, y: -5 }, { x: 0, y: 4 }], 0xa0aa9a)
      g.fillStyle(0x45534f, 1).fillRect(-7, -16, 13, 6)
      g.lineStyle(1, 0xc2c5b0, 1).lineBetween(right ? 8 : -8, -13, right ? 8 : -8, -25)
      g.fillStyle(0xa3b6b0, 1).fillEllipse(right ? 8 : -8, -25, 5, 3)
    } else {
      const step = moving ? Math.sin(actor.distance / 3.8 * Math.PI) * 2 : 0
      g.lineStyle(2.3, 0xb9b4a1, 1).lineBetween(-1, -6, -2 - step, -1).lineBetween(2, -6, 3 + step, -1)
      g.fillStyle(0x343b37, 1).fillEllipse(-2 - step, 0, 4, 2).fillEllipse(3 + step, 0, 4, 2)
      g.fillStyle(0x9d9b88, 1).fillRoundedRect(right ? -4 : 0, -15, 4, 9, 1)
      g.fillStyle(0xd3cfb9, 1).fillRoundedRect(-3, -15, 7, 10, 2)
      g.lineStyle(1.5, 0xb4ad96, 1).lineBetween(right ? 3 : -2, -12, right ? 6 : -5, -7)
      g.fillStyle(0xdad7c3, 1).fillCircle(0, -18, 4)
      g.fillStyle(0x343e3d, 1).fillEllipse(right ? 1 : -1, -18, 5, 3)
      g.fillStyle(0xd59b5c, 1).fillRect(-3, -10, 6, 1.5)
    }
  }

  destroy() {
    for (const actor of this.actors.values()) actor.container.destroy(true)
    this.actors.clear()
  }
}
