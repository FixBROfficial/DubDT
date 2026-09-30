export interface ElectronAPI {
  selectVideoFile: () => Promise<{ path: string; name: string; mediaUrl: string } | null>
  selectAudioFile: () => Promise<{ path: string; name: string; mediaUrl: string } | null>
  selectDirectory: () => Promise<string | null>
  saveFileDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  getWaveformPeaks: (videoPath: string) => Promise<{ duration: number; peaks: number[] }>
  extractAudioForWaveform: (videoPath: string) => Promise<{ path: string; mediaUrl: string }>
  saveTakeAudio: (lineId: string, takeNumber: number, buffer: ArrayBuffer) => Promise<{ filePath: string; mediaUrl: string }>
  exportMix: (options: any) => Promise<{ success: boolean; outputPath: string }>
  exportClips: (options: any) => Promise<{ success: boolean; count: number; files: string[] }>
  exportScriptTxt: (filePath: string, lines: any[]) => Promise<boolean>
  convertToMediaUrl: (filePath: string) => string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
