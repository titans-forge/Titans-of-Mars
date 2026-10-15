import { Download, FolderOpen, X } from 'lucide-react'
import { useState } from 'react'

export default function SaveManagement({ status, onExport, onImport, onRecover, onNew, onClose }) {
  const [feedback, setFeedback] = useState('')
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="guide-modal save-management" role="dialog" aria-modal="true" aria-labelledby="save-title">
      <button className="modal-close" onClick={onClose} aria-label="Close saved missions"><X /></button>
      <h1 id="save-title">Saved Missions</h1>
      <p role="status">{status.message}</p>
      <p>Loading a mission always pauses time. Export a portable JSON file before resetting or switching browsers. A damaged save is retained for recovery until you explicitly start a new mission.</p>
      <div className="save-actions">
        <button onClick={onExport}><Download /> Export current mission</button>
        <label className="file-command"><FolderOpen /> Import mission JSON<input type="file" accept=".json,application/json" onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          try {
            if (file.size > 2_000_000) throw new Error('Choose a mission file smaller than 2 MB.')
            const result = onImport(await file.text())
            setFeedback(result.message)
          } catch (error) { setFeedback(error.message || 'Unable to read that file. Your current mission is unchanged.') }
          event.target.value = ''
        }} /></label>
        {status.backupAvailable ? <button onClick={() => { const result = onRecover(); setFeedback(result.message) }}>Recover previous good save</button> : null}
        {status.recoveryRaw ? <button onClick={() => onExport(status.recoveryRaw)}>Export damaged save for recovery</button> : null}
        <button onClick={onNew}>Start a new mission…</button>
      </div>
      {feedback ? <p role="status">{feedback}</p> : null}
      <button className="primary-command" onClick={onClose}>Return to paused command</button>
    </section>
  </div>
}
