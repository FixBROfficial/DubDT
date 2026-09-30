import React, { useState, useEffect } from 'react'
import { Package, Link2, Check, X, ShieldAlert } from 'lucide-react'

interface SaveProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (embedMedia: boolean) => void
  initialEmbedMedia?: boolean
  projectName?: string | null
}

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialEmbedMedia = true,
  projectName,
}) => {
  const [selectedEmbed, setSelectedEmbed] = useState<boolean>(initialEmbedMedia)

  useEffect(() => {
    setSelectedEmbed(initialEmbedMedia)
  }, [initialEmbedMedia, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-zinc-100 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-black/40">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Salvar Projeto DubDT
            </h2>
            <p className="text-[11px] text-zinc-400">
              Escolha como deseja armazenar o vídeo e os áudios no arquivo .dubdt
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3">
          {/* Option 1: Embed Media */}
          <div
            onClick={() => setSelectedEmbed(true)}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              selectedEmbed
                ? 'bg-zinc-900/90 border-white shadow-md ring-1 ring-white/20'
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-md shrink-0 mt-0.5 ${
                  selectedEmbed ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Package className="w-4 h-4" />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Embutir Mídias no Arquivo
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-medium">
                    Portátil
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  O vídeo original e todas as gravações ficam empacotados dentro do arquivo .dubdt.
                  Você pode abrir em outro computador ou pendrive sem perder nenhum arquivo.
                </p>
              </div>

              <div className="shrink-0 mt-0.5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedEmbed
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-700 bg-transparent'
                  }`}
                >
                  {selectedEmbed && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            </div>
          </div>

          {/* Option 2: References Only */}
          <div
            onClick={() => setSelectedEmbed(false)}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              !selectedEmbed
                ? 'bg-zinc-900/90 border-white shadow-md ring-1 ring-white/20'
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-md shrink-0 mt-0.5 ${
                  !selectedEmbed ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Link2 className="w-4 h-4" />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Salvar Apenas Referências
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                    Leve
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Salva o roteiro, marcações e caminhos dos arquivos. O arquivo .dubdt fica minúsculo,
                  mas depende dos arquivos continuarem nas mesmas pastas deste computador.
                </p>
              </div>

              <div className="shrink-0 mt-0.5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    !selectedEmbed
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-700 bg-transparent'
                  }`}
                >
                  {!selectedEmbed && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-black/40 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selectedEmbed)}
            className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>Continuar para Salvar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
