import React from 'react'
import { AppStep } from '../types'
import { Mic, Film, Sliders, Volume2, Settings, Scissors } from 'lucide-react'

interface NavbarProps {
  currentStep: AppStep
  setCurrentStep: (step: AppStep) => void
  videoName: string | null
  linesCount: number
  recordedLinesCount: number
  onOpenSettings: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStep,
  setCurrentStep,
  videoName,
  linesCount,
  recordedLinesCount,
  onOpenSettings,
}) => {
  return (
    <header className="h-14 bg-zinc-900/90 border-b border-zinc-800 px-4 flex items-center justify-between backdrop-blur-md select-none">
      {/* Logo & Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 rounded-lg shadow-md shadow-violet-950/50">
          <Mic className="w-4 h-4 text-white animate-pulse" />
          <span className="font-black text-sm tracking-wider text-white">DubDT</span>
        </div>

        {videoName ? (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-md border border-zinc-700/50 max-w-[280px] truncate">
            <Film className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate font-medium text-zinc-300">{videoName}</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500 italic">Nenhum vídeo aberto</span>
        )}
      </div>

      {/* Stepper Navigation */}
      <nav className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 shadow-inner">
        <button
          onClick={() => setCurrentStep('annotate')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentStep === 'annotate'
              ? 'bg-violet-600 text-white shadow-sm shadow-violet-700/50'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>1. Timestamps & Waveform</span>
          {linesCount > 0 && (
            <span className="bg-zinc-900/80 text-violet-300 px-1.5 py-0.5 rounded-full text-[10px]">
              {linesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentStep('record')}
          disabled={linesCount === 0}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentStep === 'record'
              ? 'bg-red-600 text-white shadow-sm shadow-red-700/50'
              : linesCount === 0
              ? 'text-zinc-600 cursor-not-allowed opacity-50'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>2. Estúdio de Gravação</span>
          {linesCount > 0 && (
            <span className="bg-zinc-900/80 text-zinc-300 px-1.5 py-0.5 rounded-full text-[10px]">
              {recordedLinesCount}/{linesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentStep('export')}
          disabled={linesCount === 0}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentStep === 'export'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-700/50'
              : linesCount === 0
              ? 'text-zinc-600 cursor-not-allowed opacity-50'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>3. Mixagem & Export</span>
        </button>
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          title="Opções de Áudio & Dispositivos"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/80 px-2.5 py-1.5 rounded-lg border border-zinc-700/50 transition-colors"
        >
          <Settings className="w-3.5 h-3.5 text-zinc-300" />
          <span>Áudio</span>
        </button>
      </div>
    </header>
  )
}
