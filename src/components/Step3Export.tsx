import React, { useState, useRef, useEffect, useCallback } from 'react'
import { DialogueLine, ExportSettings, VoiceEffectPreset } from '../types'
import {
  Upload,
  Folder,
  CheckCircle,
  AlertCircle,
  FileText,
  Film,
  Music,
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Disc,
} from 'lucide-react'

interface Step3ExportProps {
  videoPath: string | null
  videoMediaUrl: string | null
  lines: DialogueLine[]
  exportSettings: ExportSettings
  setExportSettings: React.Dispatch<React.SetStateAction<ExportSettings>>
  isActive?: boolean
}

export const Step3Export: React.FC<Step3ExportProps> = ({
  videoPath,
  videoMediaUrl,
  lines,
  exportSettings,
  setExportSettings,
  isActive = true,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportProgressText, setExportProgressText] = useState<string>('')
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Mix Preview State & Refs
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const takeAudioRef = useRef<HTMLAudioElement | null>(null)

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const playingTakeLineIdRef = useRef<string | null>(null)

  const recordedLinesCount = lines.filter((l) => l.takes && l.takes.length > 0).length

  // Convert custom bg audio path to media URL
  const customBgMediaUrl = exportSettings.customBgAudioPath
    ? window.electronAPI
      ? window.electronAPI.convertToMediaUrl(exportSettings.customBgAudioPath)
      : exportSettings.customBgAudioPath
    : null

  // Active dialogue line for real-time teleprompter overlay
  const activeLine = lines.find(
    (l) => currentTime >= l.startTime && currentTime <= l.endTime
  )

  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00.000'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  // Stop everything when tab becomes inactive
  useEffect(() => {
    if (isActive === false) {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause()
      if (bgAudioRef.current && !bgAudioRef.current.paused) bgAudioRef.current.pause()
      if (takeAudioRef.current && !takeAudioRef.current.paused) takeAudioRef.current.pause()
      setIsPlaying(false)
      playingTakeLineIdRef.current = null
    }
  }, [isActive])

  // Update volume levels on existing players in real-time
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = exportSettings.includeOriginalAudio
        ? exportSettings.originalAudioVolume
        : 0
    }
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = exportSettings.customBgAudioVolume
    }
    if (takeAudioRef.current) {
      takeAudioRef.current.volume = Math.min(1.0, exportSettings.recordedVoicesVolume)
    }
  }, [
    exportSettings.includeOriginalAudio,
    exportSettings.originalAudioVolume,
    exportSettings.customBgAudioVolume,
    exportSettings.recordedVoicesVolume,
  ])

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
      if (bgAudioRef.current && !bgAudioRef.current.paused) bgAudioRef.current.pause()
      if (takeAudioRef.current && !takeAudioRef.current.paused) takeAudioRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch(console.error)
    }
  }, [isPlaying])

  // Keyboard shortcut: Space toggles mix preview when active
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, togglePlay])

  // Video timeupdate syncs all tracks (Original, M&E, Voice Takes)
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const vTime = videoRef.current.currentTime
    setCurrentTime(vTime)

    // 1. Sync Original Audio Volume
    videoRef.current.volume = exportSettings.includeOriginalAudio
      ? exportSettings.originalAudioVolume
      : 0

    // 2. Sync Custom BG Audio (M&E)
    if (bgAudioRef.current && customBgMediaUrl) {
      bgAudioRef.current.volume = exportSettings.customBgAudioVolume
      if (!videoRef.current.paused) {
        if (bgAudioRef.current.paused) {
          bgAudioRef.current.play().catch(() => {})
        }
        if (Math.abs(bgAudioRef.current.currentTime - vTime) > 0.15) {
          bgAudioRef.current.currentTime = vTime
        }
      } else {
        if (!bgAudioRef.current.paused) {
          bgAudioRef.current.pause()
        }
      }
    }

    // 3. Sync Active Dialogue Line Take
    const currentActiveLine = lines.find((l) => vTime >= l.startTime && vTime <= l.endTime)

    if (currentActiveLine && currentActiveLine.takes && currentActiveLine.takes.length > 0) {
      const activeTake =
        currentActiveLine.takes[currentActiveLine.activeTakeIndex || 0] || currentActiveLine.takes[0]

      if (activeTake && (activeTake.audioBlobUrl || activeTake.filePath)) {
        const takeSrc =
          activeTake.audioBlobUrl ||
          (window.electronAPI ? window.electronAPI.convertToMediaUrl(activeTake.filePath) : '')
        const takeOffset = Math.max(0, vTime - currentActiveLine.startTime)

        if (takeAudioRef.current) {
          takeAudioRef.current.volume = Math.min(1.0, exportSettings.recordedVoicesVolume)

          if (playingTakeLineIdRef.current !== currentActiveLine.id) {
            playingTakeLineIdRef.current = currentActiveLine.id
            if (takeAudioRef.current.src !== takeSrc) {
              takeAudioRef.current.src = takeSrc
            }
            takeAudioRef.current.currentTime = takeOffset
            if (!videoRef.current.paused) {
              takeAudioRef.current.play().catch(() => {})
            }
          } else {
            // Already active line, keep in sync
            if (
              !videoRef.current.paused &&
              takeAudioRef.current.paused &&
              takeOffset < (activeTake.duration || 10)
            ) {
              takeAudioRef.current.play().catch(() => {})
            }
            if (Math.abs(takeAudioRef.current.currentTime - takeOffset) > 0.15) {
              takeAudioRef.current.currentTime = takeOffset
            }
          }
        }
      }
    } else {
      // Outside any dialogue line
      if (playingTakeLineIdRef.current !== null) {
        playingTakeLineIdRef.current = null
        if (takeAudioRef.current && !takeAudioRef.current.paused) {
          takeAudioRef.current.pause()
        }
      }
    }
  }

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)

    if (bgAudioRef.current) {
      bgAudioRef.current.currentTime = newTime
    }

    // Check if newTime lands on a dialogue line
    const currentActiveLine = lines.find((l) => newTime >= l.startTime && newTime <= l.endTime)
    if (currentActiveLine && currentActiveLine.takes && currentActiveLine.takes.length > 0) {
      const activeTake =
        currentActiveLine.takes[currentActiveLine.activeTakeIndex || 0] || currentActiveLine.takes[0]
      if (activeTake && takeAudioRef.current) {
        const takeSrc =
          activeTake.audioBlobUrl ||
          (window.electronAPI ? window.electronAPI.convertToMediaUrl(activeTake.filePath) : '')
        if (takeAudioRef.current.src !== takeSrc) {
          takeAudioRef.current.src = takeSrc
        }
        takeAudioRef.current.currentTime = Math.max(0, newTime - currentActiveLine.startTime)
        playingTakeLineIdRef.current = currentActiveLine.id
        if (!videoRef.current.paused) {
          takeAudioRef.current.play().catch(() => {})
        }
      }
    } else {
      if (takeAudioRef.current && !takeAudioRef.current.paused) {
        takeAudioRef.current.pause()
      }
      playingTakeLineIdRef.current = null
    }
  }

  const handleRewind = () => {
    handleSeek(0)
  }

  const handleSelectCustomAudio = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectAudioFile()
    if (result) {
      setExportSettings((prev) => ({
        ...prev,
        customBgAudioPath: result.path,
        includeOriginalAudio: false,
      }))
    }
  }

  const handleSelectOutputDir = async () => {
    if (!window.electronAPI) return
    const dir = await window.electronAPI.selectDirectory()
    if (dir) {
      setExportSettings((prev) => ({ ...prev, outputDir: dir }))
    }
  }

  const handleExportFullVideo = async () => {
    if (!window.electronAPI || !videoPath) return
    setIsExporting(true)
    setExportProgressText('Renderizando vídeo com FFmpeg...')
    setExportSuccessMessage(null)
    setErrorMessage(null)

    try {
      const defaultName = `DubDT_Mix_${Date.now()}.mp4`
      const savePath = await window.electronAPI.saveFileDialog({
        title: 'Salvar Vídeo Dublado',
        defaultPath: defaultName,
        filters: [{ name: 'Vídeo MP4', extensions: ['mp4'] }],
      })

      if (!savePath) {
        setIsExporting(false)
        return
      }

      await window.electronAPI.exportMix({
        videoPath,
        outputPath: savePath,
        exportType: 'video',
        includeOriginalAudio: exportSettings.includeOriginalAudio,
        originalAudioVolume: exportSettings.originalAudioVolume,
        customBgAudioPath: exportSettings.customBgAudioPath,
        customBgAudioVolume: exportSettings.customBgAudioVolume,
        recordedVoicesVolume: exportSettings.recordedVoicesVolume,
        voicePreset: exportSettings.voicePreset,
        enableNoiseSuppression: exportSettings.enableNoiseSuppression,
        noiseSuppressionLevel: exportSettings.noiseSuppressionLevel,
        lines,
      })

      setExportSuccessMessage(`Vídeo exportado com sucesso: ${savePath}`)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar vídeo.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportFullAudio = async () => {
    if (!window.electronAPI || !videoPath) return
    setIsExporting(true)
    setExportProgressText('Mixando faixas de áudio...')
    setExportSuccessMessage(null)
    setErrorMessage(null)

    try {
      const defaultName = `DubDT_Audio_${Date.now()}.wav`
      const savePath = await window.electronAPI.saveFileDialog({
        title: 'Salvar Áudio Mixado',
        defaultPath: defaultName,
        filters: [
          { name: 'Áudio WAV', extensions: ['wav'] },
          { name: 'Áudio MP3', extensions: ['mp3'] },
        ],
      })

      if (!savePath) {
        setIsExporting(false)
        return
      }

      await window.electronAPI.exportMix({
        videoPath,
        outputPath: savePath,
        exportType: 'audio',
        includeOriginalAudio: exportSettings.includeOriginalAudio,
        originalAudioVolume: exportSettings.originalAudioVolume,
        customBgAudioPath: exportSettings.customBgAudioPath,
        customBgAudioVolume: exportSettings.customBgAudioVolume,
        recordedVoicesVolume: exportSettings.recordedVoicesVolume,
        voicePreset: exportSettings.voicePreset,
        enableNoiseSuppression: exportSettings.enableNoiseSuppression,
        noiseSuppressionLevel: exportSettings.noiseSuppressionLevel,
        lines,
      })

      setExportSuccessMessage(`Áudio exportado com sucesso: ${savePath}`)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar áudio.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportClips = async () => {
    if (!window.electronAPI || !videoPath) return
    setIsExporting(true)
    setExportProgressText('Exportando clipes individuais...')
    setExportSuccessMessage(null)
    setErrorMessage(null)

    try {
      let targetDir = exportSettings.outputDir
      if (!targetDir) {
        targetDir = (await window.electronAPI.selectDirectory()) || ''
      }

      if (!targetDir) {
        setIsExporting(false)
        return
      }

      const res = await window.electronAPI.exportClips({
        videoPath,
        outputDir: targetDir,
        clipFormat: exportSettings.clipFormat,
        includeBackground: exportSettings.includeOriginalAudio,
        lines,
        voicePreset: exportSettings.voicePreset,
        recordedVoicesVolume: exportSettings.recordedVoicesVolume,
        enableNoiseSuppression: exportSettings.enableNoiseSuppression,
        noiseSuppressionLevel: exportSettings.noiseSuppressionLevel,
      })

      setExportSuccessMessage(
        `${res.count} clipes (${exportSettings.clipFormat}) exportados em: ${targetDir}`
      )
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar clipes.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportTxt = async () => {
    if (!window.electronAPI) return
    try {
      const defaultName = `Roteiro_DubDT_${Date.now()}.txt`
      const savePath = await window.electronAPI.saveFileDialog({
        title: 'Salvar Roteiro (.txt)',
        defaultPath: defaultName,
        filters: [{ name: 'Arquivo de Texto', extensions: ['txt'] }],
      })

      if (!savePath) return

      await window.electronAPI.exportScriptTxt(savePath, lines)
      setExportSuccessMessage(`Roteiro .txt salvo: ${savePath}`)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar roteiro .txt')
    }
  }

  const voicePresets: { id: VoiceEffectPreset; label: string; desc: string }[] = [
    { id: 'clean', label: 'Natural', desc: 'Som original' },
    { id: 'loudnorm', label: 'Normalizador', desc: 'EBU R128 Broadcast' },
    { id: 'radio', label: 'Rádio/Tel', desc: 'Filtro passa-banda' },
    { id: 'reverb', label: 'Eco/Reverb', desc: 'Efeito espacial' },
  ]

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-y-auto bg-[#050505] p-4 sm:p-5">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div>
            <h1 className="text-sm font-semibold text-white uppercase tracking-wider">
              Mixagem & Exportação
            </h1>
            <p className="text-xs text-zinc-500">
              Ouça a preview da mixagem em tempo real e escolha o formato final
            </p>
          </div>

          <span className="text-xs font-mono text-zinc-400">
            {recordedLinesCount}/{lines.length} falas gravadas
          </span>
        </div>

        {/* Feedback Messages */}
        {exportSuccessMessage && (
          <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded flex items-center gap-2 text-xs text-zinc-200">
            <CheckCircle className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
            <span className="font-mono text-[11px] truncate">{exportSuccessMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 bg-red-950/40 border border-red-900/60 rounded flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="font-mono text-[11px]">{errorMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MIX PREVIEW MONITOR (Video + Synced Audio Tracks + Subtitles) */}
        {/* ========================================================================= */}
        {videoMediaUrl ? (
          <div className="bg-[#09090b] border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
            {/* Monitor Header */}
            <div className="px-3.5 py-2 bg-black border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-white tracking-wide uppercase">
                  Preview da Mixagem
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">(Ao Vivo)</span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Vozes:</span>
                  <span className="text-white">
                    {Math.round(exportSettings.recordedVoicesVolume * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Original:</span>
                  <span className="text-white">
                    {exportSettings.includeOriginalAudio
                      ? `${Math.round(exportSettings.originalAudioVolume * 100)}%`
                      : 'Mudo'}
                  </span>
                </div>
                {exportSettings.customBgAudioPath && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">M&E:</span>
                    <span className="text-white">
                      {Math.round(exportSettings.customBgAudioVolume * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Video Monitor with Live Subtitle Overlay */}
            <div className="relative bg-black flex items-center justify-center min-h-[220px] max-h-[360px] overflow-hidden group">
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
                className="w-full max-h-[360px] object-contain cursor-pointer"
              />

              {/* Hidden Synced Audio Players */}
              {customBgMediaUrl && <audio ref={bgAudioRef} src={customBgMediaUrl} preload="auto" />}
              <audio ref={takeAudioRef} preload="auto" />

              {/* Live Subtitle Overlay */}
              {activeLine && (
                <div className="absolute bottom-3 inset-x-4 text-center pointer-events-none select-none z-10 animate-in fade-in duration-75">
                  <span className="inline-block bg-black/85 backdrop-blur-sm text-yellow-300 font-medium px-3.5 py-1 rounded text-xs sm:text-sm border border-yellow-500/30 shadow-2xl max-w-xl truncate">
                    "{activeLine.text}"
                  </span>
                </div>
              )}

              {/* Big Play/Pause Center Overlay on Hover when Paused */}
              {!isPlaying && (
                <div
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[1px] transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center shadow-xl transition-transform hover:scale-105">
                    <Play className="w-5 h-5 ml-0.5 fill-black" />
                  </div>
                </div>
              )}
            </div>

            {/* Scrubber Timeline with Dialogue Markers */}
            <div className="bg-black/95 px-4 pt-3 pb-2 border-t border-zinc-900 space-y-2 select-none">
              <div className="relative w-full h-4 flex items-center cursor-pointer group/timeline">
                {/* Timeline background track */}
                <div className="w-full h-1.5 bg-zinc-800 rounded-full relative overflow-hidden">
                  {/* Dialogue Line Marker Segments */}
                  {duration > 0 &&
                    lines.map((l) => {
                      const leftPct = Math.max(0, Math.min(100, (l.startTime / duration) * 100))
                      const widthPct = Math.max(0.5, Math.min(100 - leftPct, ((l.endTime - l.startTime) / duration) * 100))
                      const hasTake = l.takes && l.takes.length > 0
                      return (
                        <div
                          key={l.id}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          title={`#${lines.indexOf(l) + 1}: "${l.text}" (${hasTake ? 'Gravado' : 'Sem take'})`}
                          className={`absolute inset-y-0 ${
                            hasTake ? 'bg-emerald-500/70 hover:bg-emerald-400' : 'bg-zinc-600/50 hover:bg-zinc-500'
                          }`}
                        />
                      )
                    })}

                  {/* Playhead Progress */}
                  <div
                    style={{
                      width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    }}
                    className="h-full bg-white rounded-full transition-[width] duration-75"
                  />
                </div>

                {/* Range input for scrubbing */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* Transport Buttons & Timecode */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 bg-white hover:bg-zinc-200 text-black rounded transition-colors"
                    title={isPlaying ? 'Pausar (Espaço)' : 'Ouvir Mixagem (Espaço)'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={handleRewind}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                    title="Voltar ao início"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono text-zinc-400 text-xs ml-1">
                    <span className="text-white font-medium">{formatTime(currentTime)}</span> /{' '}
                    <span>{formatTime(duration)}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="hidden sm:inline">Pressione Espaço para tocar/pausar</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-zinc-400 font-mono">Mix Ativa</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-lg text-center text-xs text-zinc-600">
            Nenhum vídeo selecionado para mixagem.
          </div>
        )}

        {/* Channel Strips (Mixer) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Canal 1: Vozes */}
          <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-xs font-medium text-white uppercase tracking-wider">
                Vozes Dubladas
              </span>
              <span className="text-[10px] font-mono text-zinc-500">{recordedLinesCount} falas</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 text-[11px]">Volume</span>
                <span className="font-mono text-zinc-300 text-xs">
                  {Math.round(exportSettings.recordedVoicesVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={exportSettings.recordedVoicesVolume}
                onChange={(e) =>
                  setExportSettings((prev) => ({
                    ...prev,
                    recordedVoicesVolume: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Presets */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-900">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">
                Filtro de Voz
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {voicePresets.map((p) => {
                  const active = exportSettings.voicePreset === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setExportSettings((prev) => ({ ...prev, voicePreset: p.id }))
                      }
                      className={`p-1.5 rounded text-left border transition-colors ${
                        active
                          ? 'border-white bg-zinc-900 text-white'
                          : 'border-zinc-900 bg-black text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
                      }`}
                    >
                      <div className="text-[11px] font-medium">{p.label}</div>
                      <div className="text-[9px] text-zinc-500 truncate">{p.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Supressão de Ruído Modulável */}
            <div className="space-y-2 pt-2 border-t border-zinc-900">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                  Supressão de Ruído
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setExportSettings((prev) => ({
                      ...prev,
                      enableNoiseSuppression: !prev.enableNoiseSuppression,
                    }))
                  }
                  className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                    exportSettings.enableNoiseSuppression
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  {exportSettings.enableNoiseSuppression ? 'ATIVO' : 'DESATIVADO'}
                </button>
              </div>

              {exportSettings.enableNoiseSuppression && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 text-[10px]">Intensidade (FFT)</span>
                    <span className="font-mono text-zinc-300 text-[11px]">
                      {exportSettings.noiseSuppressionLevel}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={exportSettings.noiseSuppressionLevel}
                    onChange={(e) =>
                      setExportSettings((prev) => ({
                        ...prev,
                        noiseSuppressionLevel: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full accent-emerald-400 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Canal 2: Áudio Original */}
          <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-xs font-medium text-white uppercase tracking-wider">
                Áudio Original
              </span>
              <button
                type="button"
                onClick={() =>
                  setExportSettings((prev) => ({
                    ...prev,
                    includeOriginalAudio: !prev.includeOriginalAudio,
                  }))
                }
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  exportSettings.includeOriginalAudio
                    ? 'bg-white text-black'
                    : 'bg-zinc-900 text-zinc-500'
                }`}
              >
                {exportSettings.includeOriginalAudio ? 'LIGADO' : 'MUDO'}
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 text-[11px]">Volume</span>
                <span className="font-mono text-zinc-300 text-xs">
                  {exportSettings.includeOriginalAudio
                    ? `${Math.round(exportSettings.originalAudioVolume * 100)}%`
                    : '0%'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                disabled={!exportSettings.includeOriginalAudio}
                value={exportSettings.originalAudioVolume}
                onChange={(e) =>
                  setExportSettings((prev) => ({
                    ...prev,
                    originalAudioVolume: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer disabled:opacity-30"
              />
            </div>
          </div>

          {/* Canal 3: Música & Efeitos (M&E) */}
          <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-xs font-medium text-white uppercase tracking-wider">
                Trilha M&E
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Música e Efeitos</span>
            </div>

            <div>
              <button
                onClick={handleSelectCustomAudio}
                className="w-full py-2 px-3 border border-dashed border-zinc-800 hover:border-zinc-700 rounded text-left transition-colors flex items-center justify-between"
              >
                <div className="truncate pr-2">
                  <div className="text-[11px] text-white font-medium truncate">
                    {exportSettings.customBgAudioPath
                      ? exportSettings.customBgAudioPath.split('\\').pop()
                      : 'Importar M&E'}
                  </div>
                  <div className="text-[9px] text-zinc-500">
                    {exportSettings.customBgAudioPath ? 'Trilha carregada' : 'Substitui o áudio original'}
                  </div>
                </div>
                <Music className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              </button>
            </div>

            {exportSettings.customBgAudioPath && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 text-[11px]">Volume M&E</span>
                  <span className="font-mono text-zinc-300 text-xs">
                    {Math.round(exportSettings.customBgAudioVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={exportSettings.customBgAudioVolume}
                  onChange={(e) =>
                    setExportSettings((prev) => ({
                      ...prev,
                      customBgAudioVolume: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Export Formats */}
        <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <span className="text-xs font-medium text-white uppercase tracking-wider">
              Exportar Projeto
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Full Video */}
            <button
              onClick={handleExportFullVideo}
              disabled={isExporting || recordedLinesCount === 0}
              className="p-3 bg-white hover:bg-zinc-200 text-black disabled:opacity-30 rounded text-left transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                <span className="text-xs font-semibold">Vídeo Completo</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">MP4 com vídeo e áudio mixados</p>
            </button>

            {/* Master Audio */}
            <button
              onClick={handleExportFullAudio}
              disabled={isExporting || recordedLinesCount === 0}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-30 border border-zinc-800 rounded text-left transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium">Áudio Master</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Exporta WAV/MP3 com a mixagem final</p>
            </button>

            {/* Script Text */}
            <button
              onClick={handleExportTxt}
              disabled={isExporting || lines.length === 0}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-30 border border-zinc-800 rounded text-left transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium">Roteiro (.txt)</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Falas separadas por quebra de linha</p>
            </button>
          </div>

          {/* Individual Clips */}
          <div className="p-3 bg-black border border-zinc-900 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-xs font-medium text-white block">Exportar Clipes Separados</span>
              <span className="text-[10px] text-zinc-500">Corta cada fala em um arquivo individual</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="flex bg-[#09090b] border border-zinc-800 rounded p-0.5">
                <button
                  onClick={() =>
                    setExportSettings((prev) => ({ ...prev, clipFormat: 'video' }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    exportSettings.clipFormat === 'video' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                  }`}
                >
                  .mp4
                </button>
                <button
                  onClick={() =>
                    setExportSettings((prev) => ({ ...prev, clipFormat: 'audio' }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    exportSettings.clipFormat === 'audio' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                  }`}
                >
                  .wav
                </button>
              </div>

              <button
                onClick={handleExportClips}
                disabled={isExporting || recordedLinesCount === 0}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white text-xs font-medium rounded transition-colors"
              >
                Exportar Todos
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          {isExporting && (
            <div className="p-2.5 bg-black border border-zinc-800 rounded text-xs text-zinc-400 flex items-center gap-2 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>{exportProgressText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
