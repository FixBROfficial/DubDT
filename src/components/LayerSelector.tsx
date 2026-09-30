import React, { useState, useRef, useEffect } from 'react'
import { ChevronUp, ChevronDown, Plus, Layers, Check } from 'lucide-react'

interface LayerSelectorProps {
  currentLayer: number
  onLayerChange: (layer: number) => void
  totalLinesByLayer?: Record<number, number>
  compact?: boolean
  className?: string
}

export const LayerSelector: React.FC<LayerSelectorProps> = ({
  currentLayer,
  onLayerChange,
  totalLinesByLayer = {},
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const existingLayerNums = Object.keys(totalLinesByLayer)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n) && n >= 1)

  if (!existingLayerNums.includes(1)) existingLayerNums.push(1)
  if (!existingLayerNums.includes(currentLayer)) existingLayerNums.push(currentLayer)
  existingLayerNums.sort((a, b) => a - b)

  const maxExisting = Math.max(...existingLayerNums, 1)

  const handleUp = (e: React.MouseEvent) => {
    e.stopPropagation()
    onLayerChange(currentLayer + 1)
  }

  const handleDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentLayer > 1) {
      onLayerChange(currentLayer - 1)
    }
  }

  return (
    <div className={`relative inline-flex items-center select-none ${className}`} ref={dropdownRef}>
      <div className="flex items-center bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-md transition-all shadow-sm overflow-hidden h-7">
        {/* Main Button showing "Camada {currentLayer}" */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 h-full text-xs font-medium transition-colors cursor-pointer ${
            isOpen ? 'bg-zinc-800 text-white' : 'text-zinc-200 hover:text-white hover:bg-zinc-900'
          }`}
          title="Clique para ver todas as camadas ou use as setas para alternar"
        >
          <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-mono text-zinc-100 font-semibold tracking-wide">
            Camada {currentLayer}
          </span>
          {totalLinesByLayer[currentLayer] !== undefined && (
            <span className="text-[10px] text-zinc-400 font-mono ml-0.5">
              ({totalLinesByLayer[currentLayer]} {totalLinesByLayer[currentLayer] === 1 ? 'fala' : 'falas'})
            </span>
          )}
        </button>

        {/* Up and Down Arrow Steppers */}
        <div className="flex flex-col border-l border-zinc-800 h-full w-5 shrink-0 bg-black/40">
          <button
            onClick={handleUp}
            className="flex-1 flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border-b border-zinc-800/60"
            title="Próxima Camada (Seta para cima)"
          >
            <ChevronUp className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={handleDown}
            disabled={currentLayer <= 1}
            className={`flex-1 flex items-center justify-center transition-colors ${
              currentLayer <= 1
                ? 'text-zinc-700 cursor-not-allowed bg-zinc-950'
                : 'hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer'
            }`}
            title="Camada Anterior (Seta para baixo, limite mínimo: 1)"
          >
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Layer quick jump / add dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in duration-100 backdrop-blur-md">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-900 flex items-center justify-between">
            <span>Camadas de Gravação</span>
            <span className="font-mono text-zinc-500">{existingLayerNums.length}</span>
          </div>

          <div className="max-h-48 overflow-y-auto py-1">
            {existingLayerNums.map((num) => {
              const count = totalLinesByLayer[num] || 0
              const isSelected = num === currentLayer
              return (
                <button
                  key={num}
                  onClick={() => {
                    onLayerChange(num)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800/90 text-white font-medium'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono">Camada {num}</span>
                    {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {count} {count === 1 ? 'fala' : 'falas'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-zinc-900 pt-1 mt-1 px-1">
            <button
              onClick={() => {
                onLayerChange(maxExisting + 1)
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-300 hover:text-white hover:bg-zinc-900 text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Adicionar Camada {maxExisting + 1}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
