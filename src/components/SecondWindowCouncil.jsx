import { Factory, HeartPulse, ShieldCheck } from 'lucide-react'
import { followOnManifestsForSponsor } from '../game/followOnManifests.js'
import { followOnEligibility } from '../game/simulation.js'

const ICONS = { power: ShieldCheck, life: HeartPulse, industry: Factory }

export default function SecondWindowCouncil({ state, onSelect }) {
  const manifests = followOnManifestsForSponsor(state.sponsorId)
  return (
    <div className="manifest-backdrop">
      <section className="manifest-council second-window-council" role="dialog" aria-modal="true" aria-labelledby="second-window-title">
        <header>
          <p>Sol 24 Settlement Review · Sponsor Confidence {Math.round(state.resources.confidence)}%</p>
          <h1 id="second-window-title">Authorize the Follow-On Package</h1>
          <span>The sponsor has accepted the landing site. In this scenario, the follow-on convoy was launched before your landing. This review compresses its arrival and surface allocation; it is not a new Earth-to-Mars flight completed in 24 sols.</span>
        </header>
        <div className="manifest-grid">
          {manifests.map((manifest) => {
            const id = manifest.id
            const eligibility = followOnEligibility(state, id)
            const Icon = ICONS[manifest.icon]
            return (
              <button
                type="button"
                className={`manifest-option ${eligibility.eligible ? '' : 'locked'}`}
                key={id}
                disabled={!eligibility.eligible}
                onClick={() => onSelect(id)}
                aria-label={`Commit ${manifest.title}`}
              >
                <div className="manifest-proposer"><Icon aria-hidden="true" /><span><small>Proposed by</small><strong>{manifest.proposer}</strong></span></div>
                <h2>{manifest.title}</h2>
                <p>{manifest.thesis}</p>
                <div className="manifest-allocation">
                  {manifest.allocations.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}
                </div>
                <dl>
                  <div><dt>Strength</dt><dd>{manifest.strength}</dd></div>
                  <div><dt>Risk</dt><dd>{manifest.risk}</dd></div>
                </dl>
                <span className="manifest-eligibility">{eligibility.reason}</span>
                <span className="manifest-command">{eligibility.eligible ? 'Commit follow-on manifest' : 'Authorization withheld'}</span>
              </button>
            )
          })}
        </div>
        <footer>Real interplanetary deliveries take far longer than this review interval. The Sol 42 audit tests connected systems, usable housing, staffing and a 30-sol no-delivery operating forecast. A passing forecast does not itself mean every production flow is independent.</footer>
      </section>
    </div>
  )
}
