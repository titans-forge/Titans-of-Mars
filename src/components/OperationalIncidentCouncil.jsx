import { AlertOctagon, ArrowRight } from 'lucide-react'
import { decisionEligibility, decisionOptions } from '../game/simulation.js'
import DecisionDetails from './DecisionDetails.jsx'
import { operationalIncidentById } from '../game/operationalIncidents.js'

function effectLabel(key, value) {
  const labels = { water: 'Water', oxygen: 'Oxygen', food: 'Food', parts: 'Parts', cargo: 'Cargo', confidence: 'Confidence', integrity: 'Integrity' }
  const units = { water: ' L', oxygen: ' L', food: ' kg', cargo: ' t', confidence: '%', integrity: '%' }
  return `${labels[key] ?? key} ${value > 0 ? '+' : ''}${value}${units[key] ?? ''}`
}

export default function OperationalIncidentCouncil({ state, incidentId, onChoose }) {
  const incident = operationalIncidentById(incidentId)
  if (!incident) return null
  return (
    <div className="manifest-backdrop incident-backdrop">
      <section className="event-council incident-council" role="dialog" aria-modal="true" aria-labelledby="incident-title">
        <header>
          <AlertOctagon aria-hidden="true" />
          <p>Settlement operations · {incident.system}</p>
          <h1 id="incident-title">{incident.title}</h1>
          <blockquote>{incident.brief}</blockquote>
          <span>{incident.stakes}</span>
        </header>
        <div className="event-choice-grid">
          {decisionOptions(state, incident).map((choice) => {
            const eligibility = decisionEligibility(state, choice)
            return (
            <button type="button" className="event-choice" key={choice.id} disabled={!eligibility.eligible} title={eligibility.reason || undefined} onClick={() => onChoose(choice.id)}>
              <span className="event-choice-command">Operations order</span>
              <h2>{choice.title}</h2>
              <p>{choice.description}</p>
              <div className="event-effects">
                {Object.entries(choice.effects ?? {}).map(([key, value]) => <strong className={value >= 0 ? 'positive' : 'negative'} key={key}>{effectLabel(key, value)}</strong>)}
              </div>
              <DecisionDetails choice={choice} />
              {!eligibility.eligible ? <span className="choice-unavailable">Unavailable: {eligibility.reason}</span> : null}
              <span className="event-commit">Issue operations order <ArrowRight aria-hidden="true" /></span>
            </button>
          )})}
        </div>
        <footer>This incident follows from the current colony state and will be recorded in the campaign chronicle.</footer>
      </section>
    </div>
  )
}
