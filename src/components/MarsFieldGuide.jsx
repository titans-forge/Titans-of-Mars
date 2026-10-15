import { useRef, useState } from 'react'
import { BookOpen, ExternalLink, X } from 'lucide-react'
import { getMarsFieldGuideTopic, marsFieldGuideTopics } from '../game/marsFieldGuide.js'

export default function MarsFieldGuide({ onClose }) {
  const [activeId, setActiveId] = useState(marsFieldGuideTopics[0].id)
  const tabRefs = useRef([])
  const activeTopic = getMarsFieldGuideTopic(activeId)

  const moveSelection = (direction) => {
    const currentIndex = marsFieldGuideTopics.findIndex((topic) => topic.id === activeId)
    const nextIndex = (currentIndex + direction + marsFieldGuideTopics.length) % marsFieldGuideTopics.length
    setActiveId(marsFieldGuideTopics[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="modal-backdrop field-guide-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="field-guide" role="dialog" aria-modal="true" aria-labelledby="field-guide-title">
        <header className="field-guide-header">
          <BookOpen aria-hidden="true" />
          <div>
            <p>Science & mission history</p>
            <h1 id="field-guide-title">Mars Field Guide</h1>
          </div>
          <span><strong>{marsFieldGuideTopics.length}</strong> briefings</span>
        </header>
        <button className="modal-close" onClick={onClose} title="Close field guide" aria-label="Close field guide"><X /></button>

        <div className="field-guide-layout">
          <nav className="field-guide-tabs" role="tablist" aria-label="Mars field guide topics" onKeyDown={(event) => {
            if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              const index = event.key === 'Home' ? 0 : marsFieldGuideTopics.length - 1
              setActiveId(marsFieldGuideTopics[index].id)
              tabRefs.current[index]?.focus()
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
              event.preventDefault()
              moveSelection(1)
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
              event.preventDefault()
              moveSelection(-1)
            }
          }}>
            {marsFieldGuideTopics.map((topic, index) => (
              <button
                ref={(node) => { tabRefs.current[index] = node }}
                tabIndex={topic.id === activeId ? 0 : -1}
                key={topic.id}
                id={`field-guide-tab-${topic.id}`}
                className={topic.id === activeId ? 'active' : ''}
                role="tab"
                aria-selected={topic.id === activeId}
                aria-controls="field-guide-panel"
                onClick={() => setActiveId(topic.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{topic.label}</strong>
              </button>
            ))}
          </nav>

          <article id="field-guide-panel" className="field-guide-article" tabIndex={0} role="tabpanel" aria-labelledby={`field-guide-tab-${activeTopic.id}`}>
            <p className="field-guide-section">{activeTopic.section}</p>
            <h2>{activeTopic.title}</h2>
            <p className="field-guide-summary">{activeTopic.summary}</p>

            <div className="field-guide-facts">
              <h3>Field notes</h3>
              <ul>
                {activeTopic.facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            </div>

            <aside className="field-guide-colony-note">
              <span>Why it matters here</span>
              <p>{activeTopic.colonyNote}</p>
            </aside>

            <footer className="field-guide-sources">
              <span>Primary references</span>
              {activeTopic.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ExternalLink aria-hidden="true" /></a>
              ))}
            </footer>
          </article>
        </div>
      </section>
    </div>
  )
}
