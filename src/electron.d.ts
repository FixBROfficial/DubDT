export interface ElectronAPI {
  selectVideoFile: (options?: { title?: string; defaultPath?: string }) => Promise<{ path: string; name: string; mediaUrl: string } | null>
  selectAudioFile: () => Promise<{ path: string; name: string; mediaUrl: string } | null>
  selectDirectory: () => Promise<string | null>
  saveFileDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  getWaveformPeaks: (videoPath: string) => Promise<{ duration: number; peaks: number[] }>
  extractAudioForWaveform: (videoPath: string) => Promise<{ path: string; mediaUrl: string }>
  saveTakeAudio: (lineId: string, takeNumber: number, buffer: ArrayBuffer) => Promise<{ filePath: string; mediaUrl: string }>
  exportMix: (options: any) => Promise<{ success: boolean; outputPath: string }>
  exportClips: (options: any) => Promise<{ success: boolean; count: number; files: string[] }>
  exportScriptTxt: (filePath: string, lines: any[]) => Promise<boolean>
  selectProjectFileToOpen: () => Promise<string | null>
  selectProjectFileToSave: (defaultName?: string) => Promise<string | null>
  saveProjectFile: (filePath: string, data: any) => Promise<{ success: boolean; filePath: string }>
  loadProjectFile: (filePath: string) => Promise<{ success: boolean; data: any; warnings?: string[] }>
  getRecentProjects: () => Promise<Array<{ path: string; name: string; lastOpened: number }>>
  clearRecentProjects: () => Promise<boolean>
  setWindowTitle: (title: string) => Promise<void>
  convertToMediaUrl: (filePath: string) => string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
