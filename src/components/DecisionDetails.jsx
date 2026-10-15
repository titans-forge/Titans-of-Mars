export default function DecisionDetails({ choice }) {
  const groups = { all: 'All crew', operations: 'Surface team', engineering: 'Engineers', support: 'Science / medical team' }
  const signed = (value) => `${value > 0 ? '+' : ''}${value}`
  return <>
    {Object.entries(choice.crewEffects ?? {}).map(([cohort, effects]) => <span className="crew-choice-effects" key={cohort}>{groups[cohort] ?? cohort}: {Object.entries(effects).map(([key, value]) => `${key} ${signed(value)}`).join(' · ')}</span>)}
    {choice.batteryCharge ? <span className="crew-choice-effects">Stored energy {signed(choice.batteryCharge)} kWh</span> : null}
    {choice.science ? <span className="crew-choice-effects">Research +{choice.science}</span> : null}
    {choice.damage ? <span className="crew-choice-effects">{choice.damageType} integrity −{choice.damage}</span> : null}
    {choice.policy ? <span className="crew-choice-effects">Ongoing policy: {typeof choice.policy === 'string' ? choice.policy : choice.policy.description ?? 'recorded operating constraint'}</span> : null}
  </>
}
