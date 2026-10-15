import { CirclePause, FastForward, Play, StepForward, X } from 'lucide-react'
import { BUILDINGS, BUILD_MENU } from '../game/buildings.js'
import { buildingCost } from '../game/simulation.js'

export default function CommandControls({ state, onBuildMode, onSpeed, onStep }) {
  const locked = !state.manifestId || state.transferWindowPending || state.pendingEventId || state.pendingRivalEncounterId || state.pendingOperationalIncidentId || Boolean(state.outcome)
  return <section className="command-controls" aria-label="Construction and time controls">
    <div className="compact-build">
      <label htmlFor="compact-build-select">Construct</label>
      <select id="compact-build-select" value={state.buildMode ?? ''} disabled={locked} onChange={(event) => onBuildMode(event.target.value || null)}>
        <option value="">Select a structure…</option>
        {BUILD_MENU.map((type) => {
          const cost = buildingCost(state, type)
          return <option key={type} value={type} disabled={state.resources.parts < cost.parts || state.resources.cargo < cost.cargo}>{BUILDINGS[type].name} · {cost.parts} parts / {cost.cargo} t</option>
        })}
      </select>
      {state.buildMode ? <button aria-label="Cancel construction" onClick={() => onBuildMode(null)}><X /></button> : null}
    </div>
    <div className="time-controls" role="group" aria-label="Simulation time">
      <button aria-label="Pause simulation" aria-pressed={state.speed === 0} className={!state.speed ? 'active' : ''} disabled={locked} onClick={() => onSpeed(0)}><CirclePause /><span>Pause</span></button>
      <button aria-label="Advance one sol" disabled={locked} onClick={onStep}><StepForward /><span>+1 sol</span></button>
      <button aria-label="Run at learning speed, one sol per five seconds" aria-pressed={state.speed === 1} className={state.speed === 1 ? 'active' : ''} disabled={locked} onClick={() => onSpeed(1)}><Play /><span>1×</span></button>
      <button aria-label="Run at four times learning speed" aria-pressed={state.speed === 4} className={state.speed === 4 ? 'active' : ''} disabled={locked} onClick={() => onSpeed(4)}><FastForward /><span>4×</span></button>
      <button aria-label="Run at twelve times learning speed" aria-pressed={state.speed === 12} className={state.speed === 12 ? 'active' : ''} disabled={locked} onClick={() => onSpeed(12)}><FastForward /><span>12×</span></button>
    </div>
    <span className="time-status">{state.outcome ? 'Mission frozen' : state.speed ? `Running · ${Math.round(50 / state.speed) / 10} sec/sol` : 'Paused · resume deliberately'}</span>
  </section>
}
