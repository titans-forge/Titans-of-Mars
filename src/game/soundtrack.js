export const soundtrackTracks = [
  {
    id: 'bach-aria',
    title: 'Goldberg Variations: Aria',
    composer: 'Johann Sebastian Bach',
    performer: 'Kimiko Ishizaka',
    license: 'CC0 1.0 Universal',
    src: './audio/bach-goldberg-aria.mp3',
    source: 'https://freemusicarchive.org/music/Kimiko_Ishizaka/The_Open_Goldberg_Variations/KIMIKO_ISHIZAKA_-_Goldberg_Variations_BWV_988_-_01_-_Aria__44k-24b/',
  },
  {
    id: 'handel-sarabande',
    title: 'Water Music: Sarabande',
    composer: 'George Frideric Handel',
    performer: 'United States Marine Band, Marine Chamber Orchestra',
    license: 'Public domain - U.S. federal work',
    src: './audio/handel-water-music-sarabande.mp3',
    source: "https://commons.wikimedia.org/wiki/File:Handel's_Water_Music_-_16._Sarabande_-_Chamber_Orchestra_-_United_States_Marine_Band.opus",
  },
  {
    id: 'holst-venus',
    title: 'Venus, the Bringer of Peace',
    composer: 'Gustav Holst',
    performer: 'United States Air Force Heritage of America Band',
    license: 'Public domain - U.S. federal work',
    src: './audio/holst-venus.mp3',
    source: 'https://commons.wikimedia.org/wiki/File:Holst-_venus.ogg',
  },
  {
    id: 'holst-mars',
    title: 'Mars, the Bringer of War',
    composer: 'Gustav Holst',
    performer: 'United States Air Force Heritage of America Band',
    license: 'Public domain - U.S. federal work',
    src: './audio/holst-mars.mp3',
    source: 'https://commons.wikimedia.org/wiki/File:Holst-_mars.ogg',
  },
]

export function parseStoredVolume(value) {
  if (value === null || value === '') return 0.24
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.24
}

export function soundtrackTrackIdForState(state, stats) {
  if (stats?.storm || stats?.debris) return 'holst-mars'
  if (state?.pendingEventId || state?.pendingRivalEncounterId || state?.pendingOperationalIncidentId || state?.transferWindowPending) return 'handel-sarabande'
  if (state?.phase === 'expansion') return 'holst-venus'
  return 'bach-aria'
}

// Music preferences are optional. Blocked/quota-limited storage must not stop play.
export function loadMusicVolume(storage) {
  try { return parseStoredVolume(storage().getItem('titans-of-mars-music-volume')) }
  catch { return parseStoredVolume(null) }
}
export function saveMusicVolume(storage, volume) {
  try { storage().setItem('titans-of-mars-music-volume', String(volume)); return true }
  catch { return false }
}
