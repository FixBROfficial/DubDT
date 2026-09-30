import React, { useState } from 'react'
import { DialogueLine, ExportSettings, VoiceEffectPreset } from '../types'
import {
  Sliders,
  Film,
  Music,
  Mic,
  Upload,
  Folder,
  Download,
  CheckCircle,
  AlertCircle,
  FileText,
  Scissors,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface Step3ExportProps {
  videoPath: string | null
  lines: DialogueLine[]
  exportSettings: ExportSettings
  setExportSettings: React.Dispatch<React.SetStateAction<ExportSettings>>
}

export const Step3Export: React.FC<Step3ExportProps> = ({
  videoPath,
  lines,
  exportSettings,
  setExportSettings,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportProgressText, setExportProgressText] = useState<string>('')
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Count recorded takes
  const recordedLinesCount = lines.filter((l) => l.takes && l.takes.length > 0).length

  // Select custom M&E Audio
  const handleSelectCustomAudio = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectAudioFile()
    if (result) {
      setExportSettings((prev) => ({
        ...prev,
        customBgAudioPath: result.path,
        includeOriginalAudio: false, // Automatically prefer M&E when uploaded
      }))
    }
  }

  // Select Output Directory
  const handleSelectOutputDir = async () => {
    if (!window.electronAPI) return
    const dir = await window.electronAPI.selectDirectory()
    if (dir) {
      setExportSettings((prev) => ({ ...prev, outputDir: dir }))
    }
  }

  // 1. Export Full Video (.mp4)
  const handleExportFullVideo = async () => {
    if (!window.electronAPI || !videoPath) return
    setIsExporting(true)
    setExportProgressText('Renderizando e mixando o vídeo completo com FFmpeg...')
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
        lines,
      })

      setExportSuccessMessage(`Vídeo dublado exportado com sucesso em: ${savePath}`)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar vídeo.')
    } finally {
      setIsExporting(false)
    }
  }

  // 2. Export Full Audio (.wav or .mp3)
  const handleExportFullAudio = async () => {
    if (!window.electronAPI || !videoPath) return
    setIsExporting(true)
    setExportProgressText('Mixando faixas de áudio com FFmpeg...')
    setExportSuccessMessage(null)
    setErrorMessage(null)

    try {
      const defaultName = `DubDT_AudioMix_${Date.now()}.wav`
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
        lines,
      })

      setExportSuccessMessage(`Áudio mixado exportado com sucesso em: ${savePath}`)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar áudio.')
    } finally {
      setIsExporting(false)
    }
  }

  // 3. Export Individual Clips (Batch)
  const handleExportClips = async () => {
    if (!window.electronAPI || !videoPath) return
    setIsExporting(true)
    setExportProgressText('Cortando e exportando clipes individuais...')
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
      })

      setExportSuccessMessage(
        `${res.count} clipes (${exportSettings.clipFormat === 'video' ? 'vídeos' : 'áudios'}) exportados para: ${targetDir}`
      )
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar clipes.')
    } finally {
      setIsExporting(false)
    }
  }

  // 4. Export Dialogue Script as .txt
  const handleExportTxt = async () => {
    if (!window.electronAPI) return
    try {
      const defaultName = `Roteiro_DubDT_${Date.now()}.txt`
      const savePath = await window.electronAPI.saveFileDialog({
        title: 'Salvar Roteiro de Falas (.txt)',
        defaultPath: defaultName,
        filters: [{ name: 'Arquivo de Texto', extensions: ['txt'] }],
      })

      if (!savePath) return

      await window.electronAPI.exportScriptTxt(savePath, lines)
      setExportSuccessMessage(`Roteiro .txt salvo com sucesso em: ${savePath}`)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao exportar roteiro .txt')
    }
  }

  const voicePresets: { id: VoiceEffectPreset; label: string; desc: string; icon: string }[] = [
    { id: 'clean', label: 'Natural / Clean', desc: 'Sem filtros adicionais', icon: '🎙️' },
    { id: 'loudnorm', label: 'Normalizador', desc: 'Volume equilibrado broadcast (EBU R128)', icon: '⚡' },
    { id: 'radio', label: 'Rádio / Telefone', desc: 'Filtro passa-alta e passa-baixa', icon: '📻' },
    { id: 'reverb', label: 'Eco / Pensamento', desc: 'Reverberação espacial', icon: '🌌' },
  ]

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto bg-zinc-950 p-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Central de Mixagem & Exportação
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Mixe as trilhas, aplique efeitos de voz e exporte o resultado final em alta definição.
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-zinc-400 block">Status das Falas:</span>
            <span className="text-xs font-bold text-violet-400">
              {recordedLinesCount} de {lines.length} falas gravadas
            </span>
          </div>
        </div>

        {/* Feedback Messages */}
        {exportSuccessMessage && (
          <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-xs text-emerald-300 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium break-all">{exportSuccessMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl flex items-center gap-3 text-xs text-red-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Channel Mixer Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Canal 1: Vozes Gravadas */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-violet-600/20 text-violet-400 rounded-lg">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Vozes Dubladas
                    </h3>
                    <span className="text-[10px] text-zinc-400">Takes gravados no DubDT</span>
                  </div>
                </div>
                <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-bold">
                  {recordedLinesCount} falas
                </span>
              </div>

              {/* Volume Fader */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Volume das Falas</span>
                  <span className="font-mono text-violet-400 font-bold">
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
                  className="w-full accent-violet-500 h-1.5 bg-zinc-950 rounded appearance-none cursor-pointer"
                />
              </div>

              {/* Presets Rápidos de Efeito de Voz */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Preset de Efeito na Voz:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {voicePresets.map((p) => {
                    const active = exportSettings.voicePreset === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setExportSettings((prev) => ({ ...prev, voicePreset: p.id }))
                        }
                        className={`p-2 rounded-xl text-left border transition-all ${
                          active
                            ? 'bg-violet-600/20 border-violet-500 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1">
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{p.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Canal 2: Áudio Original do Vídeo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Áudio Original
                    </h3>
                    <span className="text-[10px] text-zinc-400">Trilha original do vídeo</span>
                  </div>
                </div>

                {/* Toggle on/off */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.includeOriginalAudio}
                    onChange={(e) =>
                      setExportSettings((prev) => ({
                        ...prev,
                        includeOriginalAudio: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Volume Fader */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Volume do Som Original</span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {exportSettings.includeOriginalAudio
                      ? `${Math.round(exportSettings.originalAudioVolume * 100)}%`
                      : 'MUTADO'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  disabled={!exportSettings.includeOriginalAudio}
                  value={exportSettings.originalAudioVolume}
                  onChange={(e) =>
                    setExportSettings((prev) => ({
                      ...prev,
                      originalAudioVolume: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-indigo-500 h-1.5 bg-zinc-950 rounded appearance-none cursor-pointer disabled:opacity-40"
                />
              </div>

              <div className="text-[11px] text-zinc-500 leading-relaxed pt-2 border-t border-zinc-800/80">
                Se você não tiver uma trilha instrumental separada, pode abaixar o volume do áudio
                original para suas falas se destacarem por cima.
              </div>
            </div>
          </div>

          {/* Canal 3: Trilha Sem Falas (M&E / Custom Audio) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Áudio Sem Falas (M&E)
                    </h3>
                    <span className="text-[10px] text-zinc-400">Trilha instrumental / Efeitos</span>
                  </div>
                </div>

                {exportSettings.customBgAudioPath && (
                  <button
                    onClick={() =>
                      setExportSettings((prev) => ({ ...prev, customBgAudioPath: null }))
                    }
                    className="text-[10px] text-red-400 hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>

              {/* Upload Button or Selected Audio info */}
              {!exportSettings.customBgAudioPath ? (
                <button
                  onClick={handleSelectCustomAudio}
                  className="w-full py-3 bg-zinc-950 hover:bg-zinc-800/80 border border-dashed border-zinc-700 rounded-xl flex items-center justify-center gap-2 text-xs text-zinc-300 font-medium transition-all"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Carregar Áudio Sem Falas</span>
                </button>
              ) : (
                <div className="p-2.5 bg-zinc-950 border border-emerald-500/40 rounded-xl space-y-1">
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                    Áudio Selecionado:
                  </span>
                  <p className="text-xs text-white truncate font-mono">
                    {exportSettings.customBgAudioPath.split(/[/\\]/).pop()}
                  </p>
                </div>
              )}

              {/* Volume Fader */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Volume da Trilha M&E</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {Math.round(exportSettings.customBgAudioVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  disabled={!exportSettings.customBgAudioPath}
                  value={exportSettings.customBgAudioVolume}
                  onChange={(e) =>
                    setExportSettings((prev) => ({
                      ...prev,
                      customBgAudioVolume: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-500 h-1.5 bg-zinc-950 rounded appearance-none cursor-pointer disabled:opacity-40"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Export Actions Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-violet-400" />
                Opções de Exportação
              </h2>
              <p className="text-xs text-zinc-400">
                Escolha se deseja o arquivo completo ou os clipes cortados individualmente
              </p>
            </div>

            {/* Folder selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 hidden sm:inline">Pasta Padrão:</span>
              <button
                onClick={handleSelectOutputDir}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 rounded-lg"
              >
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span className="max-w-[200px] truncate">
                  {exportSettings.outputDir || 'Escolher Pasta...'}
                </span>
              </button>
            </div>
          </div>

          {/* Export Buttons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Export Full Video */}
            <button
              onClick={handleExportFullVideo}
              disabled={isExporting}
              className="p-4 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-violet-950/50 flex flex-col items-start justify-between space-y-3 transition-all text-left group"
            >
              <div className="p-2 bg-white/10 rounded-lg group-hover:scale-105 transition-transform">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold block">Exportar Vídeo Completo</span>
                <span className="text-[11px] text-violet-200">
                  Gera o vídeo (.mp4) com imagem e mixagem final de som
                </span>
              </div>
            </button>

            {/* 2. Export Full Audio */}
            <button
              onClick={handleExportFullAudio}
              disabled={isExporting}
              className="p-4 bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-white rounded-xl shadow flex flex-col items-start justify-between space-y-3 transition-all text-left group"
            >
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg group-hover:scale-105 transition-transform">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold block text-zinc-100">Exportar Áudio Completo</span>
                <span className="text-[11px] text-zinc-400">
                  Gera arquivo de áudio (.wav / .mp3) mixado de ponta a ponta
                </span>
              </div>
            </button>

            {/* 3. Export Script .txt */}
            <button
              onClick={handleExportTxt}
              disabled={isExporting}
              className="p-4 bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-white rounded-xl shadow flex flex-col items-start justify-between space-y-3 transition-all text-left group"
            >
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold block text-zinc-100">Exportar Roteiro (.txt)</span>
                <span className="text-[11px] text-zinc-400">
                  Gera o arquivo de texto com timestamps e falas anotadas
                </span>
              </div>
            </button>
          </div>

          {/* Export Individual Clips Section */}
          <div className="p-4 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-rose-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Exportar Timestamps / Clipes Separadamente
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Corta cada fala demarcada como um arquivo individual
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                {/* Format selection */}
                <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 text-[11px]">Formato:</span>
                  <button
                    onClick={() =>
                      setExportSettings((prev) => ({ ...prev, clipFormat: 'video' }))
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                      exportSettings.clipFormat === 'video'
                        ? 'bg-rose-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Vídeos (.mp4)
                  </button>
                  <button
                    onClick={() =>
                      setExportSettings((prev) => ({ ...prev, clipFormat: 'audio' }))
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                      exportSettings.clipFormat === 'audio'
                        ? 'bg-rose-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Áudios (.wav)
                  </button>
                </div>

                <button
                  onClick={handleExportClips}
                  disabled={isExporting || recordedLinesCount === 0}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Exportar Todos os Clipes</span>
                </button>
              </div>
            </div>
          </div>

          {/* Loading overlay indicator during FFmpeg export */}
          {isExporting && (
            <div className="p-4 bg-zinc-950 border border-violet-500/50 rounded-xl flex items-center gap-3 text-xs text-violet-300">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold block text-white">Processando Exportação...</span>
                <span>{exportProgressText}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
