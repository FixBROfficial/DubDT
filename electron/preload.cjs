const { contextBridge, ipcRenderer } = require('electron')
const { pathToFileURL } = require('url')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  selectVideoFile: () => ipcRenderer.invoke('dialog:selectVideoFile'),
  selectAudioFile: () => ipcRenderer.invoke('dialog:selectAudioFile'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // Audio extraction for Waveform
  getWaveformPeaks: (videoPath) => ipcRenderer.invoke('ffmpeg:getWaveformPeaks', videoPath),
  extractAudioForWaveform: (videoPath) => ipcRenderer.invoke('ffmpeg:extractAudioWaveform', videoPath),

  // Take storage
  saveTakeAudio: (lineId, takeNumber, buffer) => ipcRenderer.invoke('fs:saveTakeAudio', { lineId, takeNumber, buffer }),

  // Exports
  exportMix: (options) => ipcRenderer.invoke('ffmpeg:exportMix', options),
  exportClips: (options) => ipcRenderer.invoke('ffmpeg:exportClips', options),
  exportScriptTxt: (filePath, lines) => ipcRenderer.invoke('fs:exportScriptTxt', { filePath, lines }),

  // Platform & paths
  convertToMediaUrl: (filePath) => {
    if (!filePath) return ''
    if (filePath.startsWith('media:') || filePath.startsWith('blob:')) return filePath
    try {
      return pathToFileURL(filePath).href.replace(/^file:/, 'media:')
    } catch {
      return `media:///${filePath.replace(/\\/g, '/')}`
    }
  },
})

