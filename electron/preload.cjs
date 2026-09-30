const { contextBridge, ipcRenderer, webUtils } = require('electron')
const { pathToFileURL } = require('url')

// Capture drop events directly in preload to extract native file paths without marshaling issues
window.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i]
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        try {
          const p = webUtils.getPathForFile(file)
          if (p) {
            Object.defineProperty(file, 'realPath', { value: p, configurable: true, writable: true })
          }
        } catch (err) {}
      }
    }
  }
}, true)

contextBridge.exposeInMainWorld('electronAPI', {
  // File utilities (Drag and drop)
  getPathForFile: (file) => {
    if (!file) return ''
    if (file.realPath) return file.realPath
    if (webUtils && typeof webUtils.getPathForFile === 'function') {
      try {
        const p = webUtils.getPathForFile(file)
        if (p) return p
      } catch (e) {}
    }
    return file?.path || ''
  },
  resolveDroppedVideoFile: (filePath) => ipcRenderer.invoke('video:resolveFile', filePath),

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

