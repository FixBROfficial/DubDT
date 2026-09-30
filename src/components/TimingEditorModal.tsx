import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { DialogueLine } from '../types'
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Magnet,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react'

interface TimingEditorModalProps {
  isOpen: boolean
  onClose: () => void
  videoMediaUrl: string | null
  videoName: string | null
  lines: DialogueLine[]
  setLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>
  customBgMediaUrl?: string | null
}

const LAYER_COLORS = [
  { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', active: 'bg-emerald-500/35 border-emerald-400', text: 'text-emerald-300', dot: 'bg-emerald-400', badgePos: 'bg-amber-950 text-amber-300 border-amber-600/60', badgeNeg: 'bg-cyan-950 text-cyan-300 border-cyan-600/60' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', active: 'bg-cyan-500/35 border-cyan-400', text: 'text-cyan-300', dot: 'bg-cyan-400', badgePos: 'bg-amber-950 text-amber-300 border-amber-600/60', badgeNeg: 'bg-cyan-950 text-cyan-300 border-cyan-600/60' },
  { bg: 'bg-indigo-500/20', border: 'border-indigo-500/50', active: 'bg-indigo-500/35 border-indigo-400', text: 'text-indigo-300', dot: 'bg-indigo-400', badgePos: 'bg-amber-950 text-amber-300 border-amber-600/60', badgeNeg: 'bg-cyan-950 text-cyan-300 border-cyan-600/60' },
  { bg: 'bg-amber-500/20', border: 'border-amber-500/50', active: 'bg-amber-500/35 border-amber-400', text: 'text-amber-300', dot: 'bg-amber-400', badgePos: 'bg-amber-950 text-amber-300 border-amber-600/60', badgeNeg: 'bg-cyan-950 text-cyan-300 border-cyan-600/60' },
  { bg: 'bg-rose-500/20', border: 'border-rose-500/50', active: 'bg-rose-500/35 border-rose-400', text: 'text-rose-300', dot: 'bg-rose-400', badgePos: 'bg-amber-950 text-amber-300 border-amber-600/60', badgeNeg: 'bg-cyan-950 text-cyan-300 border-cyan-600/60' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500/50', active: 'bg-purple-500/35 border-purple-400', text: 'text-purple-300', dot: 'bg-purple-400', badgePos: 'bg-amber-950 text-amber-300 border-amber-600/60', badgeNeg: 'bg-cyan-950 text-cyan-300 border-cyan-600/60' },
]

const formatTime = (sec: number) => {
  if (isNaN(sec) || sec < 0) return '00:00.000'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

// =========================================================================
// HIGH-PERFORMANCE MEMOIZED AUDIO BLOCK COMPONENT
// =========================================================================
interface AudioBlockProps {
  line: DialogueLine
  index: number
  pxPerSec: number
  layerColor: (typeof LAYER_COLORS)[0]
  isSelected: boolean
  snapToGrid: boolean
  onSelect: (id: string) => void
  onCommitOffset: (id: string, newOffset: number) => void
  onScrubVideo: (time: number) => void
}

const AudioBlock = memo<AudioBlockProps>(({
  line,
  index,
  pxPerSec,
  layerColor,
  isSelected,
  snapToGrid,
  onSelect,
  onCommitOffset,
  onScrubVideo,
}) => {
  const blockRef = useRef<HTMLDivElement | null>(null)
  const badgeRef = useRef<HTMLSpanElement | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const initialOffsetRef = useRef<number>(0)
  const currentOffsetRef = useRef<number>(line.audioOffset || 0)

  const activeTake = line.takes && line.takes[line.activeTakeIndex || 0] || line.takes?.[0]
  const hasTake = Boolean(activeTake)
  const offset = line.audioOffset || 0

  // Calculate real duration
  const durationSec = (activeTake && activeTake.duration && activeTake.duration > 0)
    ? activeTake.duration
    : Math.max(0.5, line.endTime - line.startTime)

  const rawStart = (line.startTime || 0) + offset
  const baseLeftPx = rawStart * pxPerSec
  const blockWidthPx = Math.max(45, durationSec * pxPerSec)

  const originalLeftPx = line.startTime * pxPerSec
  const originalWidthPx = Math.max(45, (line.endTime - line.startTime) * pxPerSec)

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    const target = blockRef.current
    if (!target) return

    try {
      target.setPointerCapture(e.pointerId)
    } catch {}

    isDraggingRef.current = true
    startXRef.current = e.clientX
    initialOffsetRef.current = line.audioOffset || 0
    currentOffsetRef.current = initialOffsetRef.current

    onSelect(line.id)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !blockRef.current) return
    e.stopPropagation()

    const deltaX = e.clientX - startXRef.current
    let deltaSec = deltaX / pxPerSec
    let newOffset = initialOffsetRef.current + deltaSec

    if (snapToGrid) {
      if (Math.abs(newOffset) < 0.04) {
        newOffset = 0
      } else {
        newOffset = Math.round(newOffset / 0.02) * 0.02
      }
    }
    newOffset = parseFloat(newOffset.toFixed(3))
    currentOffsetRef.current = newOffset

    // Direct DOM translation for 120 FPS silky-smooth response without React re-renders
    const visualDeltaPx = (newOffset - (line.audioOffset || 0)) * pxPerSec
    blockRef.current.style.transform = `translateX(${visualDeltaPx}px)`

    // Update offset badge text immediately in DOM
    if (badgeRef.current) {
      const ms = Math.round(newOffset * 1000)
      badgeRef.current.textContent = newOffset > 0 ? `+${ms}ms` : `${ms}ms`
      badgeRef.current.className = `text-[9px] font-mono px-1 rounded shrink-0 font-semibold ${
        newOffset !== 0
          ? newOffset > 0
            ? 'bg-amber-950 text-amber-300 border border-amber-600/60'
            : 'bg-cyan-950 text-cyan-300 border border-cyan-600/60'
          : 'text-zinc-500 bg-black/40'
      }`
    }

    // Scrub video to effective start time
    const effStart = Math.max(0, line.startTime + newOffset)
    onScrubVideo(effStart)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    e.stopPropagation()
    isDraggingRef.current = false

    if (blockRef.current) {
      try {
        blockRef.current.releasePointerCapture(e.pointerId)
      } catch {}
      blockRef.current.style.transform = ''
    }

    const finalOffset = currentOffsetRef.current
    onCommitOffset(line.id, finalOffset)
  }

  // Precomputed waveform bars count
  const barCount = Math.min(24, Math.max(4, Math.floor(blockWidthPx / 6)))

  return (
    <React.Fragment>
      {/* Ghost indicator of original timestamp position if offset != 0 */}
      {offset !== 0 && (
        <div
          style={{
            left: `${originalLeftPx}px`,
            width: `${originalWidthPx}px`,
          }}
          className="absolute top-2 bottom-2 rounded border border-dashed border-zinc-700/60 bg-zinc-800/10 pointer-events-none z-0 flex items-center justify-center select-none"
          title={`Timestamp original: ${formatTime(line.startTime)}`}
        >
          <span className="text-[9px] font-mono text-zinc-500">Original</span>
        </div>
      )}

      {/* Interactive Draggable Audio Block */}
      <div
        ref={blockRef}
        style={{
          left: `${baseLeftPx}px`,
          width: `${blockWidthPx}px`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(line.id)
        }}
        className={`absolute top-1.5 bottom-1.5 rounded-md border flex flex-col justify-between p-1.5 cursor-grab active:cursor-grabbing transition-shadow z-10 select-none will-change-transform ${
          hasTake
            ? isSelected
              ? `${layerColor.bg} border-white shadow-lg ring-1 ring-white/50`
              : `${layerColor.bg} ${layerColor.border} hover:border-zinc-400`
            : 'bg-zinc-800/30 border-zinc-700/40 opacity-50'
        }`}
        title={`#${index + 1}: "${line.text}" | Arraste horizontalmente para sincronizar`}
      >
        {/* Block Header */}
        <div className="flex items-center justify-between w-full pointer-events-none">
          <span className="text-[10px] font-mono font-medium text-white truncate max-w-[65%]">
            #{index + 1} {hasTake ? `• T${(line.activeTakeIndex || 0) + 1}` : '(Sem take)'}
          </span>

          {/* Offset Badge */}
          <span
            ref={badgeRef}
            className={`text-[9px] font-mono px-1 rounded shrink-0 ${
              offset !== 0
                ? offset > 0
                  ? 'bg-amber-950 text-amber-300 border border-amber-600/60 font-semibold'
                  : 'bg-cyan-950 text-cyan-300 border border-cyan-600/60 font-semibold'
                : 'text-zinc-500 bg-black/40'
            }`}
          >
            {offset !== 0
              ? offset > 0
                ? `+${Math.round(offset * 1000)}ms`
                : `${Math.round(offset * 1000)}ms`
              : '0ms'}
          </span>
        </div>

        {/* Text Snippet */}
        <div className="text-[10px] text-zinc-300 truncate font-sans pointer-events-none mt-0.5">
          "{line.text}"
        </div>

        {/* Waveform Bars (Static Pattern for Max Rendering Speed) */}
        <div className="flex items-end gap-0.5 h-2 w-full opacity-60 pointer-events-none overflow-hidden mt-0.5">
          {Array.from({ length: barCount }).map((_, barIdx) => {
            const h = 30 + ((barIdx * 37) % 65)
            return (
              <div
                key={barIdx}
                style={{ height: `${h}%` }}
                className={`w-1 rounded-full ${hasTake ? 'bg-white/80' : 'bg-zinc-600'}`}
              />
            )
          })}
        </div>
      </div>
    </React.Fragment>
  )
})
AudioBlock.displayName = 'AudioBlock'

// =========================================================================
// MAIN TIMING EDITOR MODAL
// =========================================================================
export const TimingEditorModal: React.FC<TimingEditorModalProps> = ({
  isOpen,
  onClose,
  videoMediaUrl,
  videoName,
  lines,
  setLines,
  customBgMediaUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const timelineScrollRef = useRef<HTMLDivElement | null>(null)
  const playheadRef = useRef<HTMLDivElement | null>(null)
  const timecodeCurrentRef = useRef<HTMLSpanElement | null>(null)
  const activePlayersRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const rafIdRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [duration, setDuration] = useState<number>(0)
  const [pxPerSec, setPxPerSec] = useState<number>(90) // pixels per second zoom level
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true)
  const [volume, setVolume] = useState<number>(1.0)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)

  // Current subtitle text to avoid continuous re-rendering
  const [activeSubtitle, setActiveSubtitle] = useState<{ id: string; layer: number; text: string; offset: number } | null>(null)

  const stopAllTakeAudios = useCallback(() => {
    activePlayersRef.current.forEach((audio) => {
      try {
        audio.pause()
        audio.src = ''
      } catch (e) {}
    })
    activePlayersRef.current.clear()
  }, [])

  // Close & cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause()
      if (bgAudioRef.current && !bgAudioRef.current.paused) bgAudioRef.current.pause()
      stopAllTakeAudios()
      setIsPlaying(false)
      setSelectedLineId(null)
      setActiveSubtitle(null)
    }
  }, [isOpen, stopAllTakeAudios])

  // Extract all unique layers that exist
  const uniqueLayers = useMemo(() => {
    const layers = Array.from(new Set(lines.map((l) => l.layer || 1))).sort((a, b) => a - b)
    return layers.length > 0 ? layers : [1]
  }, [lines])

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (!videoRef.current.paused) {
      videoRef.current.pause()
      if (bgAudioRef.current && !bgAudioRef.current.paused) bgAudioRef.current.pause()
      activePlayersRef.current.forEach((p) => {
        try { p.pause() } catch (e) {}
      })
      setIsPlaying(false)
    } else {
      if (videoRef.current.ended || (duration > 0 && videoRef.current.currentTime >= duration - 0.1)) {
        videoRef.current.currentTime = 0
        if (bgAudioRef.current) bgAudioRef.current.currentTime = 0
      }
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
          if (bgAudioRef.current && customBgMediaUrl && bgAudioRef.current.paused) {
            bgAudioRef.current.play().catch(() => {})
          }
        })
        .catch(console.error)
    }
  }, [duration, customBgMediaUrl])

  // Spacebar and Arrow Keys inside Timing Editor (Stop propagation so Step 3 doesn't fire!)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        togglePlay()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        if (videoRef.current) {
          const step = e.shiftKey ? 1.0 : 0.05
          handleSeek(Math.max(0, videoRef.current.currentTime - step))
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        if (videoRef.current) {
          const step = e.shiftKey ? 1.0 : 0.05
          handleSeek(Math.min(duration, videoRef.current.currentTime + step))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, togglePlay, duration])

  // =========================================================================
  // HIGH-PERFORMANCE PLAYHEAD RAF ANIMATION LOOP (Runs at native 60/120Hz without React re-renders)
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return

    let lastSubCheck = 0

    const animLoop = () => {
      if (videoRef.current) {
        const vTime = videoRef.current.currentTime

        // 1. Move playhead directly in DOM
        if (playheadRef.current) {
          playheadRef.current.style.transform = `translateX(${vTime * pxPerSec}px)`
        }

        // 2. Update timecode readout in DOM
        if (timecodeCurrentRef.current) {
          timecodeCurrentRef.current.textContent = formatTime(vTime)
        }

        // 3. Subtitle check throttled to 5 times/sec
        const now = performance.now()
        if (now - lastSubCheck > 200) {
          lastSubCheck = now
          const active = lines.find((l) => {
            const rawStart = (l.startTime || 0) + (l.audioOffset || 0)
            const effEnd = rawStart + Math.max(0.5, l.endTime - l.startTime)
            return vTime >= rawStart && vTime <= effEnd
          })
          if (active) {
            setActiveSubtitle({
              id: active.id,
              layer: active.layer || 1,
              text: active.text,
              offset: active.audioOffset || 0,
            })
          } else {
            setActiveSubtitle(null)
          }
        }
      }

      if (isPlaying) {
        rafIdRef.current = requestAnimationFrame(animLoop)
      }
    }

    if (isPlaying) {
      rafIdRef.current = requestAnimationFrame(animLoop)
    }

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [isPlaying, isOpen, pxPerSec, lines])

  // Sync Audio Playback during preview without cutting off negative offsets
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const vTime = videoRef.current.currentTime

    // Sync BG audio if present
    if (bgAudioRef.current && customBgMediaUrl) {
      if (!videoRef.current.paused) {
        if (bgAudioRef.current.paused) bgAudioRef.current.play().catch(() => {})
        if (Math.abs(bgAudioRef.current.currentTime - vTime) > 0.15) {
          bgAudioRef.current.currentTime = vTime
        }
      } else {
        if (!bgAudioRef.current.paused) bgAudioRef.current.pause()
      }
    }

    // Active lines calculation:
    // Respects rawStart and allows generous tail headroom so speech endings are never cut off!
    const activeLines = lines.filter((l) => {
      const rawStart = (l.startTime || 0) + (l.audioOffset || 0)
      const effectiveStart = Math.max(0, rawStart)
      const activeTake = l.takes ? (l.takes[l.activeTakeIndex || 0] || l.takes[0]) : null
      if (!activeTake) return false

      const existingPlayer = activePlayersRef.current.get(l.id)
      const playerDur = (existingPlayer && !isNaN(existingPlayer.duration) && existingPlayer.duration > 0)
        ? existingPlayer.duration
        : 0
      const takeDur = Math.max(playerDur, activeTake.duration || 0, l.endTime - l.startTime)
      const effectiveEnd = rawStart + takeDur + 1.5

      return vTime >= effectiveStart && vTime <= effectiveEnd && l.takes.length > 0
    })

    const activeLineIds = new Set(activeLines.map((l) => l.id))

    // Stop inactive players
    activePlayersRef.current.forEach((audio, lineId) => {
      if (!activeLineIds.has(lineId)) {
        try {
          audio.pause()
          audio.src = ''
        } catch (e) {}
        activePlayersRef.current.delete(lineId)
      }
    })

    // Start/sync active lines
    activeLines.forEach((line) => {
      const activeTake = line.takes[line.activeTakeIndex || 0] || line.takes[0]
      if (!activeTake) return

      const takeSrc =
        activeTake.audioBlobUrl ||
        (window.electronAPI ? window.electronAPI.convertToMediaUrl(activeTake.filePath) : '')
      if (!takeSrc) return

      const rawStart = (line.startTime || 0) + (line.audioOffset || 0)
      const takeProgress = Math.max(0, vTime - rawStart)

      let player = activePlayersRef.current.get(line.id)
      if (!player) {
        player = new Audio(takeSrc)
        player.volume = isMuted ? 0 : volume
        player.currentTime = takeProgress
        player.onended = () => {
          activePlayersRef.current.delete(line.id)
        }
        activePlayersRef.current.set(line.id, player)
        if (!videoRef.current?.paused) {
          player.play().catch(() => {})
        }
      } else {
        player.volume = isMuted ? 0 : volume
        const maxDur = (!isNaN(player.duration) && player.duration > 0) ? player.duration : 999
        if (!videoRef.current?.paused) {
          if (player.paused && takeProgress < maxDur) {
            player.currentTime = takeProgress
            player.play().catch(() => {})
          } else if (Math.abs(player.currentTime - takeProgress) > 0.25 && takeProgress < maxDur) {
            player.currentTime = takeProgress
          }
        } else {
          if (!player.paused) player.pause()
        }
      }
    })
  }

  // Handle Seeking
  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(duration || 1000, newTime))
    if (videoRef.current) {
      videoRef.current.currentTime = clamped
    }
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${clamped * pxPerSec}px)`
    }
    if (timecodeCurrentRef.current) {
      timecodeCurrentRef.current.textContent = formatTime(clamped)
    }
  }

  // Adjust line offset by delta (+0.05, -0.05, etc.)
  const handleAdjustOffset = useCallback((lineId: string, deltaSeconds: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const current = l.audioOffset || 0
        const updated = parseFloat((current + deltaSeconds).toFixed(3))
        return { ...l, audioOffset: updated }
      })
    )
  }, [setLines])

  const handleResetOffset = useCallback((lineId: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, audioOffset: 0 } : l))
    )
  }, [setLines])

  const handleResetAllOffsets = useCallback(() => {
    const hasAnyOffset = lines.some((l) => (l.audioOffset || 0) !== 0)
    if (!hasAnyOffset) return
    const confirmReset = window.confirm(
      'Deseja resetar a sincronia (offsets) de TODAS as falas de volta aos timestamps originais?'
    )
    if (!confirmReset) return

    setLines((prev) =>
      prev.map((l) => ({ ...l, audioOffset: 0 }))
    )
  }, [lines, setLines])

  const handleCommitOffset = useCallback((lineId: string, newOffset: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, audioOffset: newOffset } : l))
    )
  }, [setLines])

  const handleScrubVideo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${time * pxPerSec}px)`
      }
      if (timecodeCurrentRef.current) {
        timecodeCurrentRef.current.textContent = formatTime(time)
      }
    }
  }, [pxPerSec])

  // Timeline length in pixels
  const timelineDuration = useMemo(() => {
    return Math.max(duration || 10, ...lines.map((l) => (l.endTime || 0) + 5))
  }, [duration, lines])

  const timelineWidthPx = Math.max(1200, timelineDuration * pxPerSec)

  // Smart Adaptive Ruler Ticks (Spaced nicely so DOM size is strictly capped at ~40-100 ticks)
  const rulerTicks = useMemo(() => {
    const ticks: number[] = []
    let step = 1
    if (pxPerSec < 40) step = 10
    else if (pxPerSec < 75) step = 5
    else if (pxPerSec < 130) step = 2
    else step = 1

    for (let s = 0; s <= timelineDuration; s += step) {
      ticks.push(s)
    }
    return ticks
  }, [timelineDuration, pxPerSec])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 select-none">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      {/* Main Modal Window */}
      <div className="relative w-full h-[96vh] max-w-[98vw] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-100">
        {/* ========================================================================= */}
        {/* HEADER BAR */}
        {/* ========================================================================= */}
        <div className="px-4 py-2 bg-black border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-semibold text-white tracking-wide uppercase">
                  Timing Editor (Sincronia de Vozes)
                </h2>
                <span className="text-[10px] bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono px-1.5 py-0.5 rounded">
                  Multi-Camadas
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Arraste os blocos na timeline para alinhar a voz com a boca. Os timestamps da aba 1 permanecem originais.
              </p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2.5">
            {/* Snap Toggle */}
            <button
              onClick={() => setSnapToGrid((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                snapToGrid
                  ? 'bg-zinc-800 border-zinc-600 text-white'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Alinhamento magnético inteligente de 20ms"
            >
              <Magnet className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px]">Snap Magnético</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5">
              <button
                onClick={() => setPxPerSec((prev) => Math.max(40, prev - 25))}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-zinc-400 w-12 text-center">
                {pxPerSec}px/s
              </span>
              <button
                onClick={() => setPxPerSec((prev) => Math.min(250, prev + 25))}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reset All Offsets */}
            <button
              onClick={handleResetAllOffsets}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded transition-colors"
              title="Resetar todas as falas de volta aos timestamps originais (Offset 0s)"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="text-[11px]">Resetar Offsets</span>
            </button>

            {/* Close / Confirm */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded shadow transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Concluir</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* UPPER MONITOR: VIDEO PLAYER & TRANSPORT */}
        {/* ========================================================================= */}
        <div className="bg-black/95 border-b border-zinc-800/80 flex flex-col items-center justify-center relative shrink-0">
          <div className="relative w-full max-w-2xl max-h-[220px] sm:max-h-[240px] flex items-center justify-center bg-black overflow-hidden">
            {videoMediaUrl ? (
              <video
                ref={videoRef}
                src={videoMediaUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  if (videoRef.current) setDuration(videoRef.current.duration || 0)
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
                className="max-h-[220px] sm:max-h-[240px] w-auto max-w-full object-contain cursor-pointer"
              />
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">Nenhum vídeo conectado</div>
            )}

            {/* Synced M&E Background Audio */}
            {customBgMediaUrl && <audio ref={bgAudioRef} src={customBgMediaUrl} preload="auto" />}

            {/* Subtitle Overlay with Live Offset Badge */}
            {activeSubtitle && (
              <div className="absolute bottom-2 inset-x-4 flex flex-col items-center gap-1 pointer-events-none z-10 animate-in fade-in duration-75">
                <div className="inline-flex items-center gap-2 bg-black/85 backdrop-blur-md text-yellow-300 font-medium px-3 py-0.5 rounded text-xs border border-yellow-500/30 shadow-2xl max-w-xl">
                  <span className="font-mono text-[9px] text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded">
                    C{activeSubtitle.layer}
                  </span>
                  <span className="truncate">"{activeSubtitle.text}"</span>
                  {activeSubtitle.offset !== 0 && (
                    <span className={`text-[10px] font-mono px-1 rounded ${activeSubtitle.offset > 0 ? 'bg-amber-950 text-amber-300 border border-amber-700/60' : 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'}`}>
                      {activeSubtitle.offset > 0 ? `+${Math.round(activeSubtitle.offset * 1000)}ms` : `${Math.round(activeSubtitle.offset * 1000)}ms`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Transport Controls Bar */}
          <div className="w-full px-4 py-1.5 bg-[#09090b] border-t border-zinc-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 bg-white hover:bg-zinc-200 text-black rounded transition-colors cursor-pointer"
                title={isPlaying ? 'Pausar (Espaço)' : 'Tocar (Espaço)'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    handleSeek(Math.max(0, videoRef.current.currentTime - 0.05))
                  }
                }}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                title="Voltar 1 frame / 50ms (Seta Esquerda)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    handleSeek(Math.min(duration, videoRef.current.currentTime + 0.05))
                  }
                }}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                title="Avançar 1 frame / 50ms (Seta Direita)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleSeek(0)}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                title="Ir para o início"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-zinc-300 text-xs ml-2">
                <span ref={timecodeCurrentRef} className="text-white font-medium">00:00.000</span> /{' '}
                <span className="text-zinc-500">{formatTime(duration)}</span>
              </span>
            </div>

            {/* Selected Line Quick Offset Micro-adjuster */}
            {selectedLineId && (() => {
              const selLine = lines.find((l) => l.id === selectedLineId)
              if (!selLine) return null
              const off = selLine.audioOffset || 0
              return (
                <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700/80 px-2 py-0.5 rounded text-[11px] animate-in fade-in">
                  <span className="text-zinc-400">Ajuste Fino Fala #{lines.indexOf(selLine) + 1}:</span>
                  <button
                    onClick={() => handleAdjustOffset(selLine.id, -0.05)}
                    className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-mono text-[10px]"
                    title="Adiantar 50ms"
                  >
                    -50ms
                  </button>
                  <button
                    onClick={() => handleAdjustOffset(selLine.id, -0.01)}
                    className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-mono text-[10px]"
                    title="Adiantar 10ms"
                  >
                    -10ms
                  </button>
                  <span className={`font-mono font-medium px-1 rounded ${off !== 0 ? (off > 0 ? 'text-amber-400' : 'text-cyan-400') : 'text-zinc-300'}`}>
                    {off > 0 ? `+${Math.round(off * 1000)}ms` : `${Math.round(off * 1000)}ms`}
                  </span>
                  <button
                    onClick={() => handleAdjustOffset(selLine.id, 0.01)}
                    className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-mono text-[10px]"
                    title="Atrasar 10ms"
                  >
                    +10ms
                  </button>
                  <button
                    onClick={() => handleAdjustOffset(selLine.id, 0.05)}
                    className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-mono text-[10px]"
                    title="Atrasar 50ms"
                  >
                    +50ms
                  </button>
                  {off !== 0 && (
                    <button
                      onClick={() => handleResetOffset(selLine.id)}
                      className="p-0.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded ml-1"
                      title="Resetar para 0s"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted((prev) => !prev)}
                className="text-zinc-400 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value))
                  setIsMuted(false)
                }}
                className="w-16 h-1 accent-white"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LOWER SECTION: MULTI-TRACK DAW TIMELINE */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0c0e]">
          {/* Scrollable Timeline Area */}
          <div
            ref={timelineScrollRef}
            className="flex-1 overflow-x-auto overflow-y-auto relative flex flex-col"
          >
            {/* Master Grid Container */}
            <div style={{ width: `${timelineWidthPx}px` }} className="relative flex flex-col min-w-full">
              {/* --- TIME RULER --- */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickX = e.clientX - rect.left
                  const clickedTime = clickX / pxPerSec
                  handleSeek(clickedTime)
                }}
                className="h-7 bg-zinc-950 border-b border-zinc-800/80 sticky top-0 z-30 flex items-center cursor-pointer select-none"
              >
                {rulerTicks.map((sec) => (
                  <div
                    key={sec}
                    style={{ left: `${sec * pxPerSec}px` }}
                    className="absolute top-0 bottom-0 border-l border-zinc-800 flex flex-col justify-end pb-0.5 pl-1 pointer-events-none"
                  >
                    <span className="text-[9px] font-mono text-zinc-500">
                      {Math.floor(sec / 60)}:{String(Math.floor(sec % 60)).padStart(2, '0')}
                    </span>
                  </div>
                ))}

                {/* Vertical Playhead Cursor (Optimized Direct GPU Transform) */}
                <div
                  ref={playheadRef}
                  style={{ left: 0, transform: 'translateX(0px)' }}
                  className="absolute top-0 bottom-[-9999px] w-0.5 bg-red-500 z-40 pointer-events-none will-change-transform"
                >
                  <div className="w-3 h-3 bg-red-500 rotate-45 -ml-[5px] -mt-1 shadow-md" />
                </div>
              </div>

              {/* --- TRACK LANES (One per Layer) --- */}
              <div className="flex flex-col relative py-2 space-y-2">
                {uniqueLayers.map((layerNum) => {
                  const layerColor = LAYER_COLORS[(layerNum - 1) % LAYER_COLORS.length]
                  const layerLines = lines.filter((l) => (l.layer || 1) === layerNum)

                  return (
                    <div
                      key={layerNum}
                      className="relative h-20 bg-zinc-900/30 border-y border-zinc-800/40 flex items-center"
                    >
                      {/* Sticky Track Info on Left */}
                      <div className="sticky left-0 z-20 h-full w-28 bg-[#111114]/95 border-r border-zinc-800 flex flex-col justify-center px-2.5 shrink-0 shadow-md">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${layerColor.dot}`} />
                          <span className="text-xs font-semibold text-white">
                            Camada {layerNum}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {layerLines.filter((l) => l.takes && l.takes.length > 0).length} gravadas
                        </span>
                      </div>

                      {/* Track Lane Blocks */}
                      <div className="relative h-full flex-1">
                        {layerLines.map((line) => (
                          <AudioBlock
                            key={line.id}
                            line={line}
                            index={lines.indexOf(line)}
                            pxPerSec={pxPerSec}
                            layerColor={layerColor}
                            isSelected={selectedLineId === line.id}
                            snapToGrid={snapToGrid}
                            onSelect={setSelectedLineId}
                            onCommitOffset={handleCommitOffset}
                            onScrubVideo={handleScrubVideo}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Help & Legend */}
        <div className="px-4 py-2 bg-black border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-emerald-500" />
              <span>Take gravado</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded border border-dashed border-zinc-500" />
              <span>Timestamp original</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-amber-400" />
              <span>Atrasado (+)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-cyan-400" />
              <span>Adiantado (-)</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>Dica: Use <b>Espaço</b> para play/pause e as <b>Setas</b> para navegar frame a frame</span>
          </div>
        </div>
      </div>
    </div>
  )
}
export default TimingEditorModal
