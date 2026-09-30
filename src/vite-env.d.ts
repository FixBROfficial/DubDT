/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    getPathForFile?: (file: File) => string
    resolveDroppedVideoFile?: (filePath: string) => Promise<{ path: string; name: string; mediaUrl: string } | null>
    selectVideoFile: (options?: any) => Promise<{ path: string; name: string; mediaUrl: string } | null>
    selectAudioFile: () => Promise<{ path: string; name: string; mediaUrl: string } | null>
    selectDirectory: () => Promise<string | null>
    saveFileDialog: (options: any) => Promise<string | null>
    getWaveformPeaks: (videoPath: string) => Promise<{ duration: number; peaks: number[] }>
    extractAudioForWaveform: (videoPath: string) => Promise<string>
    saveTakeAudio: (lineId: string, takeNumber: number, buffer: ArrayBuffer) => Promise<{ filePath: string; mediaUrl: string }>
    exportMix: (options: any) => Promise<any>
    exportClips: (options: any) => Promise<any>
    exportScriptTxt: (filePath: string, lines: any[]) => Promise<any>
    selectProjectFileToOpen: () => Promise<string | null>
    selectProjectFileToSave: (defaultName: string) => Promise<string | null>
    saveProjectFile: (filePath: string, data: any) => Promise<any>
    loadProjectFile: (filePath: string) => Promise<any>
    getRecentProjects: () => Promise<any[]>
    clearRecentProjects: () => Promise<boolean>
    setWindowTitle: (title: string) => Promise<void>
    convertToMediaUrl: (filePath: string) => string
  }
}
