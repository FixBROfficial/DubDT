import React, { useState, useRef, useEffect } from 'react'
import { AppStep, RecentProject } from '../types'
import {
  Settings,
  Film,
  FolderOpen,
  Save,
  FilePlus,
  FileText,
  Clock,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'

interface NavbarProps {
  currentStep: AppStep
  setCurrentStep: (step: AppStep) => void
  videoName: string | null
  linesCount: number
  recordedLinesCount: number
  onOpenSettings: () => void
  projectName: string | null
  recentProjects: RecentProject[]
  onNewProject: () => void
  onOpenProject: () => void
  onOpenRecent: (path: string) => void
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onCloseProject: () => void
  onClearRecents: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStep,
  setCurrentStep,
  videoName,
  linesCount,
  recordedLinesCount,
  onOpenSettings,
  projectName,
  recentProjects,
  onNewProject,
  onOpenProject,
  onOpenRecent,
  onSaveProject,
  onSaveProjectAs,
  onCloseProject,
  onClearRecents,
}) => {
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
  const [showRecentsMenu, setShowRecentsMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsProjectMenuOpen(false)
        setShowRecentsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="h-12 bg-black border-b border-zinc-900 px-4 flex items-center justify-between select-none relative z-50">
      {/* Brand & Project Menu & Video info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-1">
          <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          <span className="font-semibold text-xs tracking-wider text-white uppercase">DubDT</span>
        </div>

        {/* Project Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsProjectMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors border ${
              isProjectMenuOpen
                ? 'bg-zinc-800 text-white border-zinc-700'
                : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
            title="Menu do Projeto (Ctrl+S / Ctrl+O)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-medium text-[11px] max-w-[150px] truncate">
              {projectName || 'Projeto'}
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-500 ml-0.5" />
          </button>

          {isProjectMenuOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-60 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in duration-100">
              {/* Novo Projeto */}
              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  onNewProject()
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FilePlus className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Novo Projeto</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Ctrl+N</span>
              </button>

              {/* Abrir Projeto */}
              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  onOpenProject()
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Abrir Projeto...</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Ctrl+O</span>
              </button>

              {/* Projetos Recentes */}
              <div
                className="relative"
                onMouseEnter={() => setShowRecentsMenu(true)}
                onMouseLeave={() => setShowRecentsMenu(false)}
              >
                <button
                  onClick={() => setShowRecentsMenu((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Recentes</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-500" />
                </button>

                {showRecentsMenu && (
                  <div className="absolute left-full top-0 ml-1 w-64 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50">
                    <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-900">
                      Projetos Recentes
                    </div>
                    {recentProjects.length === 0 ? (
                      <div className="px-3 py-3 text-[11px] text-zinc-500 italic text-center">
                        Nenhum projeto recente
                      </div>
                    ) : (
                      <>
                        <div className="max-h-56 overflow-y-auto">
                          {recentProjects.map((item) => (
                            <button
                              key={item.path}
                              onClick={() => {
                                setIsProjectMenuOpen(false)
                                setShowRecentsMenu(false)
                                onOpenRecent(item.path)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-900 transition-colors group border-b border-zinc-900/50 last:border-none"
                            >
                              <div className="text-xs text-zinc-200 group-hover:text-white truncate font-medium">
                                {item.name}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono truncate" title={item.path}>
                                {item.path}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="border-t border-zinc-900 mt-1 pt-1">
                          <button
                            onClick={() => {
                              onClearRecents()
                              setShowRecentsMenu(false)
                            }}
                            className="w-full px-3 py-1 text-[10px] text-zinc-500 hover:text-red-400 text-left transition-colors"
                          >
                            Limpar Histórico de Recentes
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="h-px bg-zinc-900 my-1" />

              {/* Salvar Projeto */}
              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  onSaveProject()
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Salvar</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Ctrl+S</span>
              </button>

              {/* Salvar Como */}
              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  onSaveProjectAs()
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Salvar Como...</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Ctrl+Shift+S</span>
              </button>

              <div className="h-px bg-zinc-900 my-1" />

              {/* Fechar Projeto */}
              <button
                onClick={() => {
                  setIsProjectMenuOpen(false)
                  onCloseProject()
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Fechar Projeto</span>
              </button>
            </div>
          )}
        </div>

        {videoName && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 pl-3 border-l border-zinc-900 max-w-[200px] truncate">
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
              ? 'bg-zinc-800 text-white font-medium shadow-sm'
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
              ? 'bg-zinc-800 text-white font-medium shadow-sm'
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
              ? 'bg-zinc-800 text-white font-medium shadow-sm'
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
