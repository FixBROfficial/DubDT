import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AppStep, DialogueLine, AudioSettings, ExportSettings, RecentProject, DubDTProject } from './types'
import { useUndoRedo, areLinesEqual } from './utils/useUndoRedo'
import { Navbar } from './components/Navbar'
import { Step1Annotation } from './components/Step1Annotation'
import { Step2Recording } from './components/Step2Recording'
import { Step3Export } from './components/Step3Export'
import { AudioSettingsModal } from './components/AudioSettingsModal'
import { SaveProjectModal } from './components/SaveProjectModal'
import { RelinkVideoModal } from './components/RelinkVideoModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

export const initialExportSettings: ExportSettings = {
  includeOriginalAudio: true,
  originalAudioVolume: 0.7,
  customBgAudioPath: null,
  customBgAudioVolume: 0.8,
  recordedVoicesVolume: 1.2,
  voicePreset: 'clean',
  enableNoiseSuppression: false,
  noiseSuppressionLevel: 50,
  exportIndividualClips: false,
  clipFormat: 'video',
  outputDir: '',
}

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>('annotate')

  // Project State
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null)
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [embedMedia, setEmbedMedia] = useState<boolean>(true)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false)
  const [currentLayer, setCurrentLayer] = useState<number>(1)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'warning' | 'info'
  } | null>(null)

  // Video State
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoMediaUrl, setVideoMediaUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState<string | null>(null)

  // Missing Video Relinking State
  const [isVideoMissing, setIsVideoMissing] = useState<boolean>(false)
  const [missingVideoName, setMissingVideoName] = useState<string | null>(null)
  const [missingVideoPath, setMissingVideoPath] = useState<string | null>(null)
  const [isRelinkModalOpen, setIsRelinkModalOpen] = useState<boolean>(false)

  // Dialogue lines with Undo & Redo History
  const {
    state: lines,
    setState: setLines,
    reset: resetLines,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<DialogueLine[]>([], {
    maxHistory: 100,
    isEqual: areLinesEqual,
  })

  const handleUndo = useCallback(() => {
    if (undo()) {
      showNotification('Ação desfeita (Ctrl+Z)', 'info')
    }
  }, [undo])

  const handleRedo = useCallback(() => {
    if (redo()) {
      showNotification('Ação refeita (Ctrl+Y)', 'info')
    }
  }, [redo])

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
  const [exportSettings, setExportSettings] = useState<ExportSettings>(initialExportSettings)

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)

  // File input refs for browser fallback
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const projectFileInputRef = useRef<HTMLInputElement | null>(null)
  const notificationTimeoutRef = useRef<any>(null)

  const showNotification = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current)
    setNotification({ message, type })
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null)
    }, 4500)
  }

  // Load Recent Projects on mount
  const loadRecents = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const list = await window.electronAPI.getRecentProjects()
        setRecentProjects(list || [])
      } catch (err) {}
    } else {
      try {
        const raw = localStorage.getItem('dubdt_recent_projects')
        if (raw) setRecentProjects(JSON.parse(raw))
      } catch (err) {}
    }
  }, [])

  useEffect(() => {
    loadRecents()
  }, [loadRecents])

  // Helper to build project JSON
  const buildProjectData = (name?: string): DubDTProject => {
    const projName =
      name ||
      currentProjectName ||
      (videoName ? videoName.replace(/\.[^/.]+$/, '') : 'Projeto DubDT')

    return {
      dubdtVersion: '2.0',
      name: projName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      videoPath,
      videoName,
      customBgAudioPath: exportSettings.customBgAudioPath,
      lines,
      audioSettings,
      exportSettings,
      embedMedia,
      currentLayer,
    }
  }

  // Project: Novo Projeto
  const handleNewProject = () => {
    if (lines.length > 0 || videoPath) {
      const confirmNew = window.confirm(
        'Deseja criar um novo projeto? Todas as alterações não salvas serão perdidas.'
      )
      if (!confirmNew) return
    }

    setVideoPath(null)
    setVideoMediaUrl(null)
    setVideoName(null)
    setIsVideoMissing(false)
    setMissingVideoName(null)
    setMissingVideoPath(null)
    setIsRelinkModalOpen(false)
    resetLines([])
    setExportSettings(initialExportSettings)
    setCurrentProjectPath(null)
    setCurrentProjectName(null)
    setCurrentLayer(1)
    setEmbedMedia(true)
    setCurrentStep('annotate')
    window.electronAPI?.setWindowTitle('DubDT - Estúdio de Dublagem & Fandub')
    showNotification('Novo projeto iniciado.', 'info')
  }

  // Project: Salvar Como (sempre pergunta se deseja embutir mídias ou não)
  const handleSaveProjectAs = () => {
    setIsSaveModalOpen(true)
  }

  // Project: Salvar (se já salvo, preserva preferência; se não salvo, abre modal)
  const handleSaveProject = async () => {
    if (!currentProjectPath) {
      return handleSaveProjectAs()
    }

    if (window.electronAPI) {
      try {
        const projectData = buildProjectData()
        projectData.embedMedia = embedMedia

        if (embedMedia) {
          showNotification('Empacotando e salvando projeto com mídias embutidas...', 'info')
        } else {
          showNotification('Salvando projeto (referências locais)...', 'info')
        }

        await window.electronAPI.saveProjectFile(currentProjectPath, projectData)
        loadRecents()
        showNotification('Projeto salvo com sucesso!', 'success')
      } catch (err: any) {
        console.error('Erro ao salvar projeto:', err)
        showNotification(`Falha ao salvar projeto: ${err?.message}`, 'warning')
      }
    }
  }

  // Callback from SaveProjectModal to execute save with chosen embedMedia option
  const handleConfirmSaveProject = async (chosenEmbedMedia: boolean) => {
    setIsSaveModalOpen(false)
    setEmbedMedia(chosenEmbedMedia)

    const defaultName =
      (currentProjectName ||
        (videoName ? videoName.replace(/\.[^/.]+$/, '') : 'MeuProjeto')) + '.dubdt'

    if (window.electronAPI) {
      try {
        const filePath = await window.electronAPI.selectProjectFileToSave(defaultName)
        if (!filePath) return

        const projectName =
          filePath.split(/[\\/]/).pop()?.replace(/\.dubdt$/i, '') || 'Projeto'
        const projectData = buildProjectData(projectName)
        projectData.embedMedia = chosenEmbedMedia

        if (chosenEmbedMedia) {
          showNotification('Empacotando e salvando projeto com mídias embutidas...', 'info')
        } else {
          showNotification('Salvando projeto (referências locais)...', 'info')
        }

        await window.electronAPI.saveProjectFile(filePath, projectData)
        setCurrentProjectPath(filePath)
        setCurrentProjectName(projectName)
        window.electronAPI.setWindowTitle(`DubDT - ${projectName}`)
        loadRecents()
        showNotification(
          chosenEmbedMedia
            ? `Projeto salvo com mídias embutidas: ${projectName}.dubdt`
            : `Projeto salvo com referências locais: ${projectName}.dubdt`,
          'success'
        )
      } catch (err: any) {
        console.error('Erro ao salvar projeto:', err)
        showNotification(`Falha ao salvar projeto: ${err?.message}`, 'warning')
      }
    } else {
      // Browser fallback: download .dubdt JSON
      const projectData = buildProjectData()
      projectData.embedMedia = chosenEmbedMedia
      const blob = new Blob([JSON.stringify(projectData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)
      showNotification('Arquivo .dubdt salvo com sucesso.', 'success')
    }
  }

  // Project: Abrir / Carregar Projeto
  const handleOpenProject = async (targetPath?: string) => {
    if (window.electronAPI) {
      try {
        let filePath = targetPath
        if (!filePath) {
          filePath = (await window.electronAPI.selectProjectFileToOpen()) || undefined
        }
        if (!filePath) return

        showNotification('Carregando e descompactando projeto...', 'info')
        const res = await window.electronAPI.loadProjectFile(filePath)
        if (!res || !res.data) {
          showNotification('Arquivo de projeto inválido ou corrompido.', 'warning')
          return
        }

        const project: DubDTProject = res.data
        const projectName =
          filePath.split(/[\\/]/).pop()?.replace(/\.dubdt$/i, '') || project.name || 'Projeto'

        // Restore or detect missing video
        const isMissing = Boolean(
          project.videoMissing ||
          (!(project as any).videoMediaUrl && (project.videoPath || project.videoFileName || project.videoName || project.videoOriginalName))
        )

        const origName =
          project.missingVideoName ||
          project.videoOriginalName ||
          project.videoName ||
          (project.videoPath ? project.videoPath.split(/[\\/]/).pop() : null) ||
          'Vídeo original'

        const origPath = project.missingVideoPath || project.videoPath || ''

        if (isMissing) {
          setIsVideoMissing(true)
          setMissingVideoName(origName)
          setMissingVideoPath(origPath)
          setVideoPath(null)
          setVideoMediaUrl(null)
          setVideoName(origName)
          setIsRelinkModalOpen(true)
        } else {
          setIsVideoMissing(false)
          setMissingVideoName(null)
          setMissingVideoPath(null)
          setVideoPath(project.videoPath || null)
          setVideoMediaUrl((project as any).videoMediaUrl || null)
          setVideoName(
            project.videoName ||
              (project.videoPath ? project.videoPath.split(/[\\/]/).pop() : null)
          )
        }

        // Restore lines
        resetLines(project.lines || [])

        // Restore settings
        if (project.audioSettings) setAudioSettings(project.audioSettings)
        const loadedBgAudio =
          project.customBgAudioPath || project.exportSettings?.customBgAudioPath || null
        setExportSettings({
          ...initialExportSettings,
          ...(project.exportSettings || {}),
          customBgAudioPath: loadedBgAudio,
        })

        // Restore layer & embed mode
        setCurrentLayer(project.currentLayer || 1)
        setEmbedMedia(project.embedMedia !== false)

        setCurrentProjectPath(filePath)
        setCurrentProjectName(projectName)
        window.electronAPI.setWindowTitle(`DubDT - ${projectName}`)
        loadRecents()

        if (res.warnings && res.warnings.length > 0) {
          showNotification(
            `Projeto carregado com avisos: ${res.warnings.join(' | ')}`,
            'warning'
          )
        } else {
          showNotification(`Projeto "${projectName}" carregado com sucesso!`, 'success')
        }
      } catch (err: any) {
        console.error('Erro ao abrir projeto:', err)
        showNotification(`Erro ao abrir projeto: ${err?.message}`, 'warning')
      }
    } else {
      projectFileInputRef.current?.click()
    }
  }

  // Browser fallback for opening project file
  const handleBrowserProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const project: DubDTProject = JSON.parse(ev.target?.result as string)
        const name = file.name.replace(/\.dubdt$/i, '')
        resetLines(project.lines || [])
        if (project.audioSettings) setAudioSettings(project.audioSettings)
        const loadedBgAudio =
          project.customBgAudioPath || project.exportSettings?.customBgAudioPath || null
        setExportSettings({
          ...initialExportSettings,
          ...(project.exportSettings || {}),
          customBgAudioPath: loadedBgAudio,
        })
        setCurrentProjectName(name)
        showNotification(`Projeto "${name}" carregado.`, 'success')
      } catch (err) {
        showNotification('Erro ao processar arquivo .dubdt.', 'warning')
      }
    }
    reader.readAsText(file)
  }

  // Project: Fechar Projeto
  const handleCloseProject = () => {
    if (lines.length > 0 || videoPath) {
      const confirmClose = window.confirm(
        'Deseja fechar o projeto atual? Quaisquer alterações não salvas serão descartadas.'
      )
      if (!confirmClose) return
    }

    setVideoPath(null)
    setVideoMediaUrl(null)
    setVideoName(null)
    setIsVideoMissing(false)
    setMissingVideoName(null)
    setMissingVideoPath(null)
    setIsRelinkModalOpen(false)
    resetLines([])
    setExportSettings(initialExportSettings)
    setCurrentProjectPath(null)
    setCurrentProjectName(null)
    setCurrentLayer(1)
    setEmbedMedia(true)
    setCurrentStep('annotate')
    window.electronAPI?.setWindowTitle('DubDT - Estúdio de Dublagem & Fandub')
    showNotification('Projeto fechado.', 'info')
  }

  // Project: Limpar Recentes
  const handleClearRecents = async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearRecentProjects()
    } else {
      localStorage.removeItem('dubdt_recent_projects')
    }
    setRecentProjects([])
    showNotification('Histórico de projetos recentes limpo.', 'info')
  }

  // Global Keyboard Shortcuts for Project Operations & Undo/Redo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      const isCtrlOrCmd = e.ctrlKey || e.metaKey

      if (isCtrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (e.shiftKey) {
          handleSaveProjectAs()
        } else {
          handleSaveProject()
        }
      } else if (isCtrlOrCmd && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        handleOpenProject()
      } else if (isCtrlOrCmd && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        handleNewProject()
      } else if (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault()
        handleRedo()
      } else if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    currentProjectPath,
    currentProjectName,
    videoPath,
    videoName,
    lines,
    audioSettings,
    exportSettings,
    handleUndo,
    handleRedo,
  ])

  // Relink missing project video (preserves lines, takes and settings)
  const handleRelinkVideo = (selectedFile: { path: string; name: string; mediaUrl: string }) => {
    setVideoPath(selectedFile.path)
    setVideoMediaUrl(selectedFile.mediaUrl)
    setVideoName(selectedFile.name)
    setIsVideoMissing(false)
    setMissingVideoName(null)
    setMissingVideoPath(null)
    setIsRelinkModalOpen(false)
    showNotification(`Vídeo "${selectedFile.name}" reconectado com sucesso!`, 'success')
  }

  // Select video handler (starts new video annotations from scratch)
  const handleSelectVideo = async () => {
    if (window.electronAPI) {
      try {
        const file = await window.electronAPI.selectVideoFile()
        if (file) {
          setVideoPath(file.path)
          setVideoMediaUrl(file.mediaUrl)
          setVideoName(file.name)
          setIsVideoMissing(false)
          setMissingVideoName(null)
          setMissingVideoPath(null)
          setIsRelinkModalOpen(false)
          resetLines([]) // reset lines and history for new video
          setExportSettings((prev) => ({ ...prev, customBgAudioPath: null })) // reset M&E for new video
          showNotification(`Vídeo carregado: ${file.name}`, 'info')
        }
      } catch (err) {
        console.error('Erro ao selecionar vídeo via Electron:', err)
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  // Load video directly (e.g. from drag and drop)
  const handleLoadVideoDirectly = (file: { path: string; name: string; mediaUrl: string }) => {
    setVideoPath(file.path)
    setVideoMediaUrl(file.mediaUrl)
    setVideoName(file.name)
    setIsVideoMissing(false)
    setMissingVideoName(null)
    setMissingVideoPath(null)
    setIsRelinkModalOpen(false)
    resetLines([])
    setExportSettings((prev) => ({ ...prev, customBgAudioPath: null }))
    showNotification(`Vídeo carregado: ${file.name}`, 'info')
  }

  // Prevent default Electron/Chromium drag-and-drop navigation
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => e.preventDefault()
    const handleWindowDrop = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('drop', handleWindowDrop)
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [])

  // Browser fallback for file selection
  const handleBrowserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setVideoPath(file.name)
      setVideoMediaUrl(url)
      setVideoName(file.name)
      resetLines([])
      setExportSettings((prev) => ({ ...prev, customBgAudioPath: null }))
      showNotification(`Vídeo carregado: ${file.name}`, 'info')
    }
  }

  const recordedLinesCount = lines.filter((l) => l.takes && l.takes.length > 0).length

  const linesCountByLayer = lines.reduce<Record<number, number>>((acc, l) => {
    const lyr = l.layer || 1
    acc[lyr] = (acc[lyr] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans relative">
      {/* Hidden file inputs for browser development mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleBrowserFileChange}
        className="hidden"
      />
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".dubdt,application/json"
        onChange={handleBrowserProjectFileChange}
        className="hidden"
      />

      {/* Top Navbar with Project Menu and Global Layer Selector */}
      <Navbar
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        videoName={videoName}
        linesCount={lines.length}
        recordedLinesCount={recordedLinesCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        projectName={currentProjectName}
        recentProjects={recentProjects}
        onNewProject={handleNewProject}
        onOpenProject={() => handleOpenProject()}
        onOpenRecent={(path) => handleOpenProject(path)}
        onSaveProject={handleSaveProject}
        onSaveProjectAs={handleSaveProjectAs}
        onCloseProject={handleCloseProject}
        onClearRecents={handleClearRecents}
        currentLayer={currentLayer}
        onLayerChange={setCurrentLayer}
        linesCountByLayer={linesCountByLayer}
        isVideoMissing={isVideoMissing}
        missingVideoName={missingVideoName}
        onOpenRelinkModal={() => setIsRelinkModalOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="absolute top-14 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div
            className={`px-3 py-2 rounded-lg shadow-2xl border flex items-center gap-2 text-xs backdrop-blur-md max-w-md ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
                : notification.type === 'warning'
                ? 'bg-amber-950/90 border-amber-700/80 text-amber-200'
                : 'bg-zinc-900/95 border-zinc-700 text-zinc-200'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-zinc-400 shrink-0" />}
            <span className="font-medium truncate">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="p-0.5 hover:bg-white/10 rounded ml-1 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Stepper Views */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <ErrorBoundary>
          <div className={`flex-1 flex flex-col overflow-hidden ${currentStep === 'annotate' ? '' : 'hidden'}`}>
            <Step1Annotation
              videoPath={videoPath}
              videoMediaUrl={videoMediaUrl}
              videoName={videoName}
              lines={lines}
              setLines={setLines}
              onSelectVideo={handleSelectVideo}
              onAdvanceToRecording={() => setCurrentStep('record')}
              isActive={currentStep === 'annotate'}
              currentLayer={currentLayer}
              setCurrentLayer={setCurrentLayer}
              isVideoMissing={isVideoMissing}
              missingVideoName={missingVideoName}
              missingVideoPath={missingVideoPath}
              onRelinkVideo={() => setIsRelinkModalOpen(true)}
              onLoadVideoDirectly={handleLoadVideoDirectly}
            />
          </div>

          <div className={`flex-1 flex flex-col overflow-hidden ${currentStep === 'record' ? '' : 'hidden'}`}>
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
              isActive={currentStep === 'record'}
              currentLayer={currentLayer}
              setCurrentLayer={setCurrentLayer}
              onBackToAnnotation={() => setCurrentStep('annotate')}
              isVideoMissing={isVideoMissing}
              onRelinkVideo={() => setIsRelinkModalOpen(true)}
            />
          </div>

          <div className={`flex-1 flex flex-col overflow-hidden ${currentStep === 'export' ? '' : 'hidden'}`}>
            <Step3Export
              videoPath={videoPath}
              videoMediaUrl={videoMediaUrl}
              videoName={videoName}
              lines={lines}
              setLines={setLines}
              exportSettings={exportSettings}
              setExportSettings={setExportSettings}
              isActive={currentStep === 'export'}
              isVideoMissing={isVideoMissing}
              missingVideoName={missingVideoName}
              onRelinkVideo={() => setIsRelinkModalOpen(true)}
            />
          </div>
        </ErrorBoundary>
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

      {/* Save Project Modal (Choose Embed vs References) */}
      <SaveProjectModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onConfirm={handleConfirmSaveProject}
        initialEmbedMedia={embedMedia}
        projectName={currentProjectName}
      />

      {/* Relink Missing Video Modal */}
      <RelinkVideoModal
        isOpen={isRelinkModalOpen}
        onClose={() => setIsRelinkModalOpen(false)}
        expectedVideoName={missingVideoName}
        originalVideoPath={missingVideoPath}
        onRelink={handleRelinkVideo}
      />
    </div>
  )
}

export default App
