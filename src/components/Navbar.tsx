import React from 'react'
import { AppStep } from '../types'
import { Settings, Film } from 'lucide-react'

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
    <header className="h-12 bg-black border-b border-zinc-900 px-4 flex items-center justify-between select-none">
      {/* Brand & Video info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span className="font-semibold text-xs tracking-wider text-white uppercase">DubDT</span>
        </div>

        {videoName && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 pl-3 border-l border-zinc-900 max-w-[260px] truncate">
            <Film className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate text-zinc-400 font-mono text-[11px]">{videoName}</span>
          </div>
        )}
      </div>

      {/* Minimal Stepper Navigation */}
      <nav className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-zinc-900">
        <button
          onClick={() => setCurrentStep('annotate')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
            currentStep === 'annotate'
              ? 'bg-zinc-800 text-white font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span>1. Timestamps</span>
          {linesCount > 0 && (
            <span className="text-[10px] font-mono text-zinc-400">
              ({linesCount})
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentStep('record')}
          disabled={linesCount === 0}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
            currentStep === 'record'
              ? 'bg-zinc-800 text-white font-medium'
              : linesCount === 0
              ? 'text-zinc-700 cursor-not-allowed'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className={currentStep === 'record' ? 'text-red-400' : ''}>●</span>
          <span>2. Gravação</span>
          {linesCount > 0 && (
            <span className="text-[10px] font-mono text-zinc-400">
              ({recordedLinesCount}/{linesCount})
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentStep('export')}
          disabled={linesCount === 0}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
            currentStep === 'export'
              ? 'bg-zinc-800 text-white font-medium'
              : linesCount === 0
              ? 'text-zinc-700 cursor-not-allowed'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span>3. Mix & Export</span>
        </button>
      </nav>

      {/* Minimal Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          title="Configurações de Áudio"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded border border-zinc-900 hover:border-zinc-800 transition-colors"
        >
          <Settings className="w-3 h-3 text-zinc-500" />
          <span>Áudio</span>
        </button>
      </div>
    </header>
  )
}
