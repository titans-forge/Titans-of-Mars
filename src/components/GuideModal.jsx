import { X } from 'lucide-react'

export default function GuideModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <button className="modal-close" onClick={onClose} title="Close guide" aria-label="Close guide"><X /></button>
        <h1 id="guide-title">Mission Guide</h1>
        <p>Your transfer vehicle is not a permanent home. Establish local life support and storm-resilient power before the dust front reaches the colony on Sol 18.</p>
        <ol>
          <li>Choose a founding sponsor and transfer doctrine. This is a fictional near-future scenario; real engineering is simplified.</li>
          <li>Start with Ground Survey: open Rover Dispatch, remove one rover from a current route, then assign it to Ground Survey. Purple prospects are not yet confirmed ice.</li>
          <li>Close dispatch and use +1 sol. The first lens takes two rover-sols in ordinary conditions. The next-step panel gives your current estimate and coordinates.</li>
          <li>Select Ice Extraction Rig in Construct, then choose the confirmed cyan lens. A structure must lie within two cells of an online utility node. Use the precise grid to preview costs, the construction queue and the balance after commissioning.</li>
          <li>Construction takes simulated sols: foundation, frame and services, assembly, then commissioning. All worksites share one engineering work budget. Fit engineering crew provide up to 0.5 work units per sol, with each Construction Support rover adding up to one; staffing and readiness reduce the rate. Supplies are paid once when you authorize the site. Its inspector shows progress and the refund available if you cancel.</li>
          <li>After commissioning the rig, return a rover to Ice Haul for its full yield. Continue surveying later to earn science and find richer lenses.</li>
          <li>Commission connected housing, oxygen and resilient power. An ice rig needs electricity, surface labor and hauling. Oxygen and greenhouse production additionally consume water feedstock; a building silhouette alone is not a working system.</li>
          <li>1× advances one sol every five seconds. +1 sol advances exactly one sol and remains paused. Opening a guide, roster, dispatch or build plan pauses time; closing it never resumes time for you.</li>
          <li>Watch water, oxygen and food trends as well as stored reserves. Reserves declining toward zero do not mean a self-sufficient city. A critical three-sol shortage pauses time for review.</li>
          <li>Check every objective in the scrollable mission panel. Sponsor decisions at Sol 12 and Sol 30 and other incidents pause until resolved. Grey choices explain their missing payment.</li>
          <li>Review effective production and staffing in the inspector and Crew Roster. Named officers are leaders within the larger workforce, not an extra set of workers.</li>
          <li>Dust and debris can damage structures. EVA crew shelter during alerts; construction rovers can continue remotely supervised work unless your insurance policy suspends construction. Select degraded commissioned equipment and authorize repairs from its inspector. Patrols inspect equipment; they do not authorize repairs for you. Preview dust-front power before expanding.</li>
          <li>The Sol 24 review authorizes a convoy launched before your landing; arrival and surface allocation are compressed into this scenario review, not a new 24-sol flight from Earth. Sol 42 audits actual life-support viability, independence, welfare, science and cooperation. Further surveys and your recorded policies shape the grades.</li>
        </ol>
        <h2>See the colony clearly</h2>
        <p>Each sponsor lands in its own regional landscape. These are geology-inspired illustrations of fictional sites; surface colors and decorative rocks do not reveal ice yields or add movement obstacles. Survey markers and the engineering ledger supply the game rules.</p>
        <p>Use the map's plus and minus buttons to zoom, Focus to inspect the selected structure, and Overview to return to the whole site. Pan mode lets you drag the terrain without placing or selecting anything; the arrow buttons also move the view. Turn Pan off to resume map commands. Grid and Utilities can be hidden for a clearer view; construction planning always reveals the grid and valid placement cells. Camera changes never spend supplies or advance time.</p>
        <p>While the map toolbar has keyboard focus: plus/minus zoom, arrows pan, 0 returns to Overview, F focuses selection and P toggles Pan. Those shortcuts do not replace the precise construction grid's own arrow controls. On a phone, use the buttons and Pan mode; ordinary page scrolling remains available outside the map.</p>
        <h2>Read the engineering ledger</h2>
        <ul>
          <li>One simulated sol is 24.6 hours. Power in kW is a rate; battery storage in kWh is energy. A 10 kW shortfall for one full sol uses 246 kWh. One intact Grid Battery Bank stores 6,000 kWh (6 MWh); damaged banks hold less.</li>
          <li>A battery stores spare generation and supplies a deficit within its charge, discharge and capacity limits. It cannot make energy. Preview all four dusty sols: a single powered moment is not storm resilience.</li>
          <li>The model reserves domestic water for the crew first, then supplies oxygen production before greenhouse irrigation. Short feedstock, inadequate power, damaged equipment and missing shifts reduce actual output. The inspector shows effective output and its limiting cause.</li>
          <li>An intact, fully supplied reclamation plant recovers up to 42% of modeled domestic water use. Power, labor and condition can reduce that fraction. The remaining domestic losses still need replacement, and this simplified loop does not reclaim the water consumed by oxygen production or greenhouse processes.</li>
          <li>The final 30-sol forecast keeps current assignments, stores and funded worksites, with crew condition and construction progressing over time. It assumes no new deliveries, building orders or incident choices. Independence also requires nonnegative current water, oxygen, food and parts balances plus enough generation. Imported reserves can make a city viable without making it independent.</li>
        </ul>
        <p>Grades: resilience measures integrity, objectives and the 30-sol forecast; independence requires replacing daily water, oxygen, food, parts and power locally. Science is 70% survey completeness and 30% research points (25 points fills that portion). Crew welfare reflects health and fatigue; legitimacy is sponsor confidence. Diplomacy is measured against the best reachable negotiated outcome for your sponsor. A starts at 90. An unmet operating forecast or unsuccessful campaign caps the overall grade at D; an empty essential reserve caps it at F.</p>
        <p>These yields, losses, workforce units and review dates are teaching abstractions, not life-support design specifications. The Mars Field Guide links real planetary science and mission history; the 2030s settlement story and institutions are fictional.</p>
        <p>Only commissioned, grid-linked structures operate or satisfy objectives. A queued site cannot extend the utility network. Completion happens after that sol's operating ledger; its output begins in the following interval. The queue estimate assumes the current work rate and access continue. Rover travel and crew poses illustrate assigned work; their animation does not award production. Pausing freezes their movement, and reduced-motion preferences use static poses.</p>
        <p>Saved Missions shows whether autosave is working and offers export, import and previous-good recovery. Worksite progress and paid supplies are saved; the campaign restores paused. A strong Sol 24 review opens a second transfer window and the permanent-city audit follows on Sol 42.</p>
        <button className="primary-command" onClick={onClose}>Return to command</button>
      </section>
    </div>
  )
}
