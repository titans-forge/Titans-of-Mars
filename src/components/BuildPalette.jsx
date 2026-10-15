import { Hammer } from 'lucide-react'
import { BUILDINGS, BUILD_MENU } from '../game/buildings.js'
import { buildingCost } from '../game/simulation.js'

function SpriteThumb({ atlas, frame }) {
  const expansion = atlas === 'building-expansion'
  const columns = expansion ? 3 : 4
  const rows = expansion ? 1 : 2
  const col = frame % columns
  const row = Math.floor(frame / columns)
  const x = columns === 1 ? 0 : col * (100 / (columns - 1))
  const y = rows === 1 ? 0 : row * (100 / (rows - 1))
  return <span className="sprite-thumb" style={{ backgroundImage: `url('./assets/${expansion ? 'building-atlas-expansion.png' : 'building-atlas.png'}')`, backgroundPosition: `${x}% ${y}%`, backgroundSize: `${columns * 100}% ${rows * 100}%` }} />
}

export default function BuildPalette({ state, onBuildMode }) {
  return (
    <footer className="build-dock">
      <div className="dock-title"><Hammer /><strong>Build</strong><span>Select a structure, then choose a surveyed cell.</span></div>
      <div className="build-list">
        {BUILD_MENU.map((type) => {
          const building = BUILDINGS[type]
          const cost = buildingCost(state, type)
          const discounted = cost.parts !== building.cost.parts || cost.cargo !== building.cost.cargo
          const affordable = state.resources.parts >= cost.parts && state.resources.cargo >= cost.cargo
          const manifestReady = Boolean(state.manifestId) && !state.transferWindowPending && !state.pendingEventId && !state.pendingRivalEncounterId && !state.pendingOperationalIncidentId
          return (
            <button
              className={state.buildMode === type ? 'selected' : ''}
              disabled={!manifestReady || !affordable || Boolean(state.outcome)}
              key={type}
              onClick={() => onBuildMode(state.buildMode === type ? null : type)}
              title={!manifestReady ? 'Authorize a transfer manifest first' : affordable ? type === 'ice' ? 'Build on a surveyed ice lens' : `Build ${building.name}` : `Need ${cost.parts} parts and ${cost.cargo} t cargo`}
            >
              <SpriteThumb atlas={building.atlas} frame={building.frame} />
              <span><strong>{building.name}</strong><small className={discounted ? 'discounted-cost' : ''}>{cost.parts} parts · {cost.cargo} t{discounted ? ' · reduced' : ''}</small></span>
            </button>
          )
        })}
      </div>

    </footer>
  )
}
