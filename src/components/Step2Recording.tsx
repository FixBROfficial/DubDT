import React, { useEffect, useRef, useState, useCallback } from 'react'
import { DialogueLine, DialogueTake, AudioSettings } from '../types'
import { playCountdownStep } from '../utils/beeps'
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Volume2,
  VolumeX,
  Radio,
  Trash2,
  Check,
  Headphones,
} from 'lucide-react'

interface Step2RecordingProps {
  videoMediaUrl: string
  lines: DialogueLine[]
  setLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>
  audioSettings: AudioSettings
  onUpdateAudioSettings: (settings: Partial<AudioSettings>) => void
  onOpenSettings: () => void
  onAdvanceToExport: () => void
}

export const Step2Recording: React.FC<Step2RecordingProps> = ({
  videoMediaUrl,
  lines,
  setLines,
  audioSettings,
  onUpdateAudioSettings,
  onOpenSettings,
  onAdvanceToExport,
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0)
  const currentLine = lines[currentLineIndex] || null

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

  // Active Take audio preview player
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null)
  const takeAudioRef = useRef<HTMLAudioElement | null>(null)

  // Format time mm:ss.ms
  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00.000'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  // Lock video to current line's timestamp when line changes
  useEffect(() => {
    if (videoRef.current && currentLine) {
      videoRef.current.pause()
      const seekTime = Math.max(0, currentLine.startTime - (audioSettings.preRollSeconds || 0))
      videoRef.current.currentTime = seekTime
      setIsPlayingPreview(false)
    }
  }, [currentLineIndex, currentLine, audioSettings.preRollSeconds])

  // Stop current take audio preview
  const stopTakePreview = () => {
    if (takeAudioRef.current) {
      takeAudioRef.current.pause()
      takeAudioRef.current.currentTime = 0
    }
    setPlayingTakeId(null)
  }

  // Play a specific take's recorded audio
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

  // Set active take for the current line
  const handleSelectActiveTake = (takeIndex: number) => {
    setLines((prev) =>
      prev.map((l, idx) => (idx === currentLineIndex ? { ...l, activeTakeIndex: takeIndex } : l))
    )
  }

  // Delete a take
  const handleDeleteTake = (takeId: string) => {
    stopTakePreview()
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== currentLineIndex) return l
        const updatedTakes = l.takes.filter((t) => t.id !== takeId)
        return {
          ...l,
          takes: updatedTakes,
          activeTakeIndex: Math.max(0, Math.min(l.activeTakeIndex, updatedTakes.length - 1)),
        }
      })
    )
  }

  // Start recording process (Count down -> Record -> Auto Stop)
  const startRecordingProcess = useCallback(async () => {
    if (isRecording || isCountingDown || !currentLine) return

    // Pre-seek video to pre-roll
    const preRoll = audioSettings.preRollSeconds || 0
    const startPoint = Math.max(0, currentLine.startTime - preRoll)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = startPoint
      videoRef.current.volume = audioSettings.originalAudioVolumeDuringRecording
    }

    // 3s Countdown
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
        if (audioSettings.countdownBeeps) playCountdownStep(0) // GO Beep!
        await executeRecording()
      }
    }, 1000)
  }, [isRecording, isCountingDown, currentLine, audioSettings])

  // Actual recording execution
  const executeRecording = async () => {
    if (!currentLine) return

    try {
      const constraints: MediaStreamConstraints = {
        audio: audioSettings.inputDeviceId
          ? { deviceId: { exact: audioSettings.inputDeviceId } }
          : true,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      micStreamRef.current = stream

      // Web Audio setup with Gain
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
        if (window.electronAPI) {
          try {
            const saved = await window.electronAPI.saveTakeAudio(currentLine.id, takeNum, arrayBuffer)
            savedFilePath = saved.filePath
          } catch (e) {
            console.error('Erro salvando take em disco:', e)
          }
        }

        const newTake: DialogueTake = {
          id: `take_${Date.now()}`,
          takeNumber: takeNum,
          filePath: savedFilePath,
          duration: currentLine.endTime - currentLine.startTime,
          createdAt: Date.now(),
          audioBlobUrl: blobUrl,
        }

        setLines((prev) =>
          prev.map((l, idx) => {
            if (idx !== currentLineIndex) return l
            const newTakes = [...(l.takes || []), newTake]
            return {
              ...l,
              takes: newTakes,
              activeTakeIndex: newTakes.length - 1, // Auto-select latest take
            }
          })
        )

        // Cleanup stream & context
        stream.getTracks().forEach((t) => t.stop())
        ctx.close().catch(() => {})
      }

      // Start recording & video playback
      mediaRecorder.start(100)
      setIsRecording(true)

      if (videoRef.current) {
        videoRef.current.currentTime = currentLine.startTime
        videoRef.current.volume = audioSettings.originalAudioVolumeDuringRecording
        videoRef.current.play()
      }

      // Auto-stop when speech duration finishes
      const recordingDurationMs = Math.max(500, (currentLine.endTime - currentLine.startTime) * 1000)
      setTimeout(() => {
        stopRecording()
      }, recordingDurationMs)
    } catch (err) {
      console.error('Falha ao gravar:', err)
      setIsRecording(false)
    }
  }

  // Stop recording manually or automatically
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (videoRef.current) {
      videoRef.current.pause()
    }
    setIsRecording(false)
  }, [])

  // Keyboard navigation & Shortcuts: R to record/re-record, Arrows to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
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
      } else if (e.key === ' ') {
        e.preventDefault()
        handleTogglePreview()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording, startRecordingProcess, stopRecording, currentLineIndex, lines.length])

  // Navigation handlers
  const handleNextLine = () => {
    if (currentLineIndex < lines.length - 1) {
      stopRecording()
      stopTakePreview()
      setCurrentLineIndex((prev) => prev + 1)
    }
  }

  const handlePrevLine = () => {
    if (currentLineIndex > 0) {
      stopRecording()
      stopTakePreview()
      setCurrentLineIndex((prev) => prev - 1)
    }
  }

  // Toggle video preview of current line
  const handleTogglePreview = () => {
    if (!videoRef.current || !currentLine) return
    if (isPlayingPreview) {
      videoRef.current.pause()
      setIsPlayingPreview(false)
    } else {
      videoRef.current.currentTime = currentLine.startTime
      videoRef.current.volume = audioSettings.masterVolume
      videoRef.current.play()
      setIsPlayingPreview(true)

      const lineDurationMs = (currentLine.endTime - currentLine.startTime) * 1000
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = currentLine.startTime
        }
        setIsPlayingPreview(false)
      }, lineDurationMs)
    }
  }

  if (!currentLine) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Nenhuma fala cadastrada. Volte para a etapa anterior para marcar as falas.
      </div>
    )
  }

  const activeTake = currentLine.takes?.[currentLine.activeTakeIndex || 0]

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-zinc-950">
      {/* Studio Top Info Bar */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between">
        {/* Progress & Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
            <span className="text-xs font-bold text-violet-400">FALA</span>
            <span className="text-xs font-extrabold text-white">
              #{currentLineIndex + 1}
            </span>
            <span className="text-xs text-zinc-500">/ {lines.length}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevLine}
              disabled={currentLineIndex === 0}
              title="Fala Anterior (Seta Esquerda)"
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextLine}
              disabled={currentLineIndex === lines.length - 1}
              title="Próxima Fala (Seta Direita)"
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
            <span>{formatTime(currentLine.startTime)}</span> ➔{' '}
            <span>{formatTime(currentLine.endTime)}</span>
            <span className="text-zinc-500 ml-2">
              ({(currentLine.endTime - currentLine.startTime).toFixed(2)}s)
            </span>
          </div>
        </div>

        {/* Quick Audio Controls During Recording */}
        <div className="flex items-center gap-4">
          {/* Audio Original Volume Slider */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">
            <span className="text-[11px] font-medium text-zinc-300">Som Original:</span>
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
              className="w-20 accent-indigo-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
            <span className="font-mono text-[10px] text-indigo-400 min-w-[28px]">
              {Math.round(audioSettings.originalAudioVolumeDuringRecording * 100)}%
            </span>
          </div>

          {/* Mic Gain Quick Info */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">
            <Mic className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-medium text-zinc-300">Ganho Mic:</span>
            <span className="font-mono text-[10px] text-violet-400 font-bold">
              {Math.round(audioSettings.micGain * 100)}%
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            title="Configurações completas de áudio"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Center: Video + Big Teleprompter */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Video & Teleprompter */}
        <div className="flex-1 flex flex-col border-r border-zinc-800/80 bg-zinc-950 overflow-hidden relative">
          {/* Video Container */}
          <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden p-2 min-h-0">
            <video
              ref={videoRef}
              src={videoMediaUrl}
              className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
            />

            {/* Visual 3-2-1 Countdown Overlay */}
            {isCountingDown && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 animate-in fade-in duration-100">
                <div className="text-8xl font-black text-amber-400 font-mono tracking-tighter drop-shadow-[0_0_35px_rgba(251,191,36,0.6)] animate-ping">
                  {countdownValue}
                </div>
                <p className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mt-4">
                  Prepare-se para dublar...
                </p>
              </div>
            )}

            {/* Recording Active Indicator Banner */}
            {isRecording && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-red-600/90 text-white px-3 py-1.5 rounded-full shadow-lg shadow-red-950/80 backdrop-blur-md animate-pulse">
                <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                <span className="text-xs font-black tracking-wider uppercase">Gravando Fala</span>
              </div>
            )}
          </div>

          {/* Teleprompter: Big dialogue line display for the voice actor */}
          <div className="bg-zinc-900 border-t border-zinc-800 p-5 flex flex-col items-center justify-center text-center shadow-inner relative">
            <div className="text-[11px] font-mono uppercase text-violet-400 tracking-wider mb-1 font-semibold flex items-center gap-1.5">
              <span>Sua Fala:</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide max-w-3xl leading-snug drop-shadow-sm select-text">
              "{currentLine.text}"
            </h1>

            {/* Primary Action Buttons: RECORD (R), PREVIEW, NEXT */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleTogglePreview}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-700/60 shadow transition-all"
              >
                {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>Ouvir Trecho (Espaço)</span>
              </button>

              <button
                onClick={isRecording ? stopRecording : startRecordingProcess}
                disabled={isCountingDown}
                className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-xl ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-950/80 animate-pulse'
                    : isCountingDown
                    ? 'bg-amber-600 text-white cursor-wait opacity-80'
                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-950/50'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>Parar Gravação (R)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Gravar Fala (R)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleNextLine}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-700/60 shadow transition-all"
              >
                <span>Próxima Fala</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Takes List & Studio Management */}
        <div className="w-80 bg-zinc-900 flex flex-col justify-between overflow-hidden">
          {/* Takes Header */}
          <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-red-400" />
                Takes Gravados
              </h3>
              <p className="text-[11px] text-zinc-400">
                {currentLine.takes?.length || 0} gravações para esta fala
              </p>
            </div>
          </div>

          {/* Takes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!currentLine.takes || currentLine.takes.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                  <Mic className="w-5 h-5" />
                </div>
                <p className="text-xs text-zinc-400 font-medium mb-1">Nenhum take gravado</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Pressione <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300 font-mono">R</kbd> ou
                  clique em "Gravar Fala" para iniciar a contagem de 3 segundos.
                </p>
              </div>
            ) : (
              currentLine.takes.map((take, tIdx) => {
                const isSelected = (currentLine.activeTakeIndex || 0) === tIdx
                return (
                  <div
                    key={take.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-violet-950/30 border-violet-500/60 shadow-sm shadow-violet-950/40'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectActiveTake(tIdx)}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-violet-500 bg-violet-600 text-white'
                              : 'border-zinc-600 hover:border-zinc-400'
                          }`}
                          title="Escolher este take como o oficial da mixagem"
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                        <span className="text-xs font-bold text-white">
                          Take #{take.takeNumber}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.2 rounded font-semibold uppercase">
                            Oficial
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Play take audio */}
                        <button
                          onClick={() => handlePlayTake(take)}
                          title="Ouvir este take"
                          className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                        >
                          {playingTakeId === take.id ? (
                            <Pause className="w-3.5 h-3.5 text-violet-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Delete take */}
                        <button
                          onClick={() => handleDeleteTake(take.id)}
                          title="Deletar este take"
                          className="p-1 hover:text-red-400 text-zinc-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{new Date(take.createdAt).toLocaleTimeString()}</span>
                      <span>Duração: {take.duration.toFixed(2)}s</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Advance to Export Area */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-950/70">
            <button
              onClick={onAdvanceToExport}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 transition-all"
            >
              <Sliders className="w-4 h-4" />
              <span>Concluir e Ir para Mixagem</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
