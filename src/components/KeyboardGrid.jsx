import { useMemo, useRef, useState } from 'react'
import { BUILDINGS } from '../game/buildings.js'
import { knownSiteFeatures, siteFeatureAt } from '../game/siteFeatures.js'
import { canPlaceBuilding } from '../game/simulation.js'
import { constructionPreview } from '../ui/planning.js'

const signed = (value) => `${value >= 0 ? '+' : ''}${Math.round(value * 10) / 10}`

export default function KeyboardGrid({ state, onPlace, onSelect, onCancel }) {
  const [cell, setCell] = useState({ col: 4, row: 3 })
  const cells = useRef([])
  const preview = useMemo(() => state.buildMode ? constructionPreview(state, state.buildMode, cell.col, cell.row) : null, [state, cell])
  const selectedBuilding = state.buildings.find((item) => item.col === cell.col && item.row === cell.row)
  const known = knownSiteFeatures(state)
  const chooseCell = (col, row, focus = false) => {
    const next = { col: Math.max(0, Math.min(8, col)), row: Math.max(0, Math.min(5, row)) }
    setCell(next)
    if (focus) cells.current[next.row * 9 + next.col]?.focus()
  }
  return <details className="keyboard-grid-panel">
    <summary>Precise / keyboard construction grid</summary>
    <p id="keyboard-grid-help">Arrow keys choose a cell. Enter selects its preview; confirm construction below. Coordinates are column, row. Occupied cells can be inspected. Escape cancels construction.</p>
    <div className="keyboard-grid" role="grid" aria-label="Mars construction cells" aria-describedby="keyboard-grid-help" aria-rowcount={6} aria-colcount={9} onKeyDown={(event) => {
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (moves[event.key]) { event.preventDefault(); chooseCell(cell.col + moves[event.key][0], cell.row + moves[event.key][1], true) }
      if (event.key === 'Home') { event.preventDefault(); chooseCell(0, cell.row, true) }
      if (event.key === 'End') { event.preventDefault(); chooseCell(8, cell.row, true) }
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
    }}>
      {Array.from({ length: 6 }, (_, row) => <div role="row" key={row}>{Array.from({ length: 9 }, (_, col) => {
        const building = state.buildings.find((item) => item.col === col && item.row === row)
        const feature = known.find((item) => item.col === col && item.row === row)
        const prospect = siteFeatureAt(state, 'ice', col, row, false)
        const availability = state.buildMode ? canPlaceBuilding(state, state.buildMode, col, row) : null
        const status = building ? BUILDINGS[building.type].name : feature ? feature.title : prospect ? 'Unconfirmed survey prospect' : 'Open terrain'
        return <div role="gridcell" aria-selected={cell.col === col && cell.row === row} key={col}><button
          ref={(node) => { cells.current[row * 9 + col] = node }} tabIndex={cell.col === col && cell.row === row ? 0 : -1}
          className={`${building ? 'occupied' : feature?.kind ?? ''} ${availability?.ok ? 'valid' : ''}`}
          onFocus={() => chooseCell(col, row)} onClick={() => chooseCell(col, row)}
          aria-label={`Column ${col + 1}, row ${row + 1}: ${status}${availability && !availability.ok ? `. ${availability.reason}` : ''}`}
        >{col + 1},{row + 1}<small>{building ? building.construction ? 'Site' : 'Built' : feature?.kind === 'ice' ? 'Ice' : feature?.kind === 'solar' ? 'Sun' : prospect ? '?' : '·'}</small></button></div>
      })}</div>)}
    </div>
    <div className="cell-preview" aria-live="polite">
      <strong>Column {cell.col + 1}, row {cell.row + 1}</strong>
      {selectedBuilding ? <><span>{BUILDINGS[selectedBuilding.type].name} · {selectedBuilding.integrity}% integrity</span><button onClick={() => onSelect(selectedBuilding.uid)}>Inspect structure</button></> : state.buildMode ? <>
        <span>{BUILDINGS[state.buildMode].name} · {preview?.cost.parts} parts / {preview?.cost.cargo} t</span>
        {preview?.ok ? <><span>During assembly: {preview.construction.capacity.toFixed(2)} shared work/sol · {preview.construction.nominalSols ?? 'waiting for crew/rovers'} nominal sols for the queue. Supplies are paid now.</span><span>After all queued sites commission: {signed(preview.after.powerCapacity - preview.after.powerDemand)} kW · dust front {signed(preview.storm.powerCapacity - preview.storm.powerDemand)} kW</span><span>Water {signed(preview.after.waterNet)} L/sol · oxygen {signed(preview.after.oxygenNet)} L/sol · food {signed(preview.after.foodNet)} kg/sol · parts {signed(preview.after.partsNet)}/sol</span><span>Staffing: engineering {Math.round(preview.after.labor.ratios.engineering * 100)}% · operations {Math.round(preview.after.labor.ratios.operations * 100)}% · medical {Math.round(preview.after.labor.ratios.support * 100)}%</span></> : <span className="negative">{preview?.reason}</span>}
        <button disabled={!preview?.ok} onClick={() => onPlace(state.buildMode, cell.col, cell.row)}>Confirm {BUILDINGS[state.buildMode].name}</button>
      </> : <span>Select a structure in Construct to preview placement, or choose an occupied cell to inspect it.</span>}
    </div>
  </details>
}
