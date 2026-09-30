const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  selectVideoFile: () => ipcRenderer.invoke('dialog:selectVideoFile'),
  selectAudioFile: () => ipcRenderer.invoke('dialog:selectAudioFile'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // Audio extraction for Waveform
  extractAudioForWaveform: (videoPath) => ipcRenderer.invoke('ffmpeg:extractAudioWaveform', videoPath),

  // Take storage
  saveTakeAudio: (lineId, takeNumber, buffer) => ipcRenderer.invoke('fs:saveTakeAudio', { lineId, takeNumber, buffer }),

  // Exports
  exportMix: (options) => ipcRenderer.invoke('ffmpeg:exportMix', options),
  exportClips: (options) => ipcRenderer.invoke('ffmpeg:exportClips', options),
  exportScriptTxt: (filePath, lines) => ipcRenderer.invoke('fs:exportScriptTxt', { filePath, lines }),

  // Platform & paths
  convertToMediaUrl: (filePath) => `media://${encodeURIComponent(filePath.replace(/\\/g, '/'))}`,
})
