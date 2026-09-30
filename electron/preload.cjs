const { contextBridge, ipcRenderer } = require('electron')
const { pathToFileURL } = require('url')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  selectVideoFile: (options) => ipcRenderer.invoke('dialog:selectVideoFile', options),
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

  // Projects
  selectProjectFileToOpen: () => ipcRenderer.invoke('dialog:selectProjectFileToOpen'),
  selectProjectFileToSave: (defaultName) => ipcRenderer.invoke('dialog:selectProjectFileToSave', defaultName),
  saveProjectFile: (filePath, data) => ipcRenderer.invoke('project:save', { filePath, data }),
  loadProjectFile: (filePath) => ipcRenderer.invoke('project:load', filePath),
  getRecentProjects: () => ipcRenderer.invoke('project:getRecents'),
  clearRecentProjects: () => ipcRenderer.invoke('project:clearRecents'),
  setWindowTitle: (title) => ipcRenderer.invoke('window:setTitle', title),

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

