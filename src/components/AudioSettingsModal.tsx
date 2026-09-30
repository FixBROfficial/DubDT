import React, { useEffect, useState, useRef } from 'react'
import { AudioSettings } from '../types'
import { X, Mic, Volume2 } from 'lucide-react'

interface AudioSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AudioSettings
  onUpdateSettings: (newSettings: Partial<AudioSettings>) => void
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [micLevel, setMicLevel] = useState<number>(0)
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) return

    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
          s.getTracks().forEach((t) => t.stop())
        }).catch(() => {})

        const devices = await navigator.mediaDevices.enumerateDevices()
        setInputs(devices.filter((d) => d.kind === 'audioinput'))
        setOutputs(devices.filter((d) => d.kind === 'audiooutput'))
      } catch (err) {
        console.warn('Erro ao obter dispositivos:', err)
      }
    }
    loadDevices()
  }, [isOpen])

  const startMicTest = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: settings.inputDeviceId ? { deviceId: { exact: settings.inputDeviceId } } : true,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const gainNode = ctx.createGain()
      gainNode.gain.value = settings.micGain

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      source.connect(gainNode)
      gainNode.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)))
        animationFrameRef.current = requestAnimationFrame(checkLevel)
      }
      checkLevel()
      setIsTestingMic(true)
    } catch (err) {
      console.error('Erro ao testar microfone:', err)
    }
  }

  const stopMicTest = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
    setIsTestingMic(false)
    setMicLevel(0)
  }

  useEffect(() => {
    return () => {
      stopMicTest()
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-[#09090b] border border-zinc-800 rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in duration-100">
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-900">
          <div>
            <h2 className="text-xs font-semibold text-white tracking-wide uppercase">Configurações de Áudio</h2>
            <p className="text-[11px] text-zinc-500">Dispositivos e calibração de entrada/saída</p>
          </div>
          <button
            onClick={() => {
              stopMicTest()
              onClose()
            }}
            className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Minimal Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Microfone Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">
                <Mic className="w-3 h-3 text-zinc-500" />
                Microfone
              </label>
              <button
                type="button"
                onClick={isTestingMic ? stopMicTest : startMicTest}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  isTestingMic
                    ? 'border-red-900 bg-red-950/40 text-red-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {isTestingMic ? 'Parar Teste' : 'Testar Nível'}
              </button>
            </div>
            <select
              value={settings.inputDeviceId}
              onChange={(e) => onUpdateSettings({ inputDeviceId: e.target.value })}
              className="w-full bg-black border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="">Padrão do Sistema</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>

            {/* Flat VU Meter */}
            {isTestingMic && (
              <div className="pt-1">
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-200 transition-all duration-75"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Saída de Áudio */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">
              <Volume2 className="w-3 h-3 text-zinc-500" />
              Saída (Fones / Caixas)
            </label>
            <select
              value={settings.outputDeviceId}
              onChange={(e) => onUpdateSettings({ outputDeviceId: e.target.value })}
              className="w-full bg-black border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              <option value="">Padrão do Sistema</option>
              {outputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Saída ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="h-px bg-zinc-900" />

          {/* Ganho do Microfone */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400 text-[11px]">Ganho do Microfone</span>
              <span className="font-mono text-zinc-200 text-xs">
                {Math.round(settings.micGain * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.micGain}
              onChange={(e) => onUpdateSettings({ micGain: parseFloat(e.target.value) })}
              className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>

          {/* Som Original na Gravação */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400 text-[11px]">Som Original na Gravação</span>
              <span className="font-mono text-zinc-200 text-xs">
                {Math.round(settings.originalAudioVolumeDuringRecording * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.originalAudioVolumeDuringRecording}
              onChange={(e) =>
                onUpdateSettings({ originalAudioVolumeDuringRecording: parseFloat(e.target.value) })
              }
              className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>

          {/* Pré-Roll */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400 text-[11px]">Pré-Roll da Cena</span>
              <span className="font-mono text-zinc-200 text-xs">
                {settings.preRollSeconds.toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="0.5"
              value={settings.preRollSeconds}
              onChange={(e) =>
                onUpdateSettings({ preRollSeconds: parseFloat(e.target.value) })
              }
              className="w-full accent-white h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>

          {/* Bipes sonoros */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-300">Bipes de Contagem (3-2-1)</span>
            <input
              type="checkbox"
              checked={settings.countdownBeeps}
              onChange={(e) => onUpdateSettings({ countdownBeeps: e.target.checked })}
              className="accent-white h-3.5 w-3.5 rounded bg-black border border-zinc-700"
            />
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="px-5 py-3 bg-black border-t border-zinc-900 flex justify-end">
          <button
            onClick={() => {
              stopMicTest()
              onClose()
            }}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-white text-black text-xs font-medium rounded transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
