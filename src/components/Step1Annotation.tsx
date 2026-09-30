import React, { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { DialogueLine } from '../types'
import { LayerSelector } from './LayerSelector'
import {
  Upload,
  Play,
  Pause,
  Trash2,
  Edit2,
  Check,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react'

interface Step1AnnotationProps {
  videoPath: string | null
  videoMediaUrl: string | null
  videoName: string | null
  lines: DialogueLine[]
  setLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>
  onSelectVideo: () => void
  onAdvanceToRecording: () => void
  isActive?: boolean
  currentLayer: number
  setCurrentLayer: (layer: number | ((prev: number) => number)) => void
}

export const Step1Annotation: React.FC<Step1AnnotationProps> = ({
  videoPath,
  videoMediaUrl,
  videoName,
  lines,
  setLines,
  onSelectVideo,
  onAdvanceToRecording,
  isActive = true,
  currentLayer,
  setCurrentLayer,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const waveformContainerRef = useRef<HTMLDivElement | null>(null)
  const timelineContainerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const wsRegionsRef = useRef<any>(null)

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false)
  const [isCtrlHeld, setIsCtrlHeld] = useState<boolean>(false)
  const [zoomLevel, setZoomLevel] = useState<number>(30)
  const [showAllLayers, setShowAllLayers] = useState<boolean>(false)

  // Pending region dialog for typing line text
  const [pendingRegion, setPendingRegion] = useState<{
    region: Region
    start: number
    end: number
  } | null>(null)
  const [pendingText, setPendingText] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Editing existing line
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState<string>('')
  const [editingModalLine, setEditingModalLine] = useState<DialogueLine | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    line: DialogueLine
  } | null>(null)

  // Close context menu on global click or Escape
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null)
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [])

  // Active playing line preview
  const [playingLineId, setPlayingLineId] = useState<string | null>(null)
  const playingLineRef = useRef<DialogueLine | null>(null)
  const linesRef = useRef<DialogueLine[]>(lines)
  linesRef.current = lines

  // Pause playback when tab becomes inactive
  useEffect(() => {
    if (isActive === false) {
      if (wsRef.current && wsRef.current.isPlaying()) {
        wsRef.current.pause()
      }
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause()
      }
      setPlayingLineId(null)
      playingLineRef.current = null
      setIsPlaying(false)
      setContextMenu(null)
    }
  }, [isActive])

  // Format seconds to mm:ss.ms
  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00.000'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  // Attach right-click context menu to a WaveSurfer region element
  const attachRegionContextMenu = useCallback((region: any) => {
    if (!region) return
    const el = region.element
    if (el) {
      el.oncontextmenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const found = linesRef.current.find((l) => l.id === region.id)
        if (found) {
          setContextMenu({
            x: Math.min(e.clientX, window.innerWidth - 200),
            y: Math.min(e.clientY, window.innerHeight - 160),
            line: found,
          })
        }
      }
    }
  }, [])

  // Synchronize WaveSurfer regions with active layer & ghost markers for other layers
  const syncRegions = useCallback(
    (layer: number, allLines: DialogueLine[]) => {
      const wsRegions = wsRegionsRef.current
      if (!wsRegions) return

      wsRegions.clearRegions()

      // 1. Active layer regions: fully editable and interactive
      const activeLayerLines = allLines.filter((l) => (l.layer || 1) === layer)
      activeLayerLines.forEach((l) => {
        const reg = wsRegions.addRegion({
          id: l.id,
          start: l.startTime,
          end: l.endTime,
          content: l.text,
          color: 'rgba(255, 255, 255, 0.14)',
          drag: false,
          resize: true,
        })
        attachRegionContextMenu(reg)
      })

      // 2. Ghost markers for other layers: faint, non-interactive visual guide
      const otherLayerLines = allLines.filter((l) => (l.layer || 1) !== layer)
      otherLayerLines.forEach((l) => {
        const reg = wsRegions.addRegion({
          id: `ghost_${l.id}`,
          start: l.startTime,
          end: l.endTime,
          content: `[C${l.layer || 1}] ${l.text}`,
          color: 'rgba(100, 116, 139, 0.08)',
          drag: false,
          resize: false,
        })
        if (reg.element) {
          reg.element.style.pointerEvents = 'none'
          reg.element.style.opacity = '0.5'
        }
      })
    },
    [attachRegionContextMenu]
  )

  // Initialize WaveSurfer
  useEffect(() => {
    if (!videoMediaUrl || !waveformContainerRef.current) return

    setIsLoadingAudio(true)

    if (wsRef.current) {
      wsRef.current.destroy()
      wsRef.current = null
    }

    const wsRegions = RegionsPlugin.create()
    wsRegionsRef.current = wsRegions

    const ws = WaveSurfer.create({
      container: waveformContainerRef.current,
      media: videoRef.current || undefined,
      waveColor: '#3f3f46',
      progressColor: '#e4e4e7',
      cursorColor: '#ffffff',
      cursorWidth: 1,
      height: 90,
      minPxPerSec: zoomLevel,
      autoScroll: true,
      autoCenter: true,
      plugins: [
        wsRegions,
        ...(timelineContainerRef.current
          ? [
              TimelinePlugin.create({
                container: timelineContainerRef.current,
                height: 18,
                timeInterval: 1,
                primaryLabelInterval: 5,
                style: { fontSize: '9px', color: '#52525b' },
              }),
            ]
          : []),
      ],
    })

    wsRef.current = ws
    let isMounted = true

    const loadAudioSource = async () => {
      try {
        if (window.electronAPI?.getWaveformPeaks && videoPath) {
          const { duration: audioDur, peaks } = await window.electronAPI.getWaveformPeaks(videoPath)
          if (!isMounted) return
          if (peaks && peaks.length > 0) {
            const validDur = (audioDur && audioDur > 0) ? audioDur : (videoRef.current?.duration && videoRef.current.duration > 0 ? videoRef.current.duration : 1)
            await ws.load(videoMediaUrl, [peaks], validDur)
            return
          }
        }
        if (!isMounted) return
        await ws.load(videoMediaUrl)
      } catch (err) {
        console.warn('Erro na extração de peaks, fallback direto:', err)
        if (isMounted) {
          try {
            await ws.load(videoMediaUrl)
          } catch (e) {
            console.error('Falha geral ao carregar áudio no wavesurfer:', e)
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingAudio(false)
        }
      }
    }
    loadAudioSource()

    ws.on('ready', () => {
      if (!isMounted) return
      setIsLoadingAudio(false)
      const d = ws.getDuration()
      if (d > 0) setDuration(d)

      try {
        ws.zoom(zoomLevel)
      } catch (e) {}

      syncRegions(currentLayer, linesRef.current)
    })

    ws.on('timeupdate', (time) => {
      setCurrentTime(time)
      const targetLine = playingLineRef.current
      if (targetLine && time >= targetLine.endTime) {
        ws.pause()
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = targetLine.startTime
        }
        ws.setTime(targetLine.startTime)
        setPlayingLineId(null)
        playingLineRef.current = null
        setIsPlaying(false)
      }
    })

    ws.on('interaction', () => {
      setPlayingLineId(null)
      playingLineRef.current = null
    })

    ws.on('play', () => {
      setIsPlaying(true)
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {})
      }
    })

    ws.on('pause', () => {
      setIsPlaying(false)
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause()
      }
    })

    wsRegions.on('region-created', (region: any) => {
      region.setOptions({ drag: false, resize: true })
      attachRegionContextMenu(region)
      if (!linesRef.current.some((l) => l.id === region.id)) {
        setPendingRegion({
          region,
          start: region.start,
          end: region.end,
        })
        setPendingText('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    })

    wsRegions.on('region-updated', (region: any) => {
      attachRegionContextMenu(region)
      setLines((prev) =>
        prev.map((l) =>
          l.id === region.id ? { ...l, startTime: region.start, endTime: region.end } : l
        )
      )
    })

    wsRegions.on('region-clicked', (region: any, e: MouseEvent) => {
      e.stopPropagation()
      // Clicking a region seeks there freely without clamping continuous playback
      setPlayingLineId(null)
      playingLineRef.current = null
      if (videoRef.current) videoRef.current.currentTime = region.start
      ws.setTime(region.start)
    })

    return () => {
      isMounted = false
      ws.destroy()
      wsRef.current = null
      wsRegionsRef.current = null
    }
  }, [videoMediaUrl, videoPath])

  useEffect(() => {
    if (wsRef.current) {
      try {
        if ((wsRef.current as any).decodedData) {
          wsRef.current.zoom(zoomLevel)
        }
      } catch (e) {
        console.warn('WaveSurfer zoom prevented before ready:', e)
      }
    }
  }, [zoomLevel])

  // Sync WaveSurfer regions when currentLayer changes or when lines are added/removed
  const linesSignature = lines.map((l) => `${l.id}_${l.layer || 1}`).join(';')
  useEffect(() => {
    if (wsRef.current && wsRegionsRef.current) {
      syncRegions(currentLayer, lines)
    }
  }, [currentLayer, linesSignature, syncRegions])

  const togglePlay = useCallback(() => {
    setPlayingLineId(null)
    playingLineRef.current = null
    const ws = wsRef.current
    const video = videoRef.current
    if (!ws && !video) return

    if (video && (video.ended || (duration > 0 && video.currentTime >= duration - 0.1))) {
      video.currentTime = 0
      if (ws) ws.setTime(0)
    }

    const currentlyPlaying = isPlaying || (ws ? ws.isPlaying() : false) || (video ? !video.paused : false)

    if (currentlyPlaying) {
      if (ws && ws.isPlaying()) ws.pause()
      if (video && !video.paused) video.pause()
      setIsPlaying(false)
    } else {
      if (video && video.seeking) {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          if (ws) {
            ws.play().catch(console.error)
          } else {
            video.play().catch(console.error)
          }
          setIsPlaying(true)
        }
        video.addEventListener('seeked', onSeeked, { once: true })
      } else {
        if (ws) {
          ws.play().then(() => {
            if (video && video.paused) video.play().catch(() => {})
            setIsPlaying(true)
          }).catch((err) => {
            console.error('ws.play erro, fallback para video.play:', err)
            if (video) video.play().then(() => setIsPlaying(true)).catch(console.error)
          })
        } else if (video) {
          video.play().then(() => setIsPlaying(true)).catch(console.error)
        }
      }
    }
  }, [isPlaying, duration])

  useEffect(() => {
    if (!isActive) return

    let disableDrag: (() => void) | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
        return
      }

      if (e.key === 'Control' && wsRegionsRef.current && !disableDrag) {
        setIsCtrlHeld(true)
        disableDrag = wsRegionsRef.current.enableDragSelection({
          color: 'rgba(255, 255, 255, 0.18)',
          drag: false,
          resize: true,
        })
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlHeld(false)
        if (disableDrag) {
          disableDrag()
          disableDrag = null
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (disableDrag) disableDrag()
    }
  }, [isActive, togglePlay])

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const vTime = videoRef.current.currentTime
      setCurrentTime(vTime)

      const targetLine = playingLineRef.current
      if (targetLine && vTime >= targetLine.endTime) {
        wsRef.current?.pause()
        videoRef.current.pause()
        videoRef.current.currentTime = targetLine.startTime
        if (wsRef.current) wsRef.current.setTime(targetLine.startTime)
        setPlayingLineId(null)
        playingLineRef.current = null
        setIsPlaying(false)
      }
    }
  }

  const handlePlayLine = (line: DialogueLine) => {
    if (playingLineId === line.id) {
      if (videoRef.current) videoRef.current.pause()
      if (wsRef.current) wsRef.current.pause()
      setPlayingLineId(null)
      playingLineRef.current = null
      setIsPlaying(false)
      return
    }

    setPlayingLineId(line.id)
    playingLineRef.current = null // Avoid race condition while seeking to startTime

    const video = videoRef.current
    const ws = wsRef.current

    if (video) {
      video.pause()
      if (ws) ws.pause()

      video.currentTime = line.startTime
      if (ws) ws.setTime(line.startTime)

      const startPlayback = () => {
        playingLineRef.current = line
        video.play().then(() => {
          if (ws && !ws.isPlaying()) ws.play().catch(() => {})
          setIsPlaying(true)
        }).catch((err) => {
          console.error('Erro ao dar play no vídeo da fala:', err)
          if (ws) {
            ws.play().then(() => setIsPlaying(true)).catch(console.error)
          }
        })
      }

      if (video.seeking) {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          startPlayback()
        }
        video.addEventListener('seeked', onSeeked, { once: true })
      } else {
        startPlayback()
      }
    } else if (ws) {
      ws.setTime(line.startTime)
      playingLineRef.current = line
      ws.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }

  const handleWaveformContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 1. Try to find region element from e.target
    let target = e.target as HTMLElement | null
    let foundLine: DialogueLine | undefined

    const regions = wsRegionsRef.current?.getRegions() || []
    while (target && target !== waveformContainerRef.current) {
      const matched = regions.find(
        (r: any) => r.element && (r.element === target || r.element.contains(target))
      )
      if (matched) {
        foundLine = linesRef.current.find((l) => l.id === matched.id)
        break
      }
      target = target.parentElement
    }

    // 2. If not found by DOM hierarchy, match by timestamp of the click
    if (!foundLine && wsRef.current && waveformContainerRef.current) {
      const rect = waveformContainerRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const scrollLeft = (wsRef.current as any).getWrapper?.()?.scrollLeft || 0
      const totalWidth = (wsRef.current as any).getWrapper?.()?.scrollWidth || rect.width
      const duration = wsRef.current.getDuration() || 0
      if (totalWidth > 0 && duration > 0) {
        const clickTime = ((clickX + scrollLeft) / totalWidth) * duration
        foundLine = linesRef.current.find(
          (l) => clickTime >= l.startTime - 0.05 && clickTime <= l.endTime + 0.05
        )
      }
    }

    if (foundLine) {
      setContextMenu({
        x: Math.min(e.clientX, window.innerWidth - 200),
        y: Math.min(e.clientY, window.innerHeight - 160),
        line: foundLine,
      })
    }
  }

  const handleStartEdit = (line: DialogueLine) => {
    setContextMenu(null)
    setEditingModalLine(line)
    setEditingText(line.text)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const handleSaveModalEdit = () => {
    if (!editingModalLine) return
    const text = editingText.trim()
    if (text) {
      setLines((prev) =>
        prev.map((l) => (l.id === editingModalLine.id ? { ...l, text } : l))
      )
      const regions = wsRegionsRef.current?.getRegions() || []
      const target = regions.find((r: any) => r.id === editingModalLine.id)
      if (target) {
        target.setOptions({ content: text })
      }
    }
    setEditingModalLine(null)
    setEditingText('')
  }

  const handleCancelModalEdit = () => {
    setEditingModalLine(null)
    setEditingText('')
  }

  const handleSavePendingLine = () => {
    if (!pendingRegion) return
    const text = pendingText.trim()
    if (!text) {
      pendingRegion.region.remove()
      setPendingRegion(null)
      return
    }

    const newLineId = `line_${Date.now()}`
    pendingRegion.region.setOptions({
      id: newLineId,
      content: text,
      color: 'rgba(255, 255, 255, 0.12)',
      drag: false,
      resize: true,
    })
    attachRegionContextMenu(pendingRegion.region)

    const newLine: DialogueLine = {
      id: newLineId,
      startTime: pendingRegion.start,
      endTime: pendingRegion.end,
      text,
      takes: [],
      activeTakeIndex: 0,
      layer: currentLayer,
    }

    setLines((prev) => [...prev, newLine].sort((a, b) => a.startTime - b.startTime))
    setPendingRegion(null)
    setPendingText('')
  }

  const handleCancelPendingLine = () => {
    if (pendingRegion) {
      pendingRegion.region.remove()
      setPendingRegion(null)
      setPendingText('')
    }
  }

  const handleDeleteLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
    const regions = wsRegionsRef.current?.getRegions() || []
    const target = regions.find((r: any) => r.id === id)
    if (target) target.remove()
    if (playingLineId === id) {
      videoRef.current?.pause()
      wsRef.current?.pause()
      setPlayingLineId(null)
      playingLineRef.current = null
      setIsPlaying(false)
    }
    if (editingModalLine?.id === id) {
      setEditingModalLine(null)
      setEditingText('')
    }
    if (editingLineId === id) {
      setEditingLineId(null)
      setEditingText('')
    }
  }

  const handleSaveEditedText = (id: string) => {
    const text = editingText.trim()
    if (text) {
      setLines((prev) =>
        prev.map((l) => (l.id === id ? { ...l, text } : l))
      )
      const regions = wsRegionsRef.current?.getRegions() || []
      const target = regions.find((r: any) => r.id === id)
      if (target) {
        target.setOptions({ content: text })
      }
    }
    setEditingLineId(null)
    setEditingText('')
  }

  const handleSeekToLine = (line: DialogueLine) => {
    setPlayingLineId(null)
    playingLineRef.current = null
    setIsPlaying(false)

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = line.startTime
    }
    if (wsRef.current) {
      wsRef.current.pause()
      wsRef.current.setTime(line.startTime)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden bg-[#050505]">
      {!videoMediaUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 border border-zinc-800 rounded-md flex items-center justify-center mb-4 text-zinc-400">
            <Upload className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-white mb-1">Selecione o vídeo para dublagem</h2>
          <p className="text-xs text-zinc-500 max-w-sm mb-5">
            Formatos suportados: MP4, MKV, WebM, MOV, AVI.
          </p>
          <button
            onClick={onSelectVideo}
            className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition-colors"
          >
            Selecionar Vídeo
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Main Area: Video & Waveform */}
          <div className="flex-1 flex flex-col border-r border-zinc-900 overflow-hidden">
            {/* Minimal Toolbar */}
            <div className="h-8 bg-black border-b border-zinc-900 px-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <LayerSelector
                  currentLayer={currentLayer}
                  onLayerChange={(layer) => setCurrentLayer(layer)}
                  totalLinesByLayer={lines.reduce<Record<number, number>>((acc, l) => {
                    const lyr = l.layer || 1
                    acc[lyr] = (acc[lyr] || 0) + 1
                    return acc
                  }, {})}
                />

                <span
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded transition-all ${
                    isCtrlHeld
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-500'
                  }`}
                >
                  {isCtrlHeld ? 'CTRL ATIVO: Selecione na waveform' : 'Segure CTRL e arraste na waveform'}
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <span className="text-zinc-600 text-[10px] mr-1">Zoom:</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(10, z - 10))}
                  className="p-1 hover:text-white text-zinc-500 rounded"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="font-mono text-zinc-400 text-[10px] min-w-[24px] text-center">
                  {zoomLevel}
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  className="p-1 hover:text-white text-zinc-500 rounded"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Video Player */}
            <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden p-2 min-h-0">
              <video
                ref={videoRef}
                src={videoMediaUrl}
                preload="auto"
                playsInline
                onTimeUpdate={handleVideoTimeUpdate}
                onClick={togglePlay}
                className="max-h-full max-w-full rounded object-contain cursor-pointer"
              />

              {/* Time Code */}
              <div className="absolute top-3 left-3 bg-black/80 px-2 py-0.5 rounded border border-zinc-900 text-[11px] font-mono text-zinc-400">
                <span className="text-white">{formatTime(currentTime)}</span> /{' '}
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Minimal Waveform Area */}
            <div className="bg-black border-t border-zinc-900 p-3 space-y-2 select-none relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded transition-colors"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <span className="text-[11px] font-mono text-zinc-400">
                    <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(duration)}
                  </span>
                </div>

                <span className="text-[11px] text-zinc-500 font-mono">
                  {lines.length} falas
                </span>
              </div>

              {/* Waveform Container */}
              <div className="relative rounded bg-[#09090b] border border-zinc-900 overflow-hidden">
                {isLoadingAudio && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-2.5 z-10 text-xs text-zinc-300 backdrop-blur-[2px]">
                    <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                    <span>Processando waveform...</span>
                  </div>
                )}
                <div
                  ref={waveformContainerRef}
                  className="w-full"
                  onContextMenu={handleWaveformContextMenu}
                />
                <div ref={timelineContainerRef} className="w-full bg-black/40" />
              </div>

              {/* Prompt for typing dialogue line */}
              {pendingRegion && (
                <div className="absolute inset-x-3 top-2 z-20 bg-black border border-zinc-700 rounded p-2.5 shadow-xl animate-in fade-in duration-100">
                  <div className="flex items-center justify-between mb-1.5 text-[11px]">
                    <span className="text-zinc-300 font-medium">Nova Fala:</span>
                    <span className="font-mono text-zinc-500">
                      {formatTime(pendingRegion.start)} ➔ {formatTime(pendingRegion.end)}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={pendingText}
                      onChange={(e) => setPendingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePendingLine()
                        if (e.key === 'Escape') handleCancelPendingLine()
                      }}
                      placeholder='Texto da fala... (Pressione ENTER)'
                      className="flex-1 bg-[#09090b] border border-zinc-800 rounded px-2.5 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      onClick={handleSavePendingLine}
                      className="px-2.5 py-1 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelPendingLine}
                      className="px-2 py-1 text-zinc-400 hover:text-white text-xs rounded cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Prompt for editing existing dialogue line */}
              {editingModalLine && (
                <div className="absolute inset-x-3 top-2 z-20 bg-black/95 border border-zinc-700 rounded p-2.5 shadow-xl animate-in fade-in duration-100 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200 font-medium">Editar Fala:</span>
                      <span className="font-mono text-zinc-400">
                        {formatTime(editingModalLine.startTime)} ➔ {formatTime(editingModalLine.endTime)}
                      </span>
                    </div>
                    <button
                      onClick={handleCancelModalEdit}
                      className="text-zinc-500 hover:text-white text-xs px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveModalEdit()
                        if (e.key === 'Escape') handleCancelModalEdit()
                      }}
                      placeholder="Texto da fala... (Pressione ENTER)"
                      className="flex-1 bg-[#09090b] border border-zinc-800 rounded px-2.5 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      onClick={handleSaveModalEdit}
                      className="px-2.5 py-1 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelModalEdit}
                      className="px-2 py-1 text-zinc-400 hover:text-white text-xs rounded cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Lines List */}
          <div className="w-72 bg-black flex flex-col justify-between overflow-hidden">
            <div className="p-3 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white uppercase tracking-wider">Roteiro</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold">
                  C{currentLayer}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAllLayers((prev) => !prev)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                    showAllLayers
                      ? 'bg-zinc-800 text-white border-zinc-600'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                  title="Alternar entre ver falas da camada atual ou todas as camadas"
                >
                  {showAllLayers ? 'Todas' : `Camada ${currentLayer}`}
                </button>
                <span className="text-[11px] font-mono text-zinc-500">
                  {(showAllLayers ? lines : lines.filter((l) => (l.layer || 1) === currentLayer)).length} falas
                </span>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {(showAllLayers ? lines : lines.filter((l) => (l.layer || 1) === currentLayer)).length === 0 ? (
                <div className="text-center py-10 px-3 text-zinc-600 text-xs">
                  {showAllLayers
                    ? 'Segure CTRL e arraste na waveform para marcar uma fala.'
                    : `Nenhuma fala na Camada ${currentLayer}. Segure CTRL e arraste na waveform para marcar as falas deste personagem.`}
                </div>
              ) : (
                (showAllLayers ? lines : lines.filter((l) => (l.layer || 1) === currentLayer)).map((line, index) => (
                  <div
                    key={line.id}
                    onClick={() => handleSeekToLine(line)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({
                        x: Math.min(e.clientX, window.innerWidth - 200),
                        y: Math.min(e.clientY, window.innerHeight - 160),
                        line,
                      })
                    }}
                    className={`p-2 rounded transition-colors cursor-pointer group space-y-1 ${
                      playingLineId === line.id
                        ? 'border border-zinc-500 bg-zinc-900/80 shadow-sm'
                        : 'bg-[#09090b] border border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-zinc-500 font-bold">#{index + 1}</span>
                        {(showAllLayers || (line.layer || 1) !== currentLayer) && (
                          <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 font-medium">
                            C{line.layer || 1}
                          </span>
                        )}
                        <span className="font-mono text-zinc-400">
                          {formatTime(line.startTime)} - {formatTime(line.endTime)}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePlayLine(line)
                        }}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          playingLineId === line.id
                            ? 'bg-white text-black'
                            : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                        title={playingLineId === line.id ? 'Pausar fala' : 'Ouvir trecho da fala'}
                      >
                        {playingLineId === line.id ? (
                          <Pause className="w-2.5 h-2.5" />
                        ) : (
                          <Play className="w-2.5 h-2.5 ml-0.5" />
                        )}
                      </button>
                    </div>

                    {editingLineId === line.id ? (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditedText(line.id)
                            if (e.key === 'Escape') setEditingLineId(null)
                          }}
                          className="flex-1 bg-black border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditedText(line.id)}
                          className="px-1.5 py-0.5 bg-white text-black rounded text-[10px] cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-300 font-normal break-words">
                        "{line.text}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-0.5 text-[10px] text-zinc-600">
                      <span>{(line.endTime - line.startTime).toFixed(2)}s</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(line)
                          }}
                          className="hover:text-white cursor-pointer"
                          title="Editar fala"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteLine(line.id)
                          }}
                          className="hover:text-red-400 cursor-pointer"
                          title="Excluir fala"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Advance Button */}
            <div className="p-2.5 border-t border-zinc-900 bg-black">
              <button
                onClick={onAdvanceToRecording}
                disabled={lines.length === 0}
                className={`w-full py-2 px-3 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  lines.length > 0
                    ? 'bg-white hover:bg-zinc-200 text-black cursor-pointer'
                    : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <span>Avançar para Gravação</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#121215] border border-zinc-700/80 rounded-lg shadow-2xl py-1 w-48 text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] text-zinc-400 font-mono flex items-center justify-between">
            <span>Fala #{lines.findIndex((l) => l.id === contextMenu.line.id) + 1}</span>
            <span className="text-zinc-300 font-semibold">Camada {contextMenu.line.layer || 1}</span>
          </div>

          <button
            onClick={() => {
              const line = contextMenu.line
              setContextMenu(null)
              handlePlayLine(line)
            }}
            className="w-full px-3 py-2 text-left hover:bg-zinc-800/80 text-zinc-200 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-zinc-400" />
            <span>Ouvir Trecho</span>
          </button>

          <button
            onClick={() => {
              const line = contextMenu.line
              handleStartEdit(line)
            }}
            className="w-full px-3 py-2 text-left hover:bg-zinc-800/80 text-zinc-200 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Editar Fala</span>
          </button>

          <div className="my-1 border-t border-zinc-800" />

          {/* Move to another layer */}
          <button
            onClick={() => {
              const targetId = contextMenu.line.id
              const currentL = contextMenu.line.layer || 1
              setContextMenu(null)
              setLines((prev) =>
                prev.map((l) => (l.id === targetId ? { ...l, layer: currentL + 1 } : l))
              )
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-800/80 text-zinc-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer text-[11px]"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Mover para Camada {(contextMenu.line.layer || 1) + 1}</span>
          </button>

          {(contextMenu.line.layer || 1) > 1 && (
            <button
              onClick={() => {
                const targetId = contextMenu.line.id
                const currentL = contextMenu.line.layer || 1
                setContextMenu(null)
                setLines((prev) =>
                  prev.map((l) => (l.id === targetId ? { ...l, layer: currentL - 1 } : l))
                )
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-zinc-800/80 text-zinc-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer text-[11px]"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span>Mover para Camada {(contextMenu.line.layer || 1) - 1}</span>
            </button>
          )}

          <div className="my-1 border-t border-zinc-800" />

          <button
            onClick={() => {
              const id = contextMenu.line.id
              setContextMenu(null)
              handleDeleteLine(id)
            }}
            className="w-full px-3 py-2 text-left hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Excluir Fala</span>
          </button>
        </div>
      )}
    </div>
  )
}
