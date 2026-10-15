import { BookOpen, Box, CircleGauge, CloudLightning, Droplets, Gauge, Music2, PackageOpen, RotateCcw, Save, ShieldCheck, Truck, Users, Wind } from 'lucide-react'

function Resource({ icon: Icon, label, value, detail, tone = 'gold' }) {
  return (
    <div className="resource-readout">
      <Icon className={`tone-${tone}`} aria-hidden="true" />
      <span><small>{label}</small><strong>{value}</strong>{detail ? <em>{detail}</em> : null}</span>
    </div>
  )
}

export default function TopBar({ state, stats, musicOpen, onMusic, onFieldGuide, onGuide, onCrew, onRovers, onReset, onSaves }) {
  const powerTone = stats.powerCapacity >= stats.powerDemand ? 'gold' : 'danger'
  return (
    <header className="top-bar">
      <div className="brand-lockup"><strong>TITANS OF MARS</strong><span>FIRST CITY</span></div>
      <div className="resource-strip" aria-label="Colony resources">
        <Resource icon={Gauge} label="Power" value={`${stats.powerCapacity}/${stats.powerDemand} kW`} tone={powerTone} />
        <Resource icon={Droplets} label="Water" value={`${Math.round(state.resources.water)} L`} detail={`${stats.waterNet >= 0 ? '+' : ''}${stats.waterNet}/sol`} tone="water" />
        <Resource icon={Wind} label="Oxygen" value={`${Math.round(state.resources.oxygen)} L`} detail={`${stats.oxygenNet >= 0 ? '+' : ''}${stats.oxygenNet}/sol`} tone="oxygen" />
        <Resource icon={PackageOpen} label="Food" value={`${Math.round(state.resources.food)} kg`} detail={`${stats.foodNet}/sol`} tone="life" />
        <Resource icon={Box} label="Parts" value={Math.round(state.resources.parts)} detail={`${stats.partsNet >= 0 ? '+' : ''}${stats.partsNet}/sol`} />
        <Resource icon={ShieldCheck} label="Cargo" value={`${state.resources.cargo.toFixed(1)} t`} />
        <Resource icon={CircleGauge} label="Confidence" value={`${Math.round(state.resources.confidence)}%`} tone="life" />
      </div>
      <div className="sol-readout">
        <strong>SOL {String(state.sol).padStart(3, '0')}</strong>
        <span>{stats.storm ? <><CloudLightning /> Dust front</> : stats.debris ? <><CloudLightning /> Debris alert</> : 'Mars local time'}</span>
      </div>
      <div className="header-tools">
        <button className={musicOpen ? 'active' : ''} onClick={onMusic} title="Soundtrack" aria-label={musicOpen ? 'Close soundtrack' : 'Open soundtrack'} aria-expanded={musicOpen}><Music2 /></button>
        <button onClick={onFieldGuide} title="Mars field guide" aria-label="Open Mars field guide"><BookOpen /></button>
        <button onClick={onGuide} title="Mission guide" aria-label="Open mission guide"><ShieldCheck /></button>
        <button className="crew-tool" onClick={onCrew} title="Crew roster" aria-label="Open crew roster"><Users /><span>{state.crew}</span></button>
        <button className="rover-tool" onClick={onRovers} title="Rover dispatch" aria-label="Open rover dispatch"><Truck /><span>{stats.rovers.assigned}/{stats.rovers.fleet}</span></button>
        <button onClick={onSaves} title="Saved missions" aria-label="Open saved missions"><Save /></button>
        <button onClick={onReset} title="Reset mission" aria-label="Reset mission"><RotateCcw /></button>
      </div>
    </header>
  )
}
