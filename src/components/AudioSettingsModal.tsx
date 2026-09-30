import React, { useEffect, useState, useRef } from 'react'
import { AudioSettings } from '../types'
import { X, Mic, Volume2, Sliders, Music, Clock, Bell } from 'lucide-react'

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

  // Enumerate audio devices
  useEffect(() => {
    if (!isOpen) return

    async function loadDevices() {
      try {
        // Request temporary mic permission to get device labels if not already allowed
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

  // Real-time Mic Level Test
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-600/20 text-violet-400 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Configurações de Áudio & Dispositivos</h2>
              <p className="text-xs text-zinc-400">Ajuste seu microfone, saída de som e preferências de gravação</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopMicTest()
              onClose()
            }}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Microfone Input */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-violet-400" />
                Dispositivo de Entrada (Microfone)
              </span>
              <button
                type="button"
                onClick={isTestingMic ? stopMicTest : startMicTest}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all ${
                  isTestingMic
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                {isTestingMic ? 'Parar Teste' : 'Testar Mic'}
              </button>
            </label>
            <select
              value={settings.inputDeviceId}
              onChange={(e) => onUpdateSettings({ inputDeviceId: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
            >
              <option value="">Padrão do Sistema</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>

            {/* VU Meter */}
            {isTestingMic && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Sensibilidade</span>
                  <span>{micLevel}%</span>
                </div>
                <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className={`h-full transition-all duration-75 ${
                      micLevel > 80 ? 'bg-red-500' : micLevel > 50 ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Saída de Áudio (Fones / Alto-falantes) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              Dispositivo de Saída (Fones / Caixas)
            </label>
            <select
              value={settings.outputDeviceId}
              onChange={(e) => onUpdateSettings({ outputDeviceId: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
            >
              <option value="">Padrão do Sistema</option>
              {outputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Dispositivo de Saída ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="h-px bg-zinc-800/80" />

          {/* Ganho do Microfone */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-zinc-300">Ganho do Microfone (Volume de Captura)</span>
              <span className="text-violet-400 font-mono font-bold">
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
              className="w-full accent-violet-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              Aumente se o seu microfone estiver baixo ou diminua para evitar estourar/clipar.
            </p>
          </div>

          {/* Volume do Áudio Original durante a gravação */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-zinc-400" />
                Volume do Áudio Original (Ao Gravar)
              </span>
              <span className="text-indigo-400 font-mono font-bold">
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
              className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              Permite ouvir o som original no fone mais baixo enquanto você grava para não atrapalhar sua voz.
            </p>
          </div>

          {/* Pré-Roll (Tempo antes de começar a fala) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Pré-Roll de Cena (Contexto antes de falar)
              </span>
              <span className="text-emerald-400 font-mono font-bold">
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
              className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              O vídeo começa a rodar alguns segundos antes do timestamp para você pegar o ritmo da cena.
            </p>
          </div>

          {/* Beeps de Contagem */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">Bipes de Contagem (3-2-1)</span>
                <span className="text-[11px] text-zinc-500">
                  Emite alertas sonoros no fone antes de iniciar a gravação
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.countdownBeeps}
                onChange={(e) => onUpdateSettings({ countdownBeeps: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950/80 border-t border-zinc-800 flex justify-end">
          <button
            onClick={() => {
              stopMicTest()
              onClose()
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
