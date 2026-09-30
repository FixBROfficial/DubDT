import React, { useEffect, useRef, useState, useCallback } from 'react'
import { DialogueLine, DialogueTake, AudioSettings } from '../types'
import { playCountdownStep } from '../utils/beeps'
import { LayerSelector } from './LayerSelector'
import {
  Mic,
  Square,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Trash2,
  Check,
  Layers,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react'

interface Step2RecordingProps {
  videoMediaUrl: string
  lines: DialogueLine[]
  setLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>
  audioSettings: AudioSettings
  onUpdateAudioSettings: (settings: Partial<AudioSettings>) => void
  onOpenSettings: () => void
  onAdvanceToExport: () => void
  isActive?: boolean
  currentLayer: number
  setCurrentLayer: (layer: number | ((prev: number) => number)) => void
  onBackToAnnotation?: () => void
  isVideoMissing?: boolean
  onRelinkVideo?: () => void
}

export const Step2Recording: React.FC<Step2RecordingProps> = ({
  videoMediaUrl,
  lines,
  setLines,
  audioSettings,
  onUpdateAudioSettings,
  onOpenSettings,
  onAdvanceToExport,
  isActive = true,
  currentLayer,
  setCurrentLayer,
  onBackToAnnotation,
  isVideoMissing = false,
  onRelinkVideo,
}) => {
  const [filterMode, setFilterMode] = useState<'layer' | 'all'>('layer')
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0)

  const activeLines = filterMode === 'layer'
    ? lines.filter((l) => (l.layer || 1) === currentLayer)
    : lines

  const safeLineIndex = activeLines.length > 0 ? Math.min(currentLineIndex, activeLines.length - 1) : 0
  const currentLine = activeLines[safeLineIndex] || null

  const linesByLayer = lines.reduce<Record<number, number>>((acc, l) => {
    const lyr = l.layer || 1
    acc[lyr] = (acc[lyr] || 0) + 1
    return acc
  }, {})

  // Reset index when changing layer or filter mode
  useEffect(() => {
    setCurrentLineIndex(0)
  }, [currentLayer, filterMode])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false)

  // Recording State
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false)
  const [countdownValue, setCountdownValue] = useState<number>(3)
  const [isRecording, setIsRecording] = useState<boolean>(false)

  // MediaRecorder & Web Audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const previewTimeoutRef = useRef<any>(null)
  const recordingTimeoutRef = useRef<any>(null)
  const isSeekingPreviewRef = useRef<boolean>(false)

  // Active Take audio preview player
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null)
  const takeAudioRef = useRef<HTMLAudioElement | null>(null)

  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00.000'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  const stopPreview = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
    }
    if (videoRef.current && currentLine) {
      videoRef.current.pause()
      videoRef.current.currentTime = currentLine.startTime
    }
    setIsPlayingPreview(false)
  }, [currentLine])

  const seekToCurrentLine = useCallback((customTime?: number) => {
    if (videoRef.current && currentLine) {
      const preRoll = audioSettings.preRollSeconds || 0
      const target = customTime !== undefined ? customTime : Math.max(0, currentLine.startTime - preRoll)
      videoRef.current.currentTime = target
    }
  }, [currentLine, audioSettings.preRollSeconds])

  // Stop everything when tab becomes inactive
  useEffect(() => {
    if (isActive === false) {
      stopPreview()
      if (takeAudioRef.current) {
        takeAudioRef.current.pause()
      }
      setPlayingTakeId(null)
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
        recordingTimeoutRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (videoRef.current) {
        videoRef.current.pause()
      }
      setIsRecording(false)
      setIsCountingDown(false)
    }
  }, [isActive, stopPreview])

  useEffect(() => {
    if (isActive && videoRef.current && currentLine) {
      stopPreview()
      seekToCurrentLine()
    }
  }, [currentLineIndex, currentLine?.id, isActive, seekToCurrentLine, stopPreview])

  const stopTakePreview = () => {
    if (takeAudioRef.current) {
      takeAudioRef.current.pause()
      takeAudioRef.current.currentTime = 0
    }
    setPlayingTakeId(null)
  }

  const handlePlayTake = (take: DialogueTake) => {
    if (playingTakeId === take.id) {
      stopTakePreview()
      return
    }
    stopTakePreview()
    if (take.audioBlobUrl || take.filePath) {
      const src =
        take.audioBlobUrl ||
        (window.electronAPI ? window.electronAPI.convertToMediaUrl(take.filePath) : '')
      const audio = new Audio(src)
      takeAudioRef.current = audio
      audio.volume = audioSettings.masterVolume
      audio.onended = () => setPlayingTakeId(null)
      audio.play().catch(console.error)
      setPlayingTakeId(take.id)
    }
  }

  const handleSelectActiveTake = (takeIndex: number) => {
    if (!currentLine) return
    setLines((prev) =>
      prev.map((l) => (l.id === currentLine.id ? { ...l, activeTakeIndex: takeIndex } : l))
    )
  }

  const handleDeleteTake = (takeId: string) => {
    stopTakePreview()
    if (!currentLine) return
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== currentLine.id) return l
        const updatedTakes = l.takes.filter((t) => t.id !== takeId)
        return {
          ...l,
          takes: updatedTakes,
          activeTakeIndex: Math.max(0, Math.min(l.activeTakeIndex, updatedTakes.length - 1)),
        }
      })
    )
  }

  const startRecordingProcess = useCallback(async () => {
    if (isRecording || isCountingDown || !currentLine) return

    const preRoll = audioSettings.preRollSeconds || 0
    const startPoint = Math.max(0, currentLine.startTime - preRoll)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = startPoint
      videoRef.current.volume = audioSettings.originalAudioVolumeDuringRecording
    }

    setIsCountingDown(true)
    setCountdownValue(3)
    if (audioSettings.countdownBeeps) playCountdownStep(3)

    let currentVal = 3
    const timer = setInterval(async () => {
      currentVal -= 1
      if (currentVal > 0) {
        setCountdownValue(currentVal)
        if (audioSettings.countdownBeeps) playCountdownStep(currentVal)
      } else {
        clearInterval(timer)
        setIsCountingDown(false)
        if (audioSettings.countdownBeeps) playCountdownStep(0)
        await executeRecording()
      }
    }, 1000)
  }, [isRecording, isCountingDown, currentLine, audioSettings])

  const executeRecording = async () => {
    if (!currentLine) return

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...(audioSettings.inputDeviceId
            ? { deviceId: { exact: audioSettings.inputDeviceId } }
            : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      micStreamRef.current = stream

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const gainNode = ctx.createGain()
      gainNode.gain.value = audioSettings.micGain
      gainNodeRef.current = gainNode

      const destination = ctx.createMediaStreamDestination()
      source.connect(gainNode)
      gainNode.connect(destination)

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        const blobUrl = URL.createObjectURL(audioBlob)
        const arrayBuffer = await audioBlob.arrayBuffer()

        const currentTakesCount = currentLine.takes?.length || 0
        const takeNum = currentTakesCount + 1

        let savedFilePath = ''
        let savedMediaUrl = ''
        if (window.electronAPI) {
          try {
            const saved = await window.electronAPI.saveTakeAudio(currentLine.id, takeNum, arrayBuffer)
            savedFilePath = saved.filePath
            savedMediaUrl = saved.mediaUrl
          } catch (e) {
            console.error('Erro salvando take:', e)
          }
        }

        const newTake: DialogueTake = {
          id: `take_${Date.now()}`,
          takeNumber: takeNum,
          filePath: savedFilePath,
          duration: currentLine.endTime - currentLine.startTime,
          createdAt: Date.now(),
          audioBlobUrl: savedMediaUrl || blobUrl,
        }

        setLines((prev) =>
          prev.map((l) => {
            if (l.id !== currentLine.id) return l
            const newTakes = [...(l.takes || []), newTake]
            return {
              ...l,
              takes: newTakes,
              activeTakeIndex: newTakes.length - 1,
            }
          })
        )

        stream.getTracks().forEach((t) => t.stop())
        ctx.close().catch(() => {})
      }

      mediaRecorder.start(100)
      setIsRecording(true)

      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = currentLine.startTime
        videoRef.current.volume = audioSettings.originalAudioVolumeDuringRecording

        let started = false
        const startVideo = () => {
          if (started) return
          started = true
          videoRef.current?.play().catch(console.error)
        }

        videoRef.current.addEventListener('seeked', startVideo, { once: true })
        setTimeout(startVideo, 300)
      }

      const recordingDurationMs = Math.max(1000, ((currentLine.endTime - currentLine.startTime) + 2.5) * 1000)
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording()
      }, recordingDurationMs)
    } catch (err) {
      console.error('Falha ao gravar:', err)
      setIsRecording(false)
    }
  }

  const stopRecording = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (videoRef.current) {
      videoRef.current.pause()
    }
    setIsRecording(false)
  }, [])

  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        if (isRecording) {
          stopRecording()
        } else {
          startRecordingProcess()
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNextLine()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevLine()
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        handleTogglePreview()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isRecording, startRecordingProcess, stopRecording, currentLineIndex, lines.length])

  const handleNextLine = () => {
    if (safeLineIndex < activeLines.length - 1) {
      stopRecording()
      stopPreview()
      stopTakePreview()
      setCurrentLineIndex((prev) => prev + 1)
    }
  }

  const handlePrevLine = () => {
    if (safeLineIndex > 0) {
      stopRecording()
      stopPreview()
      stopTakePreview()
      setCurrentLineIndex((prev) => prev - 1)
    }
  }

  const handleTogglePreview = () => {
    if (!videoRef.current || !currentLine) return
    if (isPlayingPreview) {
      stopPreview()
    } else {
      stopTakePreview()
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }

      const video = videoRef.current
      video.pause()
      video.volume = audioSettings.masterVolume
      isSeekingPreviewRef.current = true
      video.currentTime = currentLine.startTime

      let started = false
      const startPlay = () => {
        if (started) return
        started = true
        isSeekingPreviewRef.current = false
        video.play().then(() => {
          setIsPlayingPreview(true)
        }).catch(console.error)

        const lineDurationMs = Math.max(1000, ((currentLine.endTime - currentLine.startTime) + 2.5) * 1000)
        previewTimeoutRef.current = setTimeout(() => {
          stopPreview()
        }, lineDurationMs)
      }

      video.addEventListener('seeked', startPlay, { once: true })
      setTimeout(startPlay, 300)
    }
  }

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !currentLine) return
    const vTime = videoRef.current.currentTime

    if (
      isPlayingPreview &&
      !isSeekingPreviewRef.current &&
      !videoRef.current.seeking &&
      vTime >= currentLine.startTime &&
      vTime >= currentLine.endTime - 0.05
    ) {
      stopPreview()
    }

    if (
      isRecording &&
      !videoRef.current.seeking &&
      vTime >= currentLine.startTime &&
      vTime >= currentLine.endTime
    ) {
      stopRecording()
    }
  }

  if (!currentLine) {
    return (
      <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden bg-[#050505]">
        {/* Top Info Bar with Layer Switcher */}
        <div className="h-10 bg-black border-b border-zinc-900 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayerSelector
              currentLayer={currentLayer}
              onLayerChange={(layer) => {
                setCurrentLayer(layer)
                setCurrentLineIndex(0)
              }}
              totalLinesByLayer={linesByLayer}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode((prev) => (prev === 'layer' ? 'all' : 'layer'))}
              className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
            >
              {filterMode === 'all' ? 'Ver por Camada' : 'Ver Todas as Camadas'}
            </button>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">
            Nenhuma fala marcada na Camada {currentLayer}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-5 leading-relaxed">
            Você pode navegar entre as camadas usando as setas do seletor acima ou voltar para a aba de Anotação para marcar as falas deste personagem.
          </p>
          <div className="flex items-center gap-2">
            {onBackToAnnotation && (
              <button
                onClick={onBackToAnnotation}
                className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                Voltar para Anotação
              </button>
            )}
            {currentLayer > 1 && (
              <button
                onClick={() => setCurrentLayer(1)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded border border-zinc-800 transition-colors cursor-pointer"
              >
                Ir para Camada 1
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden bg-[#050505]">
      {/* Minimal Top Info Bar */}
      <div className="h-10 bg-black border-b border-zinc-900 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayerSelector
            currentLayer={currentLayer}
            onLayerChange={(layer) => {
              setCurrentLayer(layer)
              setCurrentLineIndex(0)
            }}
            totalLinesByLayer={linesByLayer}
          />

          <div className="flex items-center gap-1.5 text-xs pl-2 border-l border-zinc-900">
            <span className="text-zinc-500 font-mono">Fala</span>
            <span className="font-mono text-white font-bold">#{safeLineIndex + 1}</span>
            <span className="text-zinc-600 text-[11px]">/ {activeLines.length}</span>
            {(filterMode === 'all' || (currentLine.layer || 1) !== currentLayer) && (
              <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300">
                Camada {currentLine.layer || 1}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePrevLine}
              disabled={safeLineIndex === 0}
              className="p-1 hover:text-white disabled:opacity-20 text-zinc-500 rounded cursor-pointer"
              title="Fala Anterior (Seta Esquerda)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextLine}
              disabled={safeLineIndex >= activeLines.length - 1}
              className="p-1 hover:text-white disabled:opacity-20 text-zinc-500 rounded cursor-pointer"
              title="Próxima Fala (Seta Direita)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] font-mono text-zinc-500 pl-2 border-l border-zinc-900 hidden sm:inline">
            {formatTime(currentLine.startTime)} ➔ {formatTime(currentLine.endTime)} (
            {(currentLine.endTime - currentLine.startTime).toFixed(2)}s)
          </span>
        </div>

        {/* Minimal Audio Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="text-[10px] uppercase text-zinc-500">Original:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioSettings.originalAudioVolumeDuringRecording}
              onChange={(e) =>
                onUpdateAudioSettings({
                  originalAudioVolumeDuringRecording: parseFloat(e.target.value),
                })
              }
              className="w-16 accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
            <span className="font-mono text-[10px] text-zinc-400 min-w-[24px]">
              {Math.round(audioSettings.originalAudioVolumeDuringRecording * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-400 pl-2 border-l border-zinc-900">
            <span className="text-[10px] uppercase text-zinc-500">Mic:</span>
            <span className="font-mono text-[10px] text-zinc-300">
              {Math.round(audioSettings.micGain * 100)}%
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
            title="Configurações de áudio"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Missing Video Alert Banner if video is not connected */}
      {isVideoMissing && (
        <div className="bg-amber-950/60 border-b border-amber-800/80 px-4 py-1.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px]">Vídeo não encontrado no disco. Você pode gravar ouvindo o metrônomo ou localizar o arquivo no Explorer.</span>
          </div>
          {onRelinkVideo && (
            <button
              onClick={onRelinkVideo}
              className="px-2 py-0.5 bg-amber-400 text-black font-semibold text-[10px] rounded hover:bg-amber-300 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="w-3 h-3" />
              Localizar Vídeo
            </button>
          )}
        </div>
      )}

      {/* Main Studio Center */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Video & Big Teleprompter */}
        <div className="flex-1 flex flex-col border-r border-zinc-900 bg-black overflow-hidden relative">
          <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden p-2 min-h-0">
            {videoMediaUrl ? (
              <video
                ref={videoRef}
                src={videoMediaUrl}
                onTimeUpdate={handleVideoTimeUpdate}
                onLoadedMetadata={() => seekToCurrentLine()}
                className="max-h-full max-w-full rounded object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500 max-w-sm">
                <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                <span className="text-xs font-semibold text-zinc-300 mb-1">Vídeo não conectado</span>
                <p className="text-[11px] text-zinc-500 mb-3">
                  O vídeo original deste projeto não foi localizado. Você pode gravar com o metrônomo ou localizar o arquivo.
                </p>
                {onRelinkVideo && (
                  <button
                    onClick={onRelinkVideo}
                    className="px-3 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Localizar no Explorer
                  </button>
                )}
              </div>
            )}

            {/* Flat Minimal Countdown Overlay */}
            {isCountingDown && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-30">
                <span className="text-9xl font-mono font-light text-white tracking-tighter">
                  {countdownValue}
                </span>
              </div>
            )}

            {/* Flat Minimal Recording Indicator */}
            {isRecording && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/80 border border-red-900/60 text-red-400 px-2.5 py-1 rounded text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>GRAVANDO</span>
              </div>
            )}
          </div>

          {/* Minimalist Teleprompter */}
          <div className="bg-[#09090b] border-t border-zinc-900 p-5 flex flex-col items-center justify-center text-center">
            <h1 className="text-xl sm:text-2xl font-medium text-white tracking-tight max-w-2xl leading-relaxed select-text">
              "{currentLine.text}"
            </h1>

            {/* Action Buttons: RECORD (R), PREVIEW, NEXT */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleTogglePreview}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded transition-colors"
              >
                {isPlayingPreview ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>Ouvir (Espaço)</span>
              </button>

              <button
                onClick={isRecording ? stopRecording : startRecordingProcess}
                disabled={isCountingDown}
                className={`flex items-center gap-2 px-5 py-1.5 rounded text-xs font-medium transition-all ${
                  isRecording
                    ? 'bg-red-600 text-white'
                    : isCountingDown
                    ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                    : 'bg-white hover:bg-zinc-200 text-black'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3 h-3 fill-current" />
                    <span>Parar (R)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3" />
                    <span>Gravar Fala (R)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleNextLine}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded transition-colors"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Takes List */}
        <div className="w-72 bg-black flex flex-col justify-between overflow-hidden">
          <div className="p-3 border-b border-zinc-900 flex items-center justify-between">
            <span className="text-xs font-medium text-white uppercase tracking-wider">Takes</span>
            <span className="text-[11px] font-mono text-zinc-500">
              {currentLine.takes?.length || 0} gravações
            </span>
          </div>

          {/* Takes List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {!currentLine.takes || currentLine.takes.length === 0 ? (
              <div className="text-center py-10 px-3 text-zinc-600 text-xs">
                Nenhum take gravado. Pressione R para gravar.
              </div>
            ) : (
              currentLine.takes.map((take, tIdx) => {
                const isSelected = (currentLine.activeTakeIndex || 0) === tIdx
                return (
                  <div
                    key={take.id}
                    className={`p-2 rounded border transition-colors ${
                      isSelected
                        ? 'bg-zinc-900 border-zinc-700'
                        : 'bg-[#09090b] border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectActiveTake(tIdx)}
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-white bg-white text-black'
                              : 'border-zinc-700 hover:border-zinc-500'
                          }`}
                          title="Escolher como take oficial"
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                        <span className="text-xs text-white font-medium">Take #{take.takeNumber}</span>
                        {isSelected && (
                          <span className="text-[9px] font-mono text-zinc-400 uppercase">Oficial</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePlayTake(take)}
                          className="p-1 text-zinc-400 hover:text-white"
                          title="Ouvir"
                        >
                          {playingTakeId === take.id ? (
                            <Pause className="w-3 h-3" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteTake(take.id)}
                          className="p-1 text-zinc-600 hover:text-red-400"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-1">
                      <span>{new Date(take.createdAt).toLocaleTimeString()}</span>
                      <span>{take.duration.toFixed(2)}s</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Advance to Export */}
          <div className="p-2.5 border-t border-zinc-900 bg-black">
            <button
              onClick={onAdvanceToExport}
              className="w-full py-2 px-3 rounded text-xs font-medium bg-white hover:bg-zinc-200 text-black flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Ir para Mixagem & Export</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
