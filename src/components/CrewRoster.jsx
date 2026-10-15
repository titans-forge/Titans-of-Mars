import { useRef } from 'react'
import { BriefcaseBusiness, Crosshair, HeartPulse, Minus, Users, Wrench, X } from 'lucide-react'
import { CROSS_TRAINING_ROLES, crewLabor } from '../game/crewLabor.js'
import { ensureCrewMembers, TRAIT_LABELS } from '../game/crewMembers.js'

const COHORTS = [
  { id: 'engineering', title: 'Systems Engineers', icon: Wrench, effect: 'Reactor, workshop, and grid maintenance' },
  { id: 'operations', title: 'Surface Operators', icon: Crosshair, effect: 'Water, oxygen, and manufacturing throughput' },
  { id: 'support', title: 'Science & Medical', icon: HeartPulse, effect: 'Crew health, research, and civic continuity' },
  { id: 'residents', title: 'Residents', icon: Users, effect: 'Population without a dedicated technical billet' },
]

const FOCUS_LABELS = { engineering: 'Engineering', operations: 'Surface Ops', support: 'Medical & Civic' }

export default function CrewRoster({ state, stats, onTraining, onLead, onClose }) {
  const labor = crewLabor(state, stats.network.connectedUids)
  const members = ensureCrewMembers(state)
  const officerRefs = useRef({})
  const committedLead = state.assignmentCommitment?.sol === state.sol ? state.assignmentCommitment.crewLeadId : null
  const leadDisabled = (member) => Boolean(state.outcome) || member.health <= 0 || Boolean(committedLead && member.id !== committedLead)
  const availableLeads = members.filter((member) => !leadDisabled(member))
  const focusLeadId = availableLeads.some((member) => member.id === state.crewLeadId) ? state.crewLeadId : availableLeads[0]?.id
  const moveLeadFocus = (event) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key) || !availableLeads.length) return
    event.preventDefault()
    const currentId = event.target.closest('[data-officer-id]')?.dataset.officerId
    const index = Math.max(0, availableLeads.findIndex((member) => member.id === currentId))
    const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? availableLeads.length - 1 : (index + (backwards ? -1 : 1) + availableLeads.length) % availableLeads.length
    const next = availableLeads[nextIndex]
    onLead(next.id)
    officerRefs.current[next.id]?.focus()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="crew-roster" role="dialog" aria-modal="true" aria-labelledby="crew-title">
        <button className="modal-close" onClick={onClose} title="Close crew roster" aria-label="Close crew roster"><X /></button>
        <header>
          <BriefcaseBusiness aria-hidden="true" />
          <div><p>Settlement Labor Office</p><h1 id="crew-title">Crew Roster</h1></div>
          <span className={labor.fullyStaffed ? 'ready' : 'strained'}><strong>{state.crew}</strong>{labor.fullyStaffed ? 'fully staffed' : 'labor constrained'}</span>
        </header>
        <div className="cohort-grid">
          {COHORTS.map(({ id, title, icon: Icon, effect }) => {
            const demand = labor.demand[id]
            const available = labor.available[id] ?? labor.cohorts[id]
            const ratio = labor.ratios[id]
            return (
              <article className="cohort-row" key={id}>
                <Icon aria-hidden="true" />
                <div><h2>{title}</h2><p>{effect}</p></div>
                <span><strong>{labor.cohorts[id]}</strong><small>{id === 'residents' ? 'residents' : `${available.toFixed(1)} available · ${(demand ?? 0).toFixed(1)} required`}</small></span>
                {id !== 'residents' ? <i className={ratio >= 1 ? 'ready' : 'strained'} style={{ width: `${Math.max(8, ratio * 100)}%` }} /> : null}
              </article>
            )
          })}
        </div>
        <section className="crew-officers">
          <div className="officer-heading"><h2>Mission Officer</h2><p>These officers represent the larger labor cohorts above; they are not additional workers. Select a medically fit lead. Their specialty changes a narrow part of operations.</p></div>
          <p id="officer-keyboard-help" className="dialog-pause-note">Use arrow keys to choose a lead; Home and End jump to the first or last available officer. {committedLead ? "The logistics lead is committed to this sol’s construction. Advance one sol before changing command." : "Unfit officers cannot take the active lead."}</p>
          <div className="officer-grid" role="radiogroup" aria-label="Mission officer" aria-describedby="officer-keyboard-help" onKeyDown={moveLeadFocus}>
            {members.map((member) => (
              <button ref={(node) => { officerRefs.current[member.id] = node }} data-officer-id={member.id} tabIndex={member.id === focusLeadId ? 0 : -1} type="button" role="radio" aria-checked={state.crewLeadId === member.id} className={state.crewLeadId === member.id ? 'active' : ''} key={member.id} disabled={leadDisabled(member)} title={committedLead && member.id !== committedLead ? "Current lead is committed until the next sol" : member.health <= 0 ? "Officer is medically unfit for command" : undefined} onClick={() => onLead(member.id)}>
                <span><strong>{member.name}</strong><small>{member.role} · {FOCUS_LABELS[member.cohort] ?? 'Resident'} shift</small></span>
                <i>{member.health}% health · {Math.round(member.fatigue)}% fatigue</i>
                <p>{TRAIT_LABELS[member.trait]}</p>
              </button>
            ))}
          </div>
        </section>
        <section className="training-focus">
          <div><h2>Cross-Training Focus</h2><p>Half of one rotating duty shift reinforces the selected labor pool.</p></div>
          <div className="training-segments" role="group" aria-label="Cross-training focus">
            {CROSS_TRAINING_ROLES.map((role) => (
              <button aria-pressed={labor.focus === role} className={labor.focus === role ? 'active' : ''} key={role} disabled={Boolean(state.outcome)} onClick={() => onTraining(role)}>{FOCUS_LABELS[role]}</button>
            ))}
          </div>
        </section>
        <footer><span><Minus aria-hidden="true" /> Shortages reduce output or increase colony strain.</span><button className="primary-command" onClick={onClose}>Confirm roster</button></footer>
      </section>
    </div>
  )
}
