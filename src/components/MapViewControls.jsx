import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Focus, Grid3X3, Hand, Minus, Network, Plus, RotateCcw } from 'lucide-react'
import { MAP_CAMERA } from '../rendering/mapCamera.js'

export default function MapViewControls({ view, panMode, gridVisible, gridForced, networkVisible, hasSelection, appearance, terrainLoading, terrainFallback, terrainUnavailable, onZoom, onReset, onFocus, onPanMode, onPan, onGrid, onNetwork }) {
  const keyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const actions = { '+': () => onZoom(MAP_CAMERA.zoomStep), '=': () => onZoom(MAP_CAMERA.zoomStep), '-': () => onZoom(-MAP_CAMERA.zoomStep), '0': onReset, f: () => hasSelection && onFocus(), p: onPanMode, ArrowLeft: () => onPan(-MAP_CAMERA.panStep, 0), ArrowRight: () => onPan(MAP_CAMERA.panStep, 0), ArrowUp: () => onPan(0, -MAP_CAMERA.panStep), ArrowDown: () => onPan(0, MAP_CAMERA.panStep) }
    const action = actions[event.key]
    if (action) { event.preventDefault(); event.stopPropagation(); action() }
  }
  const panDisabled = view.zoom <= MAP_CAMERA.minZoom
  return <div className="map-view-controls" role="toolbar" tabIndex={0} aria-label="Map view controls. Plus and minus zoom, arrows pan, zero resets, F focuses selection, P toggles drag pan. Shortcuts apply only while this toolbar has focus." onKeyDown={keyDown}>
    <div className="map-view-controls__site"><strong>{appearance.name}</strong><span>{appearance.landform}</span><small>{terrainLoading ? 'Loading landscape…' : terrainUnavailable ? 'Landscape unavailable · map tools still work' : terrainFallback ? 'Regional art unavailable · overview terrain shown' : 'Illustrative geology · surveyed yields use the marked grid'}</small></div>
    <div className="map-view-controls__group" aria-label="Magnification">
      <button type="button" className="map-view-controls__button" onClick={() => onZoom(-MAP_CAMERA.zoomStep)} disabled={view.zoom <= MAP_CAMERA.minZoom} aria-label="Zoom out"><Minus size={15} /></button>
      <output className="map-view-controls__status" aria-label="Map magnification">{Math.round(view.zoom * 100)}%</output>
      <button type="button" className="map-view-controls__button" onClick={() => onZoom(MAP_CAMERA.zoomStep)} disabled={view.zoom >= MAP_CAMERA.maxZoom} aria-label="Zoom in"><Plus size={15} /></button>
      <button type="button" className="map-view-controls__button" onClick={onReset} title="Reset to overview (0)"><RotateCcw size={15} /><span>Overview</span></button>
      <button type="button" className="map-view-controls__button" onClick={onFocus} disabled={!hasSelection} title="Focus selected structure (F)"><Focus size={15} /><span>Focus</span></button>
    </div>
    <div className="map-view-controls__group" aria-label="Panning">
      <button type="button" className={`map-view-controls__button ${panMode ? 'is-active' : ''}`} onClick={onPanMode} aria-pressed={panMode} title="Drag pan mode (P). Placement and selection are disabled while panning."><Hand size={15} /><span>{panMode ? 'Pan on' : 'Pan'}</span></button>
      <button type="button" className="map-view-controls__button map-view-controls__pan" onClick={() => onPan(-MAP_CAMERA.panStep, 0)} disabled={panDisabled} aria-label="Pan map left"><ArrowLeft size={15} /></button>
      <button type="button" className="map-view-controls__button map-view-controls__pan" onClick={() => onPan(0, -MAP_CAMERA.panStep)} disabled={panDisabled} aria-label="Pan map up"><ArrowUp size={15} /></button>
      <button type="button" className="map-view-controls__button map-view-controls__pan" onClick={() => onPan(0, MAP_CAMERA.panStep)} disabled={panDisabled} aria-label="Pan map down"><ArrowDown size={15} /></button>
      <button type="button" className="map-view-controls__button map-view-controls__pan" onClick={() => onPan(MAP_CAMERA.panStep, 0)} disabled={panDisabled} aria-label="Pan map right"><ArrowRight size={15} /></button>
    </div>
    <div className="map-view-controls__group" aria-label="Map layers">
      <button type="button" className={`map-view-controls__button ${gridVisible ? 'is-active' : ''}`} onClick={onGrid} aria-pressed={gridVisible} disabled={gridForced} title={gridForced ? 'Grid remains visible during placement' : 'Toggle the construction grid'}><Grid3X3 size={15} /><span>Grid</span></button>
      <button type="button" className={`map-view-controls__button ${networkVisible ? 'is-active' : ''}`} onClick={onNetwork} aria-pressed={networkVisible}><Network size={15} /><span>Utilities</span></button>
    </div>
    {panMode ? <span className="map-view-controls__hint" role="status">{panDisabled ? 'Zoom in, then drag to pan' : 'Drag to pan · placement and selection paused'}</span> : null}
  </div>
}
