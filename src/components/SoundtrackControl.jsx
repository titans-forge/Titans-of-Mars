import { ExternalLink, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { loadMusicVolume, saveMusicVolume, soundtrackTrackIdForState, soundtrackTracks } from '../game/soundtrack.js'


export default function SoundtrackControl({ open, state, stats, onClose }) {
  const audioRef = useRef(null)
  const recommendedId = soundtrackTrackIdForState(state, stats)
  const previousRecommendedRef = useRef(recommendedId)
  const [trackIndex, setTrackIndex] = useState(() => Math.max(0, soundtrackTracks.findIndex((track) => track.id === recommendedId)))
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(() => loadMusicVolume(() => window.localStorage))
  const [playbackError, setPlaybackError] = useState('')
  const track = soundtrackTracks[trackIndex]

  useEffect(() => {
    if (previousRecommendedRef.current === recommendedId) return
    const nextIndex = soundtrackTracks.findIndex((candidate) => candidate.id === recommendedId)
    if (nextIndex >= 0) setTrackIndex(nextIndex)
    previousRecommendedRef.current = recommendedId
  }, [recommendedId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = track.src
    audio.load()
    setPlaybackError('')
    if (playing) audio.play().catch(() => {
      setPlaying(false)
      setPlaybackError('Playback was blocked by the browser.')
    })
  }, [track.src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = muted
    saveMusicVolume(() => window.localStorage, volume)
  }, [muted, volume])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    try {
      await audio.play()
      setPlaying(true)
      setPlaybackError('')
    } catch {
      setPlaybackError('Playback was blocked by the browser.')
    }
  }

  const changeTrack = (direction) => {
    setTrackIndex((current) => (current + direction + soundtrackTracks.length) % soundtrackTracks.length)
  }

  return (
    <>
      <audio ref={audioRef} loop preload="metadata" onError={() => setPlaybackError('This recording could not be loaded.')} />
      {open ? (
        <section className="soundtrack-panel" aria-label="Mars soundtrack controls">
          <div className="soundtrack-heading">
            <span>Mars Soundscape</span>
            <button onClick={onClose} title="Close soundtrack" aria-label="Close soundtrack"><X /></button>
          </div>
          <div className="soundtrack-now-playing" aria-live="polite">
            <strong>{track.title}</strong>
            <span>{track.composer} · {track.performer}</span>
            <small>{track.license}</small>
          </div>
          <div className="soundtrack-transport" aria-label="Playback controls">
            <button onClick={() => changeTrack(-1)} title="Previous recording" aria-label="Previous recording"><SkipBack /></button>
            <button className="play-command" onClick={togglePlayback} title={playing ? 'Pause music' : 'Play music'} aria-label={playing ? 'Pause music' : 'Play music'}>
              {playing ? <Pause /> : <Play />}
            </button>
            <button onClick={() => changeTrack(1)} title="Next recording" aria-label="Next recording"><SkipForward /></button>
            <button onClick={() => setMuted((current) => !current)} title={muted ? 'Unmute music' : 'Mute music'} aria-label={muted ? 'Unmute music' : 'Mute music'}>
              {muted ? <VolumeX /> : <Volume2 />}
            </button>
          </div>
          <label className="soundtrack-volume">
            <Volume2 aria-hidden="true" />
            <span>Volume</span>
            <input aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          </label>
          <a className="soundtrack-source" href={track.source} target="_blank" rel="noreferrer">Source and rights <ExternalLink /></a>
          {playbackError ? <p className="soundtrack-error" role="status">{playbackError}</p> : null}
        </section>
      ) : null}
    </>
  )
}
