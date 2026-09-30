import React, { useState } from 'react'
import { AppStep, DialogueLine, AudioSettings, ExportSettings } from './types'
import { Navbar } from './components/Navbar'
import { Step1Annotation } from './components/Step1Annotation'
import { Step2Recording } from './components/Step2Recording'
import { Step3Export } from './components/Step3Export'
import { AudioSettingsModal } from './components/AudioSettingsModal'

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>('annotate')

  // Video State
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoMediaUrl, setVideoMediaUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState<string | null>(null)

  // Dialogue lines
  const [lines, setLines] = useState<DialogueLine[]>([])

  // Audio Settings
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    inputDeviceId: '',
    outputDeviceId: '',
    micGain: 1.0,
    masterVolume: 1.0,
    originalAudioVolumeDuringRecording: 0.35,
    preRollSeconds: 1.5,
    countdownBeeps: true,
  })

  // Export Settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeOriginalAudio: true,
    originalAudioVolume: 0.7,
    customBgAudioPath: null,
    customBgAudioVolume: 0.8,
    recordedVoicesVolume: 1.2,
    voicePreset: 'clean',
    exportIndividualClips: false,
    clipFormat: 'video',
    outputDir: '',
  })

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)

  // File input ref for browser fallback
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Select video handler
  const handleSelectVideo = async () => {
    if (window.electronAPI) {
      try {
        const file = await window.electronAPI.selectVideoFile()
        if (file) {
          setVideoPath(file.path)
          setVideoMediaUrl(file.mediaUrl)
          setVideoName(file.name)
          setLines([]) // reset lines for new video
        }
      } catch (err) {
        console.error('Erro ao selecionar vídeo via Electron:', err)
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  // Browser fallback for file selection
  const handleBrowserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setVideoPath(file.name)
      setVideoMediaUrl(url)
      setVideoName(file.name)
      setLines([])
    }
  }

  const recordedLinesCount = lines.filter((l) => l.takes && l.takes.length > 0).length

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Hidden file input for browser development mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleBrowserFileChange}
        className="hidden"
      />

      {/* Top Navbar */}
      <Navbar
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        videoName={videoName}
        linesCount={lines.length}
        recordedLinesCount={recordedLinesCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Stepper Views */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentStep === 'annotate' && (
          <Step1Annotation
            videoPath={videoPath}
            videoMediaUrl={videoMediaUrl}
            videoName={videoName}
            lines={lines}
            setLines={setLines}
            onSelectVideo={handleSelectVideo}
            onAdvanceToRecording={() => setCurrentStep('record')}
          />
        )}

        {currentStep === 'record' && (
          <Step2Recording
            videoMediaUrl={videoMediaUrl || ''}
            lines={lines}
            setLines={setLines}
            audioSettings={audioSettings}
            onUpdateAudioSettings={(newSettings) =>
              setAudioSettings((prev) => ({ ...prev, ...newSettings }))
            }
            onOpenSettings={() => setIsSettingsOpen(true)}
            onAdvanceToExport={() => setCurrentStep('export')}
          />
        )}

        {currentStep === 'export' && (
          <Step3Export
            videoPath={videoPath}
            lines={lines}
            exportSettings={exportSettings}
            setExportSettings={setExportSettings}
          />
        )}
      </main>

      {/* Audio Settings Modal */}
      <AudioSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={audioSettings}
        onUpdateSettings={(newSettings) =>
          setAudioSettings((prev) => ({ ...prev, ...newSettings }))
        }
      />
    </div>
  )
}
export default App
