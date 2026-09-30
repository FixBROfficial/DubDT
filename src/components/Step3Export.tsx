import React, { useState } from 'react'
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

  const recordedLinesCount = lines.filter((l) => l.takes && l.takes.length > 0).length

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
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-y-auto bg-[#050505] p-5">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div>
            <h1 className="text-sm font-semibold text-white uppercase tracking-wider">
              Mixagem & Exportação
            </h1>
            <p className="text-xs text-zinc-500">Ajuste os canais de áudio e escolha o formato de saída</p>
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

        {/* Channel Strips (Mixer) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Canal 1: Vozes */}
          <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-xs font-medium text-white uppercase tracking-wider">Vozes Dubladas</span>
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
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider block">Filtro de Voz</span>
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
          </div>

          {/* Canal 2: Original */}
          <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-xs font-medium text-white uppercase tracking-wider">Áudio Original</span>
              <input
                type="checkbox"
                checked={exportSettings.includeOriginalAudio}
                onChange={(e) =>
                  setExportSettings((prev) => ({
                    ...prev,
                    includeOriginalAudio: e.target.checked,
                  }))
                }
                className="accent-white h-3.5 w-3.5 rounded bg-black border border-zinc-700"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 text-[11px]">Volume</span>
                <span className="font-mono text-zinc-300 text-xs">
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
                className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer disabled:opacity-20"
              />
            </div>

            <p className="text-[10px] text-zinc-600 pt-2 border-t border-zinc-900 leading-normal">
              Reduza o volume para dar clareza às suas falas caso não utilize áudio instrumental separado.
            </p>
          </div>

          {/* Canal 3: M&E Sem Falas */}
          <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-xs font-medium text-white uppercase tracking-wider">Trilha Sem Falas (M&E)</span>
              {exportSettings.customBgAudioPath && (
                <button
                  onClick={() =>
                    setExportSettings((prev) => ({ ...prev, customBgAudioPath: null }))
                  }
                  className="text-[10px] text-zinc-500 hover:text-white"
                >
                  Remover
                </button>
              )}
            </div>

            {!exportSettings.customBgAudioPath ? (
              <button
                onClick={handleSelectCustomAudio}
                className="w-full py-2 bg-black hover:bg-zinc-900 border border-dashed border-zinc-800 rounded text-xs text-zinc-400 hover:text-white transition-colors"
              >
                + Carregar Trilha
              </button>
            ) : (
              <div className="text-[11px] font-mono text-zinc-400 truncate bg-black px-2 py-1 rounded border border-zinc-900">
                {exportSettings.customBgAudioPath.split(/[/\\]/).pop()}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 text-[11px]">Volume</span>
                <span className="font-mono text-zinc-300 text-xs">
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
                className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer disabled:opacity-20"
              />
            </div>
          </div>
        </div>

        {/* Export Actions Area */}
        <div className="bg-[#09090b] border border-zinc-900 rounded p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <span className="text-xs font-medium text-white uppercase tracking-wider">Exportação</span>

            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="text-[11px] text-zinc-600">Pasta:</span>
              <button
                onClick={handleSelectOutputDir}
                className="px-2 py-0.5 bg-black border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded text-[11px] font-mono truncate max-w-[180px]"
              >
                {exportSettings.outputDir ? exportSettings.outputDir.split(/[/\\]/).pop() : 'Padrão...'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Full Video */}
            <button
              onClick={handleExportFullVideo}
              disabled={isExporting}
              className="p-3 bg-white hover:bg-zinc-200 disabled:opacity-30 text-black rounded text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                <span className="text-xs font-medium">Vídeo Completo (.mp4)</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">Imagem original + mixagem final</p>
            </button>

            {/* Full Audio */}
            <button
              onClick={handleExportFullAudio}
              disabled={isExporting}
              className="p-3 bg-black hover:bg-zinc-900 border border-zinc-800 disabled:opacity-30 text-white rounded text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium">Áudio Mixado (.wav)</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Apenas as faixas sonoras combinadas</p>
            </button>

            {/* Script .txt */}
            <button
              onClick={handleExportTxt}
              disabled={isExporting}
              className="p-3 bg-black hover:bg-zinc-900 border border-zinc-800 disabled:opacity-30 text-white rounded text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium">Roteiro (.txt)</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Lista de timestamps e diálogos</p>
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
