import { Droplets, Hammer, Minus, Plus, Radar, Truck, Wrench, X } from 'lucide-react'
import { ROVER_ROUTES, ROVER_ROUTE_ORDER, roverOperations } from '../game/roverOperations.js'
import { constructionStatus } from '../game/construction.js'
import { surveyStatus } from '../game/siteFeatures.js'

const ROUTE_ICONS = { water: Droplets, construction: Hammer, maintenance: Wrench, survey: Radar }

function routeImpact(route, state, stats, operations) {
  if (route === 'water') {
    if (!stats.rovers.activeIceRigs) return 'No ice rig commissioned'
    return `${stats.rovers.supportedIceRigs}/${stats.rovers.activeIceRigs} ice rigs fully supplied`
  }
  if (route === 'construction') {
    if (!operations.assignments.construction) return 'No construction support assigned'
    return `${constructionStatus(state, stats).capacity.toFixed(2)} shared work/sol now · -${operations.constructionDiscount.parts} parts / -${operations.constructionDiscount.cargo.toFixed(1)} t per order`
  }
  if (route === 'survey') {
    const survey = surveyStatus(state)
    if (survey.complete) return 'All orbital prospects characterized'
    if (!operations.assignments.survey) return `${survey.discovered.length}/${survey.total} prospects confirmed · first confirmation needs 2 rover-sols`
    return `${survey.progress}/${survey.next.surveyThreshold} rover-sols toward ${survey.next.title}`
  }
  if (!operations.assignments.maintenance) return 'No maintenance reduction'
  return `-${operations.maintenanceRelief.toFixed(1)} parts maintenance per sol`
}

export default function RoverDispatch({ state, stats, onAssign, onClose }) {
  const operations = roverOperations(state)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rover-dispatch" role="dialog" aria-modal="true" aria-labelledby="rover-title">
        <button className="modal-close" onClick={onClose} title="Close rover dispatch" aria-label="Close rover dispatch"><X /></button>
        <header>
          <Truck aria-hidden="true" />
          <div><p>Surface Operations</p><h1 id="rover-title">Rover Dispatch</h1></div>
          <span><strong>{operations.available}</strong> available</span>
        </header>
        <p className="dialog-pause-note">Time is paused while dispatch is open. Confirming does not resume time. Assign Ground Survey, then use +1 sol from command to confirm orbital ice prospects.</p>
        <div className="rover-route-list">
          {ROVER_ROUTE_ORDER.map((routeId) => {
            const route = ROVER_ROUTES[routeId]
            const Icon = ROUTE_ICONS[routeId]
            const count = operations.assignments[routeId]
            return (
              <article className="rover-route" key={routeId}>
                <Icon aria-hidden="true" />
                <div className="rover-route-copy">
                  <h2>{route.title}</h2>
                  <p>{route.description}</p>
                  <strong>{routeImpact(routeId, state, stats, operations)}</strong>
                </div>
                <div className="rover-stepper" aria-label={`${route.title} rover allocation`}>
                  <button disabled={count === 0 || Boolean(state.outcome)} onClick={() => onAssign(routeId, -1)} title={`Remove rover from ${route.title}`} aria-label={`Remove rover from ${route.title}`}><Minus /></button>
                  <span><strong>{count}</strong><small>rovers</small></span>
                  <button disabled={operations.available === 0 || Boolean(state.outcome)} onClick={() => onAssign(routeId, 1)} title={`Assign rover to ${route.title}`} aria-label={`Assign rover to ${route.title}`}><Plus /></button>
                </div>
              </article>
            )
          })}
        </div>
        <footer><span>{operations.assigned}/{operations.fleet} fleet units deployed</span><button className="primary-command" onClick={onClose}>Confirm dispatch</button></footer>
      </section>
    </div>
  )
}
