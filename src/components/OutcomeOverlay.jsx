import { useState } from 'react'
import { Building2, Clipboard, Download, Eye, RotateCcw, ShieldAlert, TentTree } from 'lucide-react'
import { campaignReport, campaignShareText, downloadCampaignCard } from '../game/campaignReport.js'
import { colonyAssessment } from '../game/simulation.js'

const OUTCOMES = {
  'first-city': { icon: Building2, title: 'The First City Takes Root', body: (state) => `${state.settlementName} survived its first isolation crisis. Review actual reserve coverage and production below before planning the next stage.` },
  'dependent-outpost': { icon: TentTree, title: 'An Outpost on Earth’s Clock', body: 'The landing party reached its review with unresolved survival requirements. The engineering debrief identifies the missing margin.' },
  'permanent-city': { icon: Building2, title: 'Mars Keeps Its Own Clock', body: (state) => `${state.settlementName} passed the defined 30-sol life-support test. Some imported reserves may still matter: independence is graded separately from near-term survival.` },
  'fragile-city': { icon: TentTree, title: 'Expansion Without Margin', body: 'The settlement grew, but the Sol 42 review found unresolved operating or reserve constraints. Inspect the city and its causal debrief before starting another mission.' },
  failure: { icon: ShieldAlert, title: (state) => `${state.settlementName} Lost`, body: 'Cascading shortages overwhelmed the settlement. Review the final resource flows and mission log to identify the first repair to the plan.' },
}

export default function OutcomeOverlay({ outcome, state, objectives, onReset, onInspect, onExport }) {
  const [feedback, setFeedback] = useState('')
  if (!outcome) return null
  const result = OUTCOMES[outcome] ?? OUTCOMES.failure
  const Icon = result.icon
  let title = typeof result.title === 'function' ? result.title(state) : result.title
  let body = typeof result.body === 'function' ? result.body(state) : result.body
  const completed = objectives.filter((objective) => objective.complete).length
  const report = campaignReport(state, objectives)
  const assessment = colonyAssessment(state)
  if (outcome === 'permanent-city' && !assessment.viable) {
    title = 'Saved City · Review Required'
    body = 'This save records a permanent-city result. Its current operating forecast does not pass the updated rules; the original campaign is retained, with current shortcomings shown below.'
  }
  const copySummary = async () => {
    try { await navigator.clipboard.writeText(campaignShareText(state, report)); setFeedback('Campaign summary copied.') }
    catch { setFeedback('Clipboard access was unavailable. Export the mission or result card instead.') }
  }
  return <div className="outcome-backdrop"><section className="outcome-panel" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
    <Icon aria-hidden="true" /><p>Mission Audit · Sol {state.sol}</p><h1 id="outcome-title">{title}</h1><blockquote>{body}</blockquote>
    <div className="outcome-scores"><div className="profile-score"><span>Colony profile</span><strong>{report.profile}</strong></div><div className="profile-score"><span>Mars order</span><strong>{report.order.title}</strong></div><div><span>Overall</span><strong>{report.overallGrade}</strong><small>{report.overall}/100</small></div></div>
    <p className="mars-order-summary">{report.overallExplanation}</p>
    <div className="campaign-grades">{report.grades.map((item) => <div key={item.id} title={item.explanation ?? item.reason ?? ''}><span>{item.label}</span><strong>{item.grade}</strong><small>{item.score}/100</small>{item.explanation || item.reason ? <p>{item.explanation ?? item.reason}</p> : null}</div>)}</div>
    <p className="mars-order-summary">{report.order.summary} {completed}/{objectives.length} final objectives completed.</p>
    <section className="engineering-debrief"><h2>Engineering debrief</h2><p>{assessment.horizon}-sol projection: {assessment.viable ? 'essential reserves remain viable' : 'one or more survival requirements fail'}. {assessment.independent ? 'Life-support production is balanced.' : 'Stored supplies or outside support still matter.'}</p><ul>{assessment.checks.map((check) => <li key={check.id}><strong>{check.complete ? '✓' : 'Needs work'} · {check.label}</strong><span>{check.reason}</span></li>)}</ul>{assessment.constraints.length ? <p>Improve next: {assessment.constraints.join(' ')}</p> : null}<small>Projection retains current assignments while crew condition and funded construction progress, without new building orders, incidents or deliveries; it is a game scenario, not an engineering certification.</small></section>
    {state.decisionLog?.length ? <details className="campaign-chronicle"><summary>Campaign chronicle · {state.decisionLog.length} entries</summary><ol>{state.decisionLog.map((entry, index) => <li key={`${entry.sol}-${index}`}><time>Sol {entry.sol}</time><span><strong>{entry.title}</strong>{entry.choice}</span></li>)}</ol></details> : null}
    <div className="outcome-actions"><button onClick={onInspect}><Eye /> Inspect colony</button><button onClick={onExport}><Download /> Export mission</button><button onClick={copySummary}><Clipboard /> Copy result</button><button onClick={async () => { try { await downloadCampaignCard(state, report); setFeedback('Result card prepared. Check browser downloads.') } catch { setFeedback('Result card could not be prepared. Your mission remains available.') } }}><Download /> Result card</button><button className="primary-command" onClick={onReset}><RotateCcw /> Begin another mission</button></div>
    {feedback ? <p role="status">{feedback}</p> : null}
  </section></div>
}
