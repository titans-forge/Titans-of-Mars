import { Globe2, Landmark, Rocket, Wrench } from 'lucide-react'
import { SPONSORS, SPONSOR_ORDER } from '../game/sponsors.js'

const ICONS = { commercial: Rocket, state: Landmark, coalition: Globe2, rugged: Wrench }

export default function SponsorCouncil({ onSelect }) {
  return (
    <div className="manifest-backdrop sponsor-backdrop">
      <section className="sponsor-council" role="dialog" aria-modal="true" aria-labelledby="sponsor-title">
        <header>
          <p>Fictional near-future scenario · 2033–2038</p>
          <h1 id="sponsor-title">Choose the Founding Mission</h1>
          <span>Four imagined missions reach Mars with different political systems, cargo assumptions and operating constraints. The dates, institutions and competition are scenario fiction, not announced mission plans.</span>
        </header>
        <div className="sponsor-grid">
          {SPONSOR_ORDER.map((id) => {
            const sponsor = SPONSORS[id]
            const Icon = ICONS[sponsor.icon]
            return (
              <button className="sponsor-option" key={id} onClick={() => onSelect(id)} aria-label={`Found ${sponsor.settlementName} with ${sponsor.name}`}>
                <div className="sponsor-heading"><Icon aria-hidden="true" /><span><small>Launch window {sponsor.earthYear}</small><strong>{sponsor.name}</strong></span></div>
                <h2>{sponsor.settlementName}</h2>
                <p>{sponsor.doctrine}</p>
                <dl>
                  <div><dt>Advantage</dt><dd>{sponsor.strength}</dd></div>
                  <div><dt>Constraint</dt><dd>{sponsor.constraint}</dd></div>
                </dl>
                <span className="sponsor-command">Assume mission command</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
