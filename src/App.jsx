import { colonyActivity } from './game/colonyActivity.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import BuildPalette from './components/BuildPalette.jsx'
import CommandControls from './components/CommandControls.jsx'
import CrewRoster from './components/CrewRoster.jsx'
import GuideModal from './components/GuideModal.jsx'
import Inspector from './components/Inspector.jsx'
import KeyboardGrid from './components/KeyboardGrid.jsx'
import ManifestCouncil from './components/ManifestCouncil.jsx'
import MarsFieldGuide from './components/MarsFieldGuide.jsx'
import MarsMap from './components/MarsMap.jsx'
import MissionRail from './components/MissionRail.jsx'
import ModalLayer from './components/ModalLayer.jsx'
import OutcomeOverlay from './components/OutcomeOverlay.jsx'
import OperationalIncidentCouncil from './components/OperationalIncidentCouncil.jsx'
import RoverDispatch from './components/RoverDispatch.jsx'
import RivalEncounterCouncil from './components/RivalEncounterCouncil.jsx'
import SaveManagement from './components/SaveManagement.jsx'
import SecondWindowCouncil from './components/SecondWindowCouncil.jsx'
import SponsorCouncil from './components/SponsorCouncil.jsx'
import SponsorEventCouncil from './components/SponsorEventCouncil.jsx'
import SoundtrackControl from './components/SoundtrackControl.jsx'
import TopBar from './components/TopBar.jsx'
import { createInitialState } from './game/initialState.js'
import { createSavePersistence } from './game/persistence.js'
import { LEARNING_SOL_MS } from './ui/planning.js'
import { advanceSol, cancelConstruction, applyFollowOnManifest, applyManifest, applyOperationalIncidentChoice, applyRivalEncounterChoice, applySponsorEventChoice, colonyStats, missionObjectives, placeBuilding, repairBuilding, restoreState, updateCrewLead, updateCrossTraining, updateRoverAssignment } from './game/simulation.js'

const persistence = createSavePersistence({ storage: () => window.localStorage, key: 'titans-of-mars-first-city-v1', restore: restoreState })

export default function App() {
  const [loaded] = useState(() => persistence.load())
  const [state, setState] = useState(() => loaded.state ?? createInitialState())
  const [saveStatus, setSaveStatus] = useState(loaded)
  const [saveEnabled, setSaveEnabled] = useState(loaded.status !== 'corrupt')
  const [panel, setPanel] = useState(loaded.status === 'corrupt' ? 'saves' : null)
  const [soundtrackOpen, setSoundtrackOpen] = useState(false)
  const [inspectingOutcome, setInspectingOutcome] = useState(false)
  const [notice, setNotice] = useState('')
  const commandRef = useRef(null)
  const stats = useMemo(() => colonyStats(state), [state])
  const objectives = useMemo(() => missionObjectives(state), [state])
  const optionalOpen = Boolean(panel)
  const running = Boolean(state.manifestId && !state.transferWindowPending && !state.pendingEventId && !state.pendingRivalEncounterId && !state.pendingOperationalIncidentId && state.speed && !state.outcome && !optionalOpen)
  const activity = useMemo(() => colonyActivity(state, stats, running), [state, stats, running])

  useEffect(() => {
    if (!saveEnabled) return
    setSaveStatus(persistence.save(state))
  }, [state, saveEnabled])

  useEffect(() => {
    if (!state.manifestId || state.transferWindowPending || state.pendingEventId || state.pendingRivalEncounterId || state.pendingOperationalIncidentId || !state.speed || state.outcome || optionalOpen) return undefined
    const timer = window.setInterval(() => setState((current) => advanceSol(current)), Math.max(150, LEARNING_SOL_MS / state.speed))
    return () => window.clearInterval(timer)
  }, [state.manifestId, state.transferWindowPending, state.pendingEventId, state.pendingRivalEncounterId, state.pendingOperationalIncidentId, state.speed, state.outcome, optionalOpen])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 7000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !optionalOpen && state.buildMode) {
        setState((current) => ({ ...current, buildMode: null, speed: 0 }))
        setNotice('Construction cancelled. Time remains paused.')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [optionalOpen, state.buildMode])

  useEffect(() => {
    if (!state.speed || state.outcome) return
    const critical = ['water', 'oxygen', 'food'].find((key) => stats[`${key}Net`] < 0 && state.resources[key] / -stats[`${key}Net`] <= 3)
    if (!critical) return
    setState((current) => ({ ...current, speed: 0 }))
    setNotice(`Time paused: ${critical} reserve is projected to run out within 3 sols. Review production before advancing.`)
  }, [state.speed, state.outcome, state.resources, stats])

  const openPanel = (name) => {
    setState((current) => current.speed ? { ...current, speed: 0 } : current)
    setPanel(name)
  }
  const closePanel = () => setPanel(null)
  const handleSpeed = (speed) => setState((current) => ({ ...current, speed }))
  const handleStep = () => setState((current) => advanceSol({ ...current, speed: 0 }))
  const handleBuildMode = (buildMode) => {
    setState((current) => ({ ...current, buildMode, speed: 0 }))
    if (buildMode) setNotice('Construction planning paused time. Choose a map cell or use the precise grid below it. Escape cancels.')
  }
  const applyCommand = (command) => setState((current) => {
    const result = command(current)
    if (result.error) setNotice(result.error)
    return result.state
  })
  const handlePlace = (type, col, row) => applyCommand((current) => placeBuilding(current, type, col, row))
  const handleCancelSite = (uid) => applyCommand((current) => cancelConstruction(current, uid))
  const handleRepair = (uid) => applyCommand((current) => repairBuilding(current, uid))
  const handleManifest = (id) => applyCommand((current) => applyManifest(current, id))
  const handleFollowOnManifest = (id) => applyCommand((current) => applyFollowOnManifest(current, id))
  const handleSponsorEvent = (id) => applyCommand((current) => applySponsorEventChoice(current, id))
  const handleRivalEncounter = (id) => applyCommand((current) => applyRivalEncounterChoice(current, id))
  const handleOperationalIncident = (id) => applyCommand((current) => applyOperationalIncidentChoice(current, id))
  const handleRoverAssignment = (route, delta) => applyCommand((current) => updateRoverAssignment(current, route, delta))
  const handleCrossTraining = (role) => applyCommand((current) => updateCrossTraining(current, role))
  const handleCrewLead = (id) => applyCommand((current) => updateCrewLead(current, id))
  const selectBuilding = (uid) => setState((current) => ({ ...current, selectedUid: uid }))

  const exportMission = (raw) => {
    try {
      const text = typeof raw === 'string' ? raw : persistence.exportSave(state)
      if (!text) throw new Error('This mission could not be validated for export. Recover a previous good save or export the preserved damaged file.')
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `titans-of-mars-sol-${state.sol}${typeof raw === 'string' ? '-recovery' : ''}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setNotice('Mission export prepared. Check your browser downloads.')
    } catch (error) { setNotice(error.message || 'Export could not be prepared. Your mission has not been changed.') }
  }
  const acceptLoadedMission = (result) => {
    setSaveStatus(result)
    if (result.state) { setSaveEnabled(true); setState({ ...result.state, speed: 0 }); setInspectingOutcome(false) }
    setNotice(result.message)
    return result
  }
  const resetMission = () => {
    const fresh = createInitialState()
    const result = persistence.reset(fresh)
    setState(fresh)
    setSaveStatus(result)
    setSaveEnabled(true)
    setInspectingOutcome(false)
    setPanel(null)
    setNotice('A new mission is ready. Time is paused.')
  }
  const handleSponsor = (sponsorId) => { setState(createInitialState(sponsorId)); setNotice('Founding mission authorized. Select a payload.') }
  const handleNextAction = (action) => {
    if (action === 'rovers' || action === 'crew') openPanel(action)
    else if (action === 'step') handleStep()
    else if (action === 'report') setInspectingOutcome(false)
    else if (action === 'objectives') document.getElementById('mission-objectives')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    else handleBuildMode(action)
  }

  let dialog = null
  let modalKey = ''
  let canCloseDialog = false
  if (panel) {
    modalKey = panel
    canCloseDialog = true
    if (panel === 'guide') dialog = <GuideModal onClose={closePanel} />
    if (panel === 'field') dialog = <MarsFieldGuide onClose={closePanel} />
    if (panel === 'rovers') dialog = <RoverDispatch state={state} stats={stats} onAssign={handleRoverAssignment} onClose={closePanel} />
    if (panel === 'crew') dialog = <CrewRoster state={state} stats={stats} onTraining={handleCrossTraining} onLead={handleCrewLead} onClose={closePanel} />
    if (panel === 'saves') dialog = <SaveManagement status={saveStatus} onExport={exportMission} onImport={(raw) => acceptLoadedMission(persistence.importSave(raw))} onRecover={() => acceptLoadedMission(persistence.recoverBackup())} onNew={() => setPanel('reset')} onClose={closePanel} />
    if (panel === 'reset') dialog = <div className="modal-backdrop"><section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h1 id="reset-title">Begin a new mission?</h1><p>The current campaign will be replaced. Export it first if you want to return later.</p><div className="save-actions"><button onClick={() => exportMission()}>Export current mission</button><button onClick={resetMission}>Begin new mission</button><button className="primary-command" onClick={closePanel}>Keep current mission</button></div></section></div>
  } else if (!state.sponsorId) { modalKey = 'sponsor'; dialog = <SponsorCouncil onSelect={handleSponsor} /> }
  else if (!state.manifestId) { modalKey = 'manifest'; dialog = <ManifestCouncil state={state} onSelect={handleManifest} /> }
  else if (state.transferWindowPending) { modalKey = 'transfer'; dialog = <SecondWindowCouncil state={state} onSelect={handleFollowOnManifest} /> }
  else if (state.pendingEventId) { modalKey = state.pendingEventId; dialog = <SponsorEventCouncil state={state} eventId={state.pendingEventId} onChoose={handleSponsorEvent} /> }
  else if (state.pendingRivalEncounterId) { modalKey = state.pendingRivalEncounterId; dialog = <RivalEncounterCouncil state={state} sponsorId={state.sponsorId} encounterId={state.pendingRivalEncounterId} onChoose={handleRivalEncounter} /> }
  else if (state.pendingOperationalIncidentId) { modalKey = state.pendingOperationalIncidentId; dialog = <OperationalIncidentCouncil state={state} incidentId={state.pendingOperationalIncidentId} onChoose={handleOperationalIncident} /> }
  else if (state.outcome && !inspectingOutcome) { modalKey = 'outcome'; dialog = <OutcomeOverlay outcome={state.outcome} state={state} objectives={objectives} onReset={() => openPanel('reset')} onInspect={() => setInspectingOutcome(true)} onExport={() => exportMission()} /> }

  return <div className="app-shell">
    <div ref={commandRef} className="command-interface">
      <TopBar state={state} stats={stats} musicOpen={soundtrackOpen} onMusic={() => { setState((current) => ({ ...current, speed: 0 })); setSoundtrackOpen((current) => !current) }} onFieldGuide={() => openPanel('field')} onGuide={() => openPanel('guide')} onCrew={() => openPanel('crew')} onRovers={() => openPanel('rovers')} onReset={() => openPanel('reset')} onSaves={() => openPanel('saves')} />
      <SoundtrackControl open={soundtrackOpen} state={state} stats={stats} onClose={() => setSoundtrackOpen(false)} />
      <div className={`save-status status-${saveStatus.status}`} role="status"><span>{saveStatus.message || 'Mission autosaved in this browser.'}</span><button onClick={() => openPanel('saves')}>Saved missions</button>{state.outcome ? <button onClick={() => setInspectingOutcome(false)}>View final audit</button> : null}</div>
      <CommandControls state={state} onBuildMode={handleBuildMode} onSpeed={handleSpeed} onStep={handleStep} />
      <main className="command-grid">
        <MissionRail state={state} stats={stats} objectives={objectives} onNextAction={handleNextAction} />
        <div className="colony-workspace">
          <MarsMap activity={activity} buildings={state.buildings} buildMode={state.buildMode} selectedUid={state.selectedUid} storm={stats.storm} debris={stats.debris} network={stats.network} sponsorId={state.sponsorId} surveyedFeatureIds={state.surveyedFeatureIds} settlementName={state.settlementName} siteName={state.siteName} onPlace={handlePlace} onSelect={selectBuilding} />
          <div className="activity-readout" role="status"><strong>Surface work · {running ? 'active' : 'paused'}</strong><span>{activity.rovers.filter((r) => r.status === 'active').length} rovers on assigned jobs · {activity.crew.filter((c) => c.status === 'working').length} EVA tasks</span><small>Routes illustrate assigned work; simulated sols control production and construction.</small></div>
          <KeyboardGrid state={state} onPlace={handlePlace} onSelect={selectBuilding} onCancel={() => handleBuildMode(null)} />
        </div>
        <Inspector state={state} stats={stats} onCancelSite={handleCancelSite} onRepair={handleRepair} />
      </main>
      <BuildPalette state={state} onBuildMode={handleBuildMode} />
    </div>
    {notice ? <div className="system-notice" role="status">{notice}</div> : null}
    {dialog ? <ModalLayer key={modalKey} modalKey={modalKey} backgroundRef={commandRef} onClose={canCloseDialog ? closePanel : null}>{dialog}</ModalLayer> : null}
  </div>
}
