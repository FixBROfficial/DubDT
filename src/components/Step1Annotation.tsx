import React, { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { DialogueLine } from '../types'
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
} from 'lucide-react'

interface Step1AnnotationProps {
  videoPath: string | null
  videoMediaUrl: string | null
  videoName: string | null
  lines: DialogueLine[]
  setLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>
  onSelectVideo: () => void
  onAdvanceToRecording: () => void
}

export const Step1Annotation: React.FC<Step1AnnotationProps> = ({
  videoPath,
  videoMediaUrl,
  videoName,
  lines,
  setLines,
  onSelectVideo,
  onAdvanceToRecording,
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

  // Format seconds to mm:ss.ms
  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00.000'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

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

    const loadAudioSource = async () => {
      try {
        if (window.electronAPI && videoPath) {
          const { mediaUrl } = await window.electronAPI.extractAudioForWaveform(videoPath)
          ws.load(mediaUrl)
        } else {
          ws.load(videoMediaUrl)
        }
      } catch (err) {
        ws.load(videoMediaUrl)
      }
    }
    loadAudioSource()

    ws.on('ready', () => {
      setIsLoadingAudio(false)
      setDuration(ws.getDuration())

      lines.forEach((l) => {
        wsRegions.addRegion({
          id: l.id,
          start: l.startTime,
          end: l.endTime,
          content: l.text,
          color: 'rgba(255, 255, 255, 0.12)',
          drag: true,
          resize: true,
        })
      })
    })

    ws.on('timeupdate', (time) => {
      setCurrentTime(time)
      if (videoRef.current && Math.abs(videoRef.current.currentTime - time) > 0.15) {
        videoRef.current.currentTime = time
      }
    })

    ws.on('play', () => {
      setIsPlaying(true)
      videoRef.current?.play()
    })

    ws.on('pause', () => {
      setIsPlaying(false)
      videoRef.current?.pause()
    })

    wsRegions.on('region-created', (region) => {
      if (!lines.some((l) => l.id === region.id)) {
        setPendingRegion({
          region,
          start: region.start,
          end: region.end,
        })
        setPendingText('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    })

    wsRegions.on('region-updated', (region) => {
      setLines((prev) =>
        prev.map((l) =>
          l.id === region.id ? { ...l, startTime: region.start, endTime: region.end } : l
        )
      )
    })

    wsRegions.on('region-clicked', (region, e) => {
      e.stopPropagation()
      ws.setTime(region.start)
      if (videoRef.current) videoRef.current.currentTime = region.start
    })

    return () => {
      ws.destroy()
      wsRef.current = null
      wsRegionsRef.current = null
    }
  }, [videoMediaUrl, videoPath])

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.zoom(zoomLevel)
    }
  }, [zoomLevel])

  useEffect(() => {
    let disableDrag: (() => void) | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' && wsRegionsRef.current && !disableDrag) {
        setIsCtrlHeld(true)
        disableDrag = wsRegionsRef.current.enableDragSelection({
          color: 'rgba(255, 255, 255, 0.18)',
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
  }, [])

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && wsRef.current) {
      const vTime = videoRef.current.currentTime
      setCurrentTime(vTime)
      if (Math.abs(wsRef.current.getCurrentTime() - vTime) > 0.15) {
        wsRef.current.setTime(vTime)
      }
    }
  }

  const togglePlay = useCallback(() => {
    if (!wsRef.current) return
    if (isPlaying) {
      wsRef.current.pause()
      videoRef.current?.pause()
    } else {
      wsRef.current.play()
      videoRef.current?.play()
    }
  }, [isPlaying])

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
    })

    const newLine: DialogueLine = {
      id: newLineId,
      startTime: pendingRegion.start,
      endTime: pendingRegion.end,
      text,
      takes: [],
      activeTakeIndex: 0,
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
    const target = regions.find((r) => r.id === id)
    if (target) target.remove()
  }

  const handleSaveEditedText = (id: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, text: editingText.trim() || l.text } : l))
    )
    const regions = wsRegionsRef.current?.getRegions() || []
    const target = regions.find((r) => r.id === id)
    if (target && editingText.trim()) {
      target.setOptions({ content: editingText.trim() })
    }
    setEditingLineId(null)
    setEditingText('')
  }

  const handleSeekToLine = (line: DialogueLine) => {
    if (wsRef.current) wsRef.current.setTime(line.startTime)
    if (videoRef.current) videoRef.current.currentTime = line.startTime
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
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 text-xs text-zinc-400">
                    <span>Processando áudio para waveform...</span>
                  </div>
                )}
                <div ref={waveformContainerRef} className="w-full" />
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
                      className="px-2.5 py-1 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelPendingLine}
                      className="px-2 py-1 text-zinc-400 hover:text-white text-xs rounded"
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
              <span className="text-xs font-medium text-white uppercase tracking-wider">Roteiro</span>
              <span className="text-[11px] font-mono text-zinc-500">{lines.length} falas</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {lines.length === 0 ? (
                <div className="text-center py-10 px-3 text-zinc-600 text-xs">
                  Segure CTRL e arraste na waveform para marcar uma fala.
                </div>
              ) : (
                lines.map((line, index) => (
                  <div
                    key={line.id}
                    onClick={() => handleSeekToLine(line)}
                    className="p-2 rounded bg-[#09090b] border border-zinc-900 hover:border-zinc-800 transition-colors cursor-pointer group space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-zinc-500 font-bold">#{index + 1}</span>
                      <span className="font-mono text-zinc-600">
                        {formatTime(line.startTime)} - {formatTime(line.endTime)}
                      </span>
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
                          className="px-1.5 py-0.5 bg-white text-black rounded text-[10px]"
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
                            setEditingLineId(line.id)
                            setEditingText(line.text)
                          }}
                          className="hover:text-white"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteLine(line.id)
                          }}
                          className="hover:text-red-400"
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
                    ? 'bg-white hover:bg-zinc-200 text-black'
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
    </div>
  )
}
