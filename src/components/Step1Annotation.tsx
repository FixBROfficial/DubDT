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
  Info,
  Clock,
  Sparkles,
  Volume2,
  ZoomIn,
  ZoomOut,
  Keyboard,
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

    // Clean up previous instance
    if (wsRef.current) {
      wsRef.current.destroy()
      wsRef.current = null
    }

    const wsRegions = RegionsPlugin.create()
    wsRegionsRef.current = wsRegions

    const ws = WaveSurfer.create({
      container: waveformContainerRef.current,
      waveColor: '#4f46e5',
      progressColor: '#9333ea',
      cursorColor: '#f43f5e',
      cursorWidth: 2,
      height: 100,
      minPxPerSec: zoomLevel,
      autoScroll: true,
      autoCenter: true,
      plugins: [
        wsRegions,
        ...(timelineContainerRef.current
          ? [
              TimelinePlugin.create({
                container: timelineContainerRef.current,
                height: 20,
                timeInterval: 1,
                primaryLabelInterval: 5,
                style: { fontSize: '10px', color: '#71717a' },
              }),
            ]
          : []),
      ],
    })

    wsRef.current = ws

    // Load extracted audio if available through electronAPI or directly mediaUrl
    const loadAudioSource = async () => {
      try {
        if (window.electronAPI && videoPath) {
          const { mediaUrl } = await window.electronAPI.extractAudioForWaveform(videoPath)
          ws.load(mediaUrl)
        } else {
          ws.load(videoMediaUrl)
        }
      } catch (err) {
        console.warn('Fallback to direct videoMediaUrl for waveform:', err)
        ws.load(videoMediaUrl)
      }
    }
    loadAudioSource()

    ws.on('ready', () => {
      setIsLoadingAudio(false)
      setDuration(ws.getDuration())

      // Render existing lines as regions
      lines.forEach((l) => {
        wsRegions.addRegion({
          id: l.id,
          start: l.startTime,
          end: l.endTime,
          content: l.text,
          color: 'rgba(124, 58, 237, 0.25)',
          drag: true,
          resize: true,
        })
      })
    })

    // Sincronização: quando clica na waveform, seek no vídeo
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

    // Evento de criação de região
    wsRegions.on('region-created', (region) => {
      // Se não for uma região já carregada das lines
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

    // Quando atualiza o tamanho da região arrastando as bordas
    wsRegions.on('region-updated', (region) => {
      setLines((prev) =>
        prev.map((l) =>
          l.id === region.id ? { ...l, startTime: region.start, endTime: region.end } : l
        )
      )
    })

    // Clique na região seleciona e pula o vídeo pra lá
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

  // Zoom update
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.zoom(zoomLevel)
    }
  }, [zoomLevel])

  // Ctrl Key listener to enable Drag Selection on WaveSurfer
  useEffect(() => {
    let disableDrag: (() => void) | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' && wsRegionsRef.current && !disableDrag) {
        setIsCtrlHeld(true)
        disableDrag = wsRegionsRef.current.enableDragSelection({
          color: 'rgba(147, 51, 234, 0.35)',
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

  // Sincronização do vídeo com o WaveSurfer
  const handleVideoTimeUpdate = () => {
    if (videoRef.current && wsRef.current) {
      const vTime = videoRef.current.currentTime
      setCurrentTime(vTime)
      if (Math.abs(wsRef.current.getCurrentTime() - vTime) > 0.15) {
        wsRef.current.setTime(vTime)
      }
    }
  }

  // Toggle Play / Pause
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

  // Confirm new line dialogue
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
      color: 'rgba(124, 58, 237, 0.25)',
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

  // Delete a line
  const handleDeleteLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
    const regions = wsRegionsRef.current?.getRegions() || []
    const target = regions.find((r) => r.id === id)
    if (target) target.remove()
  }

  // Save edited line text
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

  // Seek to line
  const handleSeekToLine = (line: DialogueLine) => {
    if (wsRef.current) wsRef.current.setTime(line.startTime)
    if (videoRef.current) videoRef.current.currentTime = line.startTime
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-zinc-950">
      {/* If No Video Selected */}
      {!videoMediaUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-purple-950/20 group hover:border-violet-500/50 transition-all">
            <Upload className="w-10 h-10 text-violet-400 group-hover:scale-110 transition-transform" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Selecione o vídeo que você deseja dublar</h2>
          <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
            Abra qualquer arquivo de vídeo (MP4, MKV, WebM, AVI). O DubDT extrairá a waveform do áudio
            para você demarcar as falas com precisão.
          </p>
          <button
            onClick={onSelectVideo}
            className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-violet-900/40 hover:shadow-violet-900/60 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Selecionar Vídeo</span>
          </button>
        </div>
      ) : (
        /* Workspace when video is loaded */
        <div className="flex-1 flex overflow-hidden">
          {/* Main Area: Video Player & Waveform */}
          <div className="flex-1 flex flex-col border-r border-zinc-800/80 overflow-hidden">
            {/* Top Toolbar / Instructions Banner */}
            <div className="h-10 bg-zinc-900/60 border-b border-zinc-800/80 px-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono font-medium text-[11px] transition-all ${
                    isCtrlHeld
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-700/50 animate-pulse'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                  }`}
                >
                  <Keyboard className="w-3 h-3" />
                  {isCtrlHeld ? 'CTRL ATIVO: Arraste na waveform!' : 'Segure CTRL e arraste na Waveform'}
                </span>
                <span className="text-zinc-500 hidden sm:inline">
                  Marque o início e o fim da fala de cada personagem
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[11px]">Zoom:</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(10, z - 10))}
                  title="Diminuir Zoom"
                  className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-zinc-400 text-[11px] min-w-[28px] text-center">
                  {zoomLevel}x
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  title="Aumentar Zoom"
                  className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
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
                className="max-h-full max-w-full rounded-lg shadow-2xl object-contain cursor-pointer"
              />

              {/* Time Code Overlay */}
              <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1 rounded-md border border-zinc-800/80 text-xs font-mono text-zinc-300">
                <span className="text-violet-400 font-bold">{formatTime(currentTime)}</span> /{' '}
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Waveform & Timeline Section */}
            <div className="bg-zinc-900 border-t border-zinc-800 p-4 space-y-2 select-none relative">
              {/* Playback Controls & Waveform Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="p-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-full shadow-md transition-transform active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div className="text-xs font-mono">
                    <span className="text-white font-bold">{formatTime(currentTime)}</span>
                    <span className="text-zinc-500"> / {formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-500/80" />
                  <span>Falas cadastradas: {lines.length}</span>
                </div>
              </div>

              {/* Waveform Display Container */}
              <div className="relative rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                {isLoadingAudio && (
                  <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-10 gap-2 text-xs text-violet-400">
                    <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span>Extraindo áudio do vídeo para Waveform...</span>
                  </div>
                )}
                <div ref={waveformContainerRef} className="w-full" />
                <div ref={timelineContainerRef} className="w-full bg-zinc-900/50" />
              </div>

              {/* Modal / Popup for typing speech when region is created with CTRL */}
              {pendingRegion && (
                <div className="absolute inset-x-4 top-2 z-20 bg-zinc-900/95 backdrop-blur-md border border-violet-500/50 rounded-xl p-3 shadow-2xl shadow-violet-950/50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs text-violet-300 font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Nova Fala Selecionada</span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                      {formatTime(pendingRegion.start)} ➔ {formatTime(pendingRegion.end)} (
                      {(pendingRegion.end - pendingRegion.start).toFixed(2)}s)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={pendingText}
                      onChange={(e) => setPendingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePendingLine()
                        if (e.key === 'Escape') handleCancelPendingLine()
                      }}
                      placeholder='Ex: "Estou pronto!" (Pressione ENTER para salvar)'
                      className="flex-1 bg-zinc-950 border border-violet-500/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      onClick={handleSavePendingLine}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelPendingLine}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Lines List & Advance */}
          <div className="w-80 bg-zinc-900 flex flex-col justify-between overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-400" />
                  Roteiro de Falas
                </h3>
                <p className="text-[11px] text-zinc-400">{lines.length} falas marcadas</p>
              </div>
            </div>

            {/* Lines List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {lines.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                    <Info className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-zinc-400 font-medium mb-1">Nenhuma fala marcada ainda</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Segure <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300 font-mono">CTRL</kbd> e
                    arraste o mouse sobre a waveform para marcar a primeira fala.
                  </p>
                </div>
              ) : (
                lines.map((line, index) => (
                  <div
                    key={line.id}
                    onClick={() => handleSeekToLine(line)}
                    className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-violet-500/40 transition-all cursor-pointer group space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-violet-400">#{index + 1}</span>
                      <span className="font-mono text-zinc-400 text-[10px]">
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
                          className="flex-1 bg-zinc-900 border border-violet-500 rounded px-2 py-1 text-xs text-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditedText(line.id)}
                          className="p-1 bg-violet-600 rounded text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-200 font-medium italic break-words">
                        "{line.text}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-900 text-[10px] text-zinc-500">
                      <span>{(line.endTime - line.startTime).toFixed(2)}s de fala</span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingLineId(line.id)
                            setEditingText(line.text)
                          }}
                          title="Editar texto"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteLine(line.id)
                          }}
                          title="Remover fala"
                          className="p-1 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sidebar Bottom / Advance button */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-950/70">
              <button
                onClick={onAdvanceToRecording}
                disabled={lines.length === 0}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  lines.length > 0
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-950/50'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <span>Avançar para Gravação</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
