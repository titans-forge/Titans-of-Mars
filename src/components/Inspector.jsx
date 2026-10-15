import { constructionRefund, constructionStage, constructionStatus } from '../game/construction.js'
import { Orbit, Wrench } from 'lucide-react'
import { BUILDINGS } from '../game/buildings.js'
import { reserveCoverage } from '../ui/planning.js'
import { rivalSettlementFor } from '../game/rivalSettlements.js'
import { iceDepositAt, siteForSponsor, solarRidgeAt } from '../game/siteFeatures.js'
import { buildingEfficiency, buildingRepairCost } from '../game/simulation.js'

function Stat({ label, value }) {
  return <div className="inspector-stat"><span>{label}</span><strong>{value}</strong></div>
}

function relationsLabel(value) {
  if (value >= 70) return 'Trusted'
  if (value >= 55) return 'Open'
  if (value >= 40) return 'Guarded'
  return 'Hostile'
}

function positionLabel(value) {
  if (value >= 70) return 'Leading'
  if (value >= 55) return 'Advantaged'
  if (value >= 40) return 'Balanced'
  return 'Trailing'
}

export default function Inspector({ state, stats, onRepair, onCancelSite }) {
  const selected = state.buildings.find((building) => building.uid === state.selectedUid) ?? state.buildings[0]
  const definition = selected ? BUILDINGS[selected.type] : null
  const connected = selected ? stats.network.connectedUids.includes(selected.uid) : false
  const iceDeposit = selected?.type === 'ice' ? iceDepositAt(state, selected.col, selected.row) : null
  const solarRidge = selected?.type === 'solar' ? solarRidgeAt(state, selected.col, selected.row) : null
  const efficiency = buildingEfficiency(selected?.integrity)
  const dustFactor = Math.max(0.18, Math.min(0.38, 0.28 / siteForSponsor(state.sponsorId).dustSeverity))
  const powerOutput = definition?.power ? Math.round(definition.power * efficiency * (solarRidge?.multiplier ?? 1) * (stats.storm && selected?.type === 'solar' ? dustFactor : 1)) : null
  const rival = rivalSettlementFor(state.sponsorId)
  const effective = selected ? stats.production?.[selected.uid] : null
  const work = constructionStatus(state, stats)
  const refund = constructionRefund(selected)
  const repairCost = selected ? buildingRepairCost(state, selected.uid) : 0

  return (
    <aside className="inspector-rail">
      <section className="building-inspector">
        <p>{definition?.category ?? 'mission system'}</p>
        <h2>{definition?.name ?? 'No structure selected'}</h2>
        <span className={`status-line ${connected ? '' : 'offline'}`}><i /> {selected?.construction ? 'Construction site · not operational' : connected ? selected?.integrity < 100 ? 'Grid linked - degraded' : 'Utility grid linked' : 'Isolated - offline'}</span>
        {selected?.construction ? <section className="construction-inspector"><h3>{constructionStage(selected)}</h3><progress aria-label="Construction work" value={selected.construction.completedWork} max={selected.construction.requiredWork} /><p>{selected.construction.completedWork.toFixed(2)} / {selected.construction.requiredWork} work units. No production, storage or utility bridging before commissioning.</p><p>{work.capacity.toFixed(2)} work/sol shared across {work.queue.length} sites. {work.reason}</p><button className="cancel-site" disabled={Boolean(state.outcome)} onClick={() => onCancelSite(selected.uid)}>Cancel worksite · recover {refund.parts} parts / {refund.cargo} t</button><small>Full refund before work starts; afterward 75% of unspent supplies, rounded down.</small></section> : null}
        {selected?.construction ? <h3>Planned specifications · after commissioning</h3> : null}
        <div className="inspector-stats">
          <Stat label="Grid cell" value={selected ? `${selected.col + 1}, ${selected.row + 1}` : "—"} />
          <Stat label="Integrity" value={`${selected?.integrity ?? 0}%`} />
          {selected?.integrity < 100 ? <Stat label="Efficiency" value={`${Math.round(efficiency * 100)}%`} /> : null}
          {definition?.power ? <Stat label="Nameplate / condition" value={`${powerOutput} kW`} /> : null}
          {definition?.powerUse ? <Stat label="Demand" value={`${definition.powerUse} kW`} /> : null}
          {definition?.water && !iceDeposit ? <Stat label="Water" value={`+${definition.water}/sol`} /> : null}
          {iceDeposit ? <Stat label="Field yield" value={`+${iceDeposit.yield}/sol`} /> : null}
          {iceDeposit || solarRidge ? <Stat label="Survey site" value={(iceDeposit ?? solarRidge).title} /> : null}
          {definition?.oxygen ? <Stat label="Oxygen" value={`+${definition.oxygen}/sol`} /> : null}
          {definition?.parts ? <Stat label="Parts" value={`+${definition.parts}/sol`} /> : null}
          {definition?.food ? <Stat label="Food" value={`+${definition.food}/sol`} /> : null}
          {definition?.waterRecovery ? <Stat label="Water recovery" value={`${Math.round(definition.waterRecovery * 100)}%`} /> : null}
          {definition?.batteryCapacity ? <Stat label="Storage" value={`${definition.batteryCapacity} kWh`} /> : null}
          {definition?.crewCapacity ? <Stat label={selected?.construction ? 'Planned bunks' : 'Crew'} value={selected?.construction ? definition.crewCapacity : `${state.crew}/${definition.crewCapacity}`} /> : null}
        </div>
        {!selected?.construction && effective ? <div className="effective-output"><h3>Effective operation now</h3><p>{effective.reason || (effective.online ? 'Connected and operating within current power, crew and input limits.' : 'Offline — no production.')}</p>{[['Power generation', effective.powerGeneration, 'kW'], ['Power use', effective.powerUse, 'kW'], ['Water output', effective.water, 'L/sol'], ['Water feedstock', effective.waterInput, 'L/sol'], ['Oxygen output', effective.oxygen, 'L/sol'], ['Food output', effective.food, 'kg/sol'], ['Parts output', effective.parts, '/sol']].filter(([, value]) => value > 0).map(([label, value, unit]) => <Stat key={label} label={label} value={`${Math.round(value * 10) / 10} ${unit}`} />)}</div> : null}
        <p className="building-description">{definition?.description}</p>
        {!selected?.construction && selected?.integrity < 100 ? (
          <button className="repair-command" disabled={state.resources.parts < repairCost || Boolean(state.outcome)} onClick={() => onRepair(selected.uid)} title={`Restore ${definition.name} to full integrity`}>
            <Wrench aria-hidden="true" /><span>Repair structure</span><strong>{repairCost} parts</strong>
          </button>
        ) : null}
      </section>
      <section className="mission-log">
        <h2>Mission Log</h2>
        <div>
          {state.log.slice(0, 6).map((entry, index) => (
            <article className={`log-${entry.tone}`} key={`${entry.sol}-${index}`}>
              <time>Sol {String(entry.sol).padStart(3, '0')}</time>
              <p>{entry.message}</p>
            </article>
          ))}
        </div>
      </section>
      {state.phase === 'expansion' && rival ? (
        <section className="rival-status" aria-label={`Strategic relationship with ${rival.name}`}>
          <header><Orbit aria-hidden="true" /><span><small>Mars network</small><strong>{rival.name}</strong></span></header>
          <p>{rival.sponsor} · {rival.site}</p>
          <div className="rival-meter-row"><span>Relations</span><strong>{relationsLabel(state.rivalRelations)}</strong><div className="rival-meter"><i style={{ width: `${state.rivalRelations}%` }} /></div></div>
          <div className="rival-meter-row position"><span>Position</span><strong>{positionLabel(state.strategicPosition)}</strong><div className="rival-meter"><i style={{ width: `${state.strategicPosition}%` }} /></div></div>
        </section>
      ) : null}
      <section className="power-balance">
        <div><span>Water endurance</span><strong>{reserveCoverage(state.resources.water, stats.waterNet)}</strong></div>
        <div><span>Oxygen endurance</span><strong>{reserveCoverage(state.resources.oxygen, stats.oxygenNet)}</strong></div>
        <div><span>Food endurance</span><strong>{reserveCoverage(state.resources.food, stats.foodNet)}</strong></div>
        <div><span>Power reserve</span><strong>{Math.round(stats.powerCapacity - stats.powerDemand)} kW</strong></div>
        <div><span>Utility network</span><strong>{stats.network.online}/{stats.network.total} online</strong></div>
        {stats.batteryCapacity > 0 ? <div><span>Battery reserve</span><strong>{Math.round(state.batteryCharge ?? 0)}/{Math.round(stats.batteryCapacity)} kWh</strong></div> : null}
      </section>
    </aside>
  )
}
