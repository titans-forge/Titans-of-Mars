export const SAVE_KEY = 'titans-of-mars-first-city-v1'
export const MAX_SAVE_BYTES = 2 * 1024 * 1024

// Storage is injected for tests and resolved lazily because even reading the
// localStorage property can throw in private or embedded browser contexts.
export function createSavePersistence({ storage = () => globalThis.localStorage, key = SAVE_KEY, restore } = {}) {
  if (typeof restore !== 'function') throw new TypeError('A save restore function is required.')
  let loaded = false
  let blocked = false
  let recoveryRaw = null
  let backupRaw = null
  let sessionRaw = null
  const keys = { primary: key, backup: `${key}:backup`, recovery: `${key}:recovery` }
  const resolve = () => {
    try {
      const value = typeof storage === 'function' ? storage() : storage
      return value && typeof value.getItem === 'function' && typeof value.setItem === 'function' ? value : null
    } catch { return null }
  }
  const read = (store, slot) => {
    if (!store) return { ok: false, raw: null }
    try { const raw = store.getItem(slot); return { ok: true, raw: typeof raw === 'string' ? raw : null } } catch { return { ok: false, raw: null } }
  }
  const write = (store, slot, raw) => {
    if (!store) return false
    try { store.setItem(slot, raw); return true } catch { return false }
  }
  const decode = (raw) => {
    if (typeof raw !== 'string' || !raw.length || raw.length > MAX_SAVE_BYTES) return null
    try { const state = restore(raw); return state && typeof state === 'object' ? { ...state, speed: 0 } : null } catch { return null }
  }
  const result = (state, status, message) => ({ state, status, message, recoveryRaw, backupAvailable: Boolean(decode(backupRaw)) })
  const preserveRecovery = (store, raw) => {
    if (typeof raw !== 'string') return true
    const existing = read(store, keys.recovery)
    recoveryRaw = raw
    if (!existing.ok) return false
    if (existing.raw === raw) return true
    // Preserve the prior damaged slot too if a later bad import or outside
    // change produces another damaged primary. Never overwrite it silently.
    if (existing.raw !== null && !write(store, `${keys.recovery}:previous`, existing.raw)) return false
    return write(store, keys.recovery, raw)
  }
  function load() {
    loaded = true
    const store = resolve()
    const primary = read(store, keys.primary)
    const backup = read(store, keys.backup)
    const recovery = read(store, keys.recovery)
    if (decode(backup.raw)) backupRaw = backup.raw
    if (typeof recovery.raw === 'string') recoveryRaw = recovery.raw
    const state = decode(primary.raw)
    if (state) {
      sessionRaw = JSON.stringify(state)
      blocked = false
      return result(state, primary.ok && backup.ok && recovery.ok ? 'saved' : 'unavailable', primary.ok && backup.ok && recovery.ok ? 'Mission restored and paused.' : 'Mission restored and paused, but browser storage is unavailable. Export your mission to keep a copy.')
    }
    if (!primary.ok) {
      blocked = false
      return result(null, 'unavailable', 'Browser storage is unavailable. You can play and export a mission, but automatic saving is not available.')
    }
    if (primary.raw !== null) {
      recoveryRaw ??= primary.raw
      const preserved = preserveRecovery(store, primary.raw)
      blocked = true
      const previous = decode(backupRaw)
      if (previous) {
        sessionRaw = JSON.stringify(previous)
        // Do not replace the damaged primary unless its original was safely
        // copied. The in-memory original remains exportable either way.
        blocked = !preserved
        return result(previous, 'recovered', preserved ? 'A damaged save was preserved. The previous good mission has been restored and paused.' : 'The previous good mission is available and paused. Storage could not preserve the damaged original, so autosaving is held; export a copy before starting over.')
      }
      return result(null, 'corrupt', 'This save could not be loaded safely. Its original is preserved for export; import a good save or intentionally begin a new mission.')
    }
    blocked = false
    const previous = decode(backupRaw)
    if (previous) {
      sessionRaw = JSON.stringify(previous)
      return result(previous, 'recovered', 'The primary save is missing. The previous good mission has been restored and paused.')
    }
    return result(null, backup.ok && recovery.ok ? 'new' : 'unavailable', backup.ok && recovery.ok ? 'A new mission is ready.' : 'Browser storage is unavailable. Export your mission to keep a copy.')
  }
  function persist(state, intentional = false) {
    if (!loaded) load()
    let raw
    try { raw = JSON.stringify(state) } catch { return result(null, 'invalid', 'This mission contains invalid save data; the existing save was left untouched.') }
    const valid = decode(raw)
    if (!valid) return result(null, 'invalid', 'This mission failed its safety checks; the existing save was left untouched.')
    sessionRaw = raw
    if (blocked && !intentional) return result(state, 'corrupt', 'Autosaving is held to protect the damaged original. Export it, recover a backup, import a mission, or begin a new mission intentionally.')
    const store = resolve()
    const current = read(store, keys.primary)
    if (!current.ok) return result(state, 'unavailable', 'Browser storage is unavailable. Your mission is in memory only; export it before leaving.')
    if (current.raw !== null && !decode(current.raw)) {
      if (!preserveRecovery(store, current.raw)) {
        blocked = true
        return result(state, 'unsaved', 'The original save is safe in memory, but storage could not preserve it. Export your mission; automatic saving has not replaced the original.')
      }
    }
    if (current.raw !== null && current.raw !== raw && decode(current.raw)) {
      backupRaw = current.raw
      if (!write(store, keys.backup, backupRaw)) return result(state, 'unsaved', 'Storage is full or blocked. The previous mission is still intact; export your current mission to keep the new progress.')
    }
    if (!write(store, keys.primary, raw)) return result(state, 'unsaved', 'Storage is full or blocked. Your current mission is in memory only; export it before leaving.')
    blocked = false
    return result(state, 'saved', 'Mission saved on this device. Reloads always start paused.')
  }
  function importSave(raw) {
    const state = decode(raw)
    if (!state) return result(null, 'invalid', 'This file is not a supported, valid Titans of Mars save. The current mission was left untouched.')
    const saved = persist(state, true)
    return { ...saved, state }
  }
  function exportSave(state) {
    try {
      const raw = JSON.stringify(state ?? decode(sessionRaw))
      const valid = decode(raw)
      return valid ? JSON.stringify(valid, null, 2) : null
    } catch { return null }
  }
  function recoverBackup() {
    if (!loaded) load()
    const state = decode(backupRaw)
    if (!state) return result(null, 'invalid', 'No valid previous-good backup is available. The current save was left untouched.')
    const saved = persist(state, true)
    return { ...saved, state, message: saved.status === 'saved' ? 'Previous good mission recovered and paused. The replaced mission is available as the backup.' : saved.message }
  }
  function reset(state) {
    // Reset is an explicit player decision, but still uses the same backup and
    // recovery path rather than deleting the only copy of the prior mission.
    return persist({ ...state, speed: 0 }, true)
  }
  function discardRecovery() {
    const store = resolve()
    try {
      if (!store || typeof store.removeItem !== 'function') return result(null, 'unavailable', 'Browser storage is unavailable; the preserved original was not removed.')
      store.removeItem(keys.recovery)
      recoveryRaw = null
      return result(null, 'saved', 'The exported recovery copy has been discarded.')
    } catch { return result(null, 'unsaved', 'Storage did not allow the recovery copy to be removed.') }
  }
  return { load, save: (state) => persist(state), importSave, exportSave, recoverBackup, reset, discardRecovery }
}
