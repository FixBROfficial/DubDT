import React, { useState, useRef, useEffect } from 'react'
import {
  AlertTriangle,
  FolderOpen,
  CheckCircle2,
  Film,
  X,
  ArrowRight,
  FileQuestion,
  RefreshCw,
} from 'lucide-react'

interface RelinkVideoModalProps {
  isOpen: boolean
  onClose: () => void
  expectedVideoName?: string | null
  originalVideoPath?: string | null
  onRelink: (file: { path: string; name: string; mediaUrl: string }) => void
}

export const RelinkVideoModal: React.FC<RelinkVideoModalProps> = ({
  isOpen,
  onClose,
  expectedVideoName,
  originalVideoPath,
  onRelink,
}) => {
  const [selectedFile, setSelectedFile] = useState<{
    path: string
    name: string
    mediaUrl: string
  } | null>(null)
  const [isBrowsing, setIsBrowsing] = useState(false)
  const browserInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null)
      setIsBrowsing(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBrowse = async () => {
    if (window.electronAPI) {
      try {
        setIsBrowsing(true)
        const file = await window.electronAPI.selectVideoFile({
          title: `Localizar vídeo: ${expectedVideoName || 'Vídeo do projeto'}`,
          defaultPath: originalVideoPath || undefined,
        })
        if (file) {
          setSelectedFile(file)
        }
      } catch (err) {
        console.error('Erro ao buscar arquivo no Explorer:', err)
      } finally {
        setIsBrowsing(false)
      }
    } else {
      browserInputRef.current?.click()
    }
  }

  const handleBrowserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setSelectedFile({
        path: file.name,
        name: file.name,
        mediaUrl: url,
      })
    }
  }

  const handleConfirm = () => {
    if (selectedFile) {
      onRelink(selectedFile)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Hidden browser input fallback */}
      <input
        ref={browserInputRef}
        type="file"
        accept="video/*"
        onChange={handleBrowserFileChange}
        className="hidden"
      />

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-zinc-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Vídeo do Projeto Não Encontrado
              </h2>
              <p className="text-[11px] text-zinc-400">
                O arquivo de vídeo referenciado não está no caminho gravado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Info Card */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-medium">Arquivo esperado:</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-semibold">
                Ausente no Disco
              </span>
            </div>

            <div className="flex items-center gap-2 text-white font-mono text-xs font-semibold">
              <Film className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className="truncate">{expectedVideoName || 'Vídeo original'}</span>
            </div>

            {originalVideoPath && (
              <div className="pt-2 border-t border-zinc-800/70">
                <span className="text-[10px] text-zinc-500 block mb-0.5">Caminho original:</span>
                <span className="font-mono text-[11px] text-zinc-400 break-all leading-snug">
                  {originalVideoPath}
                </span>
              </div>
            )}
          </div>

          {/* Relink Action Area */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 block">
              Marcar onde o vídeo está agora:
            </label>

            {!selectedFile ? (
              <div
                onClick={handleBrowse}
                className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/50 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-zinc-700 transition-colors mb-2">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                  Localizar arquivo no Explorer
                </span>
                <span className="text-[11px] text-zinc-500 mt-0.5">
                  Clique para navegar e selecionar onde você guardou este vídeo
                </span>
              </div>
            ) : (
              <div className="bg-emerald-950/20 border border-emerald-800/80 rounded-lg p-3.5 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Arquivo selecionado:</span>
                  </div>
                  <button
                    onClick={handleBrowse}
                    className="text-[11px] text-zinc-400 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Trocar arquivo
                  </button>
                </div>

                <div className="font-mono text-xs text-white font-medium truncate">
                  {selectedFile.name}
                </div>

                <div className="font-mono text-[11px] text-zinc-400 break-all bg-black/40 p-2 rounded border border-zinc-800/80">
                  {selectedFile.path}
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Ao reconectar o vídeo, todas as marcações de falas, dublagens gravadas e roteiro existentes serão mantidos intactos.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-black/40 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            Continuar sem Vídeo
          </button>

          <div className="flex items-center gap-2">
            {!selectedFile ? (
              <button
                onClick={handleBrowse}
                disabled={isBrowsing}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all flex items-center gap-1.5 cursor-pointer shadow"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Localizar no Explorer...</span>
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                <span>Reconectar e Abrir Vídeo</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
