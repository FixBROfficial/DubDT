const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')
// Disable GPU hardware acceleration if not supported or when running in restricted environments
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('in-process-gpu')
app.commandLine.appendSwitch('no-sandbox')
// Register media scheme as privileged for streaming video/audio
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      standard: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

let mainWindow = null
let projectTakesDir = null

function ensureDirectories() {
  projectTakesDir = path.join(app.getPath('userData'), 'dubdt_takes')
  if (!fs.existsSync(projectTakesDir)) {
    fs.mkdirSync(projectTakesDir, { recursive: true })
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090b',
    title: 'DubDT - Estúdio de Dublagem & Fandub',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows flexible local media streaming
    },
  })

  // Set protocol handler for media streaming
  protocol.handle('media', (request) => {
    try {
      let rawPath = decodeURIComponent(request.url.replace(/^media:\/\//, ''))
      if (/^\/[a-zA-Z]:/.test(rawPath)) {
        rawPath = rawPath.slice(1)
      }
      return net.fetch(pathToFileURL(rawPath).toString())
    } catch (e) {
      console.error('Error serving media protocol:', e)
      return new Response('File not found', { status: 404 })
    }
  })

  const devUrl = 'http://localhost:5173'
  if (process.env.VITE_DEV_SERVER_URL || process.argv.includes('--dev')) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureDirectories()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// --- IPC Handlers ---

// 1. Select Video
ipcMain.handle('dialog:selectVideoFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione o vídeo para dublar',
    properties: ['openFile'],
    filters: [
      { name: 'Vídeos', extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  return {
    path: filePath,
    name: path.basename(filePath),
    mediaUrl: `media://${filePath.replace(/\\/g, '/')}`,
  }
})

// 2. Select Audio (M&E / Sem falas)
ipcMain.handle('dialog:selectAudioFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione a trilha de áudio (Música e Efeitos)',
    properties: ['openFile'],
    filters: [
      { name: 'Áudios', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  return {
    path: filePath,
    name: path.basename(filePath),
    mediaUrl: `media://${filePath.replace(/\\/g, '/')}`,
  }
})

// 3. Select Export Directory
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione a pasta de destino',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// 4. Save File Dialog
ipcMain.handle('dialog:saveFile', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  if (result.canceled || !result.filePath) return null
  return result.filePath
})

// 5. Extract Audio for fast Waveform visualization
ipcMain.handle('ffmpeg:extractAudioWaveform', async (_, videoPath) => {
  return new Promise((resolve, reject) => {
    const filename = `waveform_${Date.now()}.wav`
    const outputPath = path.join(projectTakesDir, filename)

    // Extract light 16-bit mono 22050Hz audio for instantaneous waveform rendering
    const args = [
      '-y',
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '22050',
      '-ac', '1',
      outputPath,
    ]

    const proc = spawn('ffmpeg', args)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({
          path: outputPath,
          mediaUrl: `media://${outputPath.replace(/\\/g, '/')}`,
        })
      } else {
        reject(new Error(`FFmpeg falhou com código ${code}`))
      }
    })
    proc.on('error', (err) => reject(err))
  })
})

// 6. Save recorded audio take
ipcMain.handle('fs:saveTakeAudio', async (_, { lineId, takeNumber, buffer }) => {
  const filename = `take_${lineId}_#${takeNumber}_${Date.now()}.webm`
  const filePath = path.join(projectTakesDir, filename)
  fs.writeFileSync(filePath, Buffer.from(buffer))
  return {
    filePath,
    mediaUrl: `media://${filePath.replace(/\\/g, '/')}`,
  }
})

// 7. Export dialogue script as .txt
ipcMain.handle('fs:exportScriptTxt', async (_, { filePath, lines }) => {
  let content = '========================================\n'
  content += '   DubDT - Roteiro de Dublagem & Falas\n'
  content += `   Data: ${new Date().toLocaleString('pt-BR')}\n`
  content += `   Total de falas: ${lines.length}\n`
  content += '========================================\n\n'

  lines.forEach((line, idx) => {
    const formatTime = (sec) => {
      const m = Math.floor(sec / 60)
      const s = Math.floor(sec % 60)
      const ms = Math.floor((sec % 1) * 1000)
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
    }
    content += `[#${idx + 1}] ${formatTime(line.startTime)} -> ${formatTime(line.endTime)}\n`
    content += `FALA: "${line.text}"\n`
    content += `Takes gravados: ${line.takes ? line.takes.length : 0} (Take ativo: #${(line.activeTakeIndex || 0) + 1})\n`
    content += '----------------------------------------\n\n'
  })

  fs.writeFileSync(filePath, content, 'utf-8')
  return true
})

// Helper: build filter strings for voice effects
function getVoiceFilter(preset, volume) {
  let filter = `volume=${volume}`
  if (preset === 'loudnorm') {
    filter += ',loudnorm=I=-16:TP=-1.5:LRA=11'
  } else if (preset === 'radio') {
    filter += ',highpass=f=300,lowpass=f=3400,volume=1.2'
  } else if (preset === 'reverb') {
    filter += ',aecho=0.8:0.88:60:0.4'
  }
  return filter
}

// 8. Export Mix (Full Video or Full Audio)
ipcMain.handle('ffmpeg:exportMix', async (_, options) => {
  const {
    videoPath,
    outputPath,
    exportType, // 'video' | 'audio'
    includeOriginalAudio,
    originalAudioVolume,
    customBgAudioPath,
    customBgAudioVolume,
    recordedVoicesVolume,
    voicePreset,
    lines, // array of dialogue lines with active takes
  } = options

  return new Promise((resolve, reject) => {
    // Collect active takes with their timestamps
    const activeTakes = []
    lines.forEach((line) => {
      if (line.takes && line.takes.length > 0) {
        const take = line.takes[line.activeTakeIndex || 0]
        if (take && take.filePath && fs.existsSync(take.filePath)) {
          activeTakes.push({
            filePath: take.filePath,
            startTime: line.startTime,
          })
        }
      }
    })

    const args = ['-y']
    let inputCount = 0

    // Input 0: Original video
    args.push('-i', videoPath)
    const videoInputIdx = 0
    inputCount++

    // Background audio inputs
    let customBgIdx = -1
    if (customBgAudioPath && fs.existsSync(customBgAudioPath)) {
      args.push('-i', customBgAudioPath)
      customBgIdx = inputCount
      inputCount++
    }

    // Dialogue take inputs
    const takeInputIndices = []
    activeTakes.forEach((t) => {
      args.push('-i', t.filePath)
      takeInputIndices.push({
        idx: inputCount,
        startTime: t.startTime,
      })
      inputCount++
    })

    // Construct filter_complex
    const filterParts = []
    const mixedAudioInputs = []

    // 1. Background audio track
    if (customBgIdx !== -1) {
      filterParts.push(`[${customBgIdx}:a]volume=${customBgAudioVolume}[bg_audio]`)
      mixedAudioInputs.push('[bg_audio]')
    } else if (includeOriginalAudio) {
      filterParts.push(`[${videoInputIdx}:a]volume=${originalAudioVolume}[bg_audio]`)
      mixedAudioInputs.push('[bg_audio]')
    }

    // 2. Dialogue takes with delay and voice effects
    takeInputIndices.forEach((t, i) => {
      const delayMs = Math.round(t.startTime * 1000)
      const voiceFilter = getVoiceFilter(voicePreset, recordedVoicesVolume)
      const outLabel = `voice_${i}`
      filterParts.push(`[${t.idx}:a]${voiceFilter},adelay=${delayMs}|${delayMs}[${outLabel}]`)
      mixedAudioInputs.push(`[${outLabel}]`)
    })

    // Mix all audio streams
    if (mixedAudioInputs.length > 0) {
      filterParts.push(`${mixedAudioInputs.join('')}amix=inputs=${mixedAudioInputs.length}:dropout_transition=0:normalize=0[aout]`)
    } else {
      // If nothing selected, create silent audio
      filterParts.push('anullsrc=r=44100:cl=stereo[aout]')
    }

    args.push('-filter_complex', filterParts.join(';'))

    if (exportType === 'video') {
      args.push('-map', `${videoInputIdx}:v`)
      args.push('-map', '[aout]')
      args.push('-c:v', 'copy')
      args.push('-c:a', 'aac')
      args.push('-b:a', '192k')
    } else {
      args.push('-map', '[aout]')
      if (outputPath.endsWith('.mp3')) {
        args.push('-c:a', 'libmp3lame', '-b:a', '256k')
      } else {
        args.push('-c:a', 'pcm_s16le')
      }
    }

    args.push(outputPath)

    console.log('Running FFmpeg Mix:', 'ffmpeg', args.join(' '))

    const proc = spawn('ffmpeg', args)
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, outputPath })
      } else {
        console.error('FFmpeg export error:', stderr)
        reject(new Error(`Erro ao exportar: FFmpeg retornou código ${code}`))
      }
    })
    proc.on('error', (err) => reject(err))
  })
})

// 9. Export Individual Clips (Batch)
ipcMain.handle('ffmpeg:exportClips', async (_, options) => {
  const {
    videoPath,
    outputDir,
    clipFormat, // 'video' | 'audio'
    includeBackground,
    lines,
    voicePreset,
    recordedVoicesVolume,
  } = options

  const results = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.takes || line.takes.length === 0) continue

    const activeTake = line.takes[line.activeTakeIndex || 0]
    if (!activeTake || !activeTake.filePath || !fs.existsSync(activeTake.filePath)) continue

    const safeText = (line.text || `fala_${i + 1}`)
      .replace(/[/\\?%*:|"<>]/g, '')
      .trim()
      .slice(0, 25) || `fala_${i + 1}`

    const ext = clipFormat === 'video' ? 'mp4' : 'wav'
    const fileName = `clip_${String(i + 1).padStart(2, '0')}_${safeText}.${ext}`
    const clipOutputPath = path.join(outputDir, fileName)

    const duration = Math.max(0.1, line.endTime - line.startTime)
    const voiceFilter = getVoiceFilter(voicePreset, recordedVoicesVolume)

    await new Promise((resolve) => {
      const args = ['-y']

      if (clipFormat === 'video') {
        // Cut video slice and add voice take
        args.push('-ss', String(line.startTime))
        args.push('-t', String(duration))
        args.push('-i', videoPath)
        args.push('-i', activeTake.filePath)

        if (includeBackground) {
          args.push(
            '-filter_complex',
            `[1:a]${voiceFilter}[v];[0:a][v]amix=inputs=2:dropout_transition=0:normalize=0[aout]`
          )
          args.push('-map', '0:v', '-map', '[aout]')
        } else {
          args.push('-filter_complex', `[1:a]${voiceFilter}[aout]`)
          args.push('-map', '0:v', '-map', '[aout]')
        }

        args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', clipOutputPath)
      } else {
        // Audio only clip
        args.push('-i', activeTake.filePath)
        args.push('-af', voiceFilter)
        args.push('-c:a', 'pcm_s16le', clipOutputPath)
      }

      const proc = spawn('ffmpeg', args)
      proc.on('close', (code) => {
        if (code === 0) {
          results.push(clipOutputPath)
        }
        resolve(code)
      })
      proc.on('error', () => resolve(-1))
    })
  }

  return { success: true, count: results.length, files: results }
})
