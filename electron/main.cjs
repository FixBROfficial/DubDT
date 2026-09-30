const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const tar = require('tar')
const { spawn } = require('child_process')
const { Readable } = require('stream')
const { pathToFileURL, fileURLToPath } = require('url')
// Disable GPU hardware acceleration if not supported or when running in restricted environments
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('in-process-gpu')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
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
let projectSessionsDir = null

function ensureDirectories() {
  projectTakesDir = path.join(app.getPath('userData'), 'dubdt_takes')
  projectSessionsDir = path.join(app.getPath('userData'), 'dubdt_sessions')
  if (!fs.existsSync(projectTakesDir)) {
    fs.mkdirSync(projectTakesDir, { recursive: true })
  }
  if (!fs.existsSync(projectSessionsDir)) {
    fs.mkdirSync(projectSessionsDir, { recursive: true })
  }
}

function pathToMediaUrl(filePath) {
  if (!filePath) return ''
  return pathToFileURL(path.resolve(filePath)).href.replace(/^file:/, 'media:')
}

function mediaUrlToPath(mediaUrl) {
  try {
    const fileUrl = mediaUrl.replace(/^media:/, 'file:')
    let p = fileURLToPath(fileUrl)
    if (process.platform === 'win32' && p.startsWith('\\\\') && p.length > 3 && p[3] === '\\') {
      p = p[2] + ':' + p.substring(3)
    }
    return p
  } catch {
    let raw = decodeURIComponent(mediaUrl.replace(/^media:\/{1,3}/, ''))
    if (/^\/[a-zA-Z]:/.test(raw)) {
      raw = raw.slice(1)
    } else if (/^[a-zA-Z]\//.test(raw)) {
      raw = raw[0] + ':' + raw.slice(1)
    }
    return path.normalize(raw)
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mkv':
      return 'video/x-matroska'
    case '.mov':
      return 'video/quicktime'
    case '.avi':
      return 'video/x-msvideo'
    case '.wav':
      return 'audio/wav'
    case '.mp3':
      return 'audio/mpeg'
    case '.ogg':
      return 'audio/ogg'
    case '.aac':
      return 'audio/aac'
    case '.flac':
      return 'audio/flac'
    default:
      return 'application/octet-stream'
  }
}

function registerMediaProtocol() {
  protocol.handle('media', async (request) => {
    try {
      const targetPath = mediaUrlToPath(request.url)
      if (!fs.existsSync(targetPath)) {
        console.warn('[media protocol] Arquivo não encontrado:', targetPath, 'para URL:', request.url)
        return new Response('File not found', { status: 404 })
      }

      const stat = fs.statSync(targetPath)
      const fileSize = stat.size
      const mimeType = getMimeType(targetPath)
      const rangeHeader = request.headers.get('Range') || request.headers.get('range')

      if (rangeHeader) {
        const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/)
        if (matches) {
          let start = matches[1] ? parseInt(matches[1], 10) : 0
          let end = matches[2] ? parseInt(matches[2], 10) : fileSize - 1

          if (isNaN(start)) start = 0
          if (isNaN(end) || end >= fileSize) end = fileSize - 1

          if (start >= fileSize || start > end) {
            return new Response('Requested Range Not Satisfiable', {
              status: 416,
              headers: {
                'Content-Range': `bytes */${fileSize}`,
              },
            })
          }

          const chunkSize = end - start + 1
          const nodeStream = fs.createReadStream(targetPath, { start, end })
          const webStream = Readable.toWeb(nodeStream)

          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
              'Content-Type': mimeType,
            },
          })
        }
      }

      // No range header: return stream with Accept-Ranges
      const nodeStream = fs.createReadStream(targetPath)
      const webStream = Readable.toWeb(nodeStream)
      return new Response(webStream, {
        status: 200,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(fileSize),
          'Content-Type': mimeType,
        },
      })
    } catch (e) {
      console.error('[media protocol] Erro ao servir mídia:', e)
      return new Response('Error loading media', { status: 500 })
    }
  })
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

  const devUrl = 'http://localhost:5173'
  if (process.env.VITE_DEV_SERVER_URL || process.argv.includes('--dev')) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureDirectories()
  registerMediaProtocol()
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
    mediaUrl: pathToMediaUrl(filePath),
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
    mediaUrl: pathToMediaUrl(filePath),
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

// --- Project Persistence & Recents ---
function getRecentProjectsPath() {
  return path.join(app.getPath('userData'), 'recent_projects.json')
}

function loadRecentProjects() {
  try {
    const p = getRecentProjectsPath()
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch (e) {}
  return []
}

function saveRecentProjects(list) {
  try {
    fs.writeFileSync(getRecentProjectsPath(), JSON.stringify(list, null, 2), 'utf-8')
  } catch (e) {}
}

function addRecentProject(projectPath) {
  try {
    let list = loadRecentProjects()
    list = list.filter((item) => item.path.toLowerCase() !== projectPath.toLowerCase())
    list.unshift({
      path: projectPath,
      name: path.basename(projectPath, path.extname(projectPath)) || path.basename(projectPath),
      lastOpened: Date.now(),
    })
    if (list.length > 10) list = list.slice(0, 10)
    saveRecentProjects(list)
  } catch (e) {}
}

ipcMain.handle('dialog:selectProjectFileToOpen', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir Projeto DubDT',
    properties: ['openFile'],
    filters: [
      { name: 'Projetos DubDT (*.dubdt)', extensions: ['dubdt'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:selectProjectFileToSave', async (_, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Projeto DubDT',
    defaultPath: defaultName || 'MeuProjeto.dubdt',
    filters: [
      { name: 'Projetos DubDT (*.dubdt)', extensions: ['dubdt'] },
    ],
  })
  if (result.canceled || !result.filePath) return null
  let filePath = result.filePath
  if (!filePath.toLowerCase().endsWith('.dubdt')) {
    filePath += '.dubdt'
  }
  return filePath
})

ipcMain.handle('project:save', async (_, { filePath, data }) => {
  try {
    addRecentProject(filePath)

    // Staging directory for bundling
    const stagingBase = path.join(app.getPath('userData'), 'dubdt_staging')
    if (!fs.existsSync(stagingBase)) {
      fs.mkdirSync(stagingBase, { recursive: true })
    }
    const stagingDir = path.join(stagingBase, `stage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
    fs.mkdirSync(stagingDir, { recursive: true })

    const manifest = {
      ...data,
      dubdtVersion: '2.0',
      updatedAt: Date.now(),
    }

    // 1. Bundle video file directly into the .dubdt package
    if (data.videoPath && fs.existsSync(data.videoPath)) {
      const ext = path.extname(data.videoPath).toLowerCase() || '.mp4'
      const videoFileName = `video${ext}`
      const targetVideoPath = path.join(stagingDir, videoFileName)

      try {
        fs.linkSync(data.videoPath, targetVideoPath)
      } catch {
        fs.copyFileSync(data.videoPath, targetVideoPath)
      }

      manifest.videoFileName = videoFileName
      manifest.videoOriginalName = data.videoName || path.basename(data.videoPath)
      manifest.videoPath = null // portable
    }

    // 2. Bundle custom background audio if present
    if (data.customBgAudioPath && fs.existsSync(data.customBgAudioPath)) {
      const ext = path.extname(data.customBgAudioPath).toLowerCase() || '.mp3'
      const bgFileName = `custom_bg${ext}`
      const targetBgPath = path.join(stagingDir, bgFileName)

      try {
        fs.linkSync(data.customBgAudioPath, targetBgPath)
      } catch {
        fs.copyFileSync(data.customBgAudioPath, targetBgPath)
      }

      manifest.customBgAudioFileName = bgFileName
      manifest.customBgAudioPath = null
    }

    // 3. Bundle takes
    const takesStagingDir = path.join(stagingDir, 'takes')
    fs.mkdirSync(takesStagingDir, { recursive: true })

    if (Array.isArray(manifest.lines)) {
      manifest.lines = manifest.lines.map((line) => {
        if (!Array.isArray(line.takes)) return line

        const bundledTakes = line.takes.map((take) => {
          if (take.filePath && fs.existsSync(take.filePath)) {
            const takeFileName = path.basename(take.filePath)
            const targetTakePath = path.join(takesStagingDir, takeFileName)

            if (!fs.existsSync(targetTakePath)) {
              try {
                fs.linkSync(take.filePath, targetTakePath)
              } catch {
                fs.copyFileSync(take.filePath, targetTakePath)
              }
            }

            return {
              ...take,
              relativeFilePath: `takes/${takeFileName}`,
              filePath: '',
              audioBlobUrl: undefined,
            }
          }
          return take
        })

        return { ...line, takes: bundledTakes }
      })
    }

    // 4. Write manifest
    fs.writeFileSync(path.join(stagingDir, 'project.json'), JSON.stringify(manifest, null, 2), 'utf-8')

    // 5. Pack everything into .dubdt archive via tar
    const entries = fs.readdirSync(stagingDir)

    const targetFolder = path.dirname(filePath)
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true })
    }

    await tar.c(
      {
        file: filePath,
        cwd: stagingDir,
      },
      entries
    )

    // 6. Clean up staging directory
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true })
    } catch (e) {}

    return { success: true, filePath }
  } catch (err) {
    console.error('Erro ao salvar arquivo de projeto (.dubdt):', err)
    throw err
  }
})

ipcMain.handle('project:load', async (_, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo de projeto não encontrado: ${filePath}`)
    }

    addRecentProject(filePath)
    const warnings = []

    // Check if legacy JSON or TAR archive
    const fd = fs.openSync(filePath, 'r')
    const headerBuf = Buffer.alloc(16)
    fs.readSync(fd, headerBuf, 0, 16, 0)
    fs.closeSync(fd)

    const isLegacyJson = headerBuf.toString('utf-8').trim().startsWith('{')

    let project = null

    if (isLegacyJson) {
      // Legacy JSON fallback
      const content = fs.readFileSync(filePath, 'utf-8')
      project = JSON.parse(content)

      if (project.videoPath) {
        if (fs.existsSync(project.videoPath)) {
          project.videoMediaUrl = pathToMediaUrl(project.videoPath)
        } else {
          warnings.push(`Arquivo de vídeo não encontrado no caminho original: ${project.videoPath}`)
          project.videoMediaUrl = null
        }
      }

      if (project.customBgAudioPath) {
        if (fs.existsSync(project.customBgAudioPath)) {
          project.customBgAudioMediaUrl = pathToMediaUrl(project.customBgAudioPath)
        } else {
          warnings.push(`Trilha de áudio M&E não encontrada: ${project.customBgAudioPath}`)
        }
      }

      if (Array.isArray(project.lines)) {
        for (const line of project.lines) {
          if (Array.isArray(line.takes)) {
            for (const take of line.takes) {
              if (take.filePath) {
                if (fs.existsSync(take.filePath)) {
                  take.audioBlobUrl = pathToMediaUrl(take.filePath)
                } else {
                  warnings.push(`Gravação não encontrada: ${take.filePath}`)
                }
              }
            }
          }
        }
      }
    } else {
      // TAR archive containing embedded video, takes, and project.json!
      const projectId = crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12)
      const sessionDir = path.join(projectSessionsDir, projectId)
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true })
      }

      await tar.x({
        file: filePath,
        cwd: sessionDir,
      })

      const manifestPath = path.join(sessionDir, 'project.json')
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Arquivo de projeto corrompido: project.json não encontrado dentro do pacote.')
      }

      project = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

      // Locate embedded video
      if (project.videoFileName) {
        const extractedVideoPath = path.join(sessionDir, project.videoFileName)
        if (fs.existsSync(extractedVideoPath)) {
          project.videoPath = extractedVideoPath
          project.videoMediaUrl = pathToMediaUrl(extractedVideoPath)
          project.videoName = project.videoOriginalName || path.basename(extractedVideoPath)
        } else {
          warnings.push('Vídeo não encontrado dentro do pacote do projeto.')
          project.videoPath = null
          project.videoMediaUrl = null
        }
      } else if (project.videoPath && fs.existsSync(project.videoPath)) {
        project.videoMediaUrl = pathToMediaUrl(project.videoPath)
      }

      // Locate embedded custom background audio
      if (project.customBgAudioFileName) {
        const extractedBgPath = path.join(sessionDir, project.customBgAudioFileName)
        if (fs.existsSync(extractedBgPath)) {
          project.customBgAudioPath = extractedBgPath
          project.customBgAudioMediaUrl = pathToMediaUrl(extractedBgPath)
        }
      }

      // Locate embedded takes
      if (Array.isArray(project.lines)) {
        for (const line of project.lines) {
          if (Array.isArray(line.takes)) {
            for (const take of line.takes) {
              if (take.relativeFilePath) {
                const extractedTakePath = path.join(sessionDir, take.relativeFilePath)
                if (fs.existsSync(extractedTakePath)) {
                  take.filePath = extractedTakePath
                  take.audioBlobUrl = pathToMediaUrl(extractedTakePath)
                }
              } else if (take.filePath && fs.existsSync(take.filePath)) {
                take.audioBlobUrl = pathToMediaUrl(take.filePath)
              }
            }
          }
        }
      }
    }

    return { success: true, data: project, warnings }
  } catch (err) {
    console.error('Erro ao abrir arquivo de projeto (.dubdt):', err)
    throw err
  }
})

ipcMain.handle('project:getRecents', async () => {
  return loadRecentProjects()
})

ipcMain.handle('project:clearRecents', async () => {
  saveRecentProjects([])
  return true
})

ipcMain.handle('window:setTitle', async (_, title) => {
  if (mainWindow) {
    mainWindow.setTitle(title)
  }
})

const peaksCache = new Map()

function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', () => {
      const lines = out.trim().split(/\r?\n/)
      let maxDur = 0
      for (const line of lines) {
        const val = parseFloat(line.trim())
        if (!isNaN(val) && val > maxDur) maxDur = val
      }
      resolve(maxDur)
    })
    proc.on('error', () => resolve(0))
  })
}

// 5. Ultra-fast Streaming Waveform Peaks extraction
ipcMain.handle('ffmpeg:getWaveformPeaks', async (_, videoPath) => {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error('Arquivo de vídeo não encontrado.')
  }

  // Check cache first
  try {
    const stat = fs.statSync(videoPath)
    const cacheKey = `${videoPath}_${stat.mtimeMs}`
    if (peaksCache.has(cacheKey)) {
      return peaksCache.get(cacheKey)
    }
  } catch (e) {}

  const duration = await getVideoDuration(videoPath)

  // Use 50 peaks per second for crisp waveform detail
  // Downsample to 8000Hz mono s16le for maximum decoding speed without memory bloat
  const targetSampleRate = 8000
  const peaksPerSecond = 50
  const samplesPerPeak = Math.floor(targetSampleRate / peaksPerSecond) // 160 samples per peak window

  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-vn', '-sn', '-dn',
      '-acodec', 'pcm_s16le',
      '-ar', String(targetSampleRate),
      '-ac', '1',
      '-f', 's16le',
      'pipe:1',
    ]

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] })
    const peaks = []
    let currentMax = 0
    let sampleCounter = 0
    let remainder = Buffer.alloc(0)

    proc.stdout.on('data', (chunk) => {
      if (remainder.length > 0) {
        chunk = Buffer.concat([remainder, chunk])
        remainder = Buffer.alloc(0)
      }

      const sampleCount = Math.floor(chunk.length / 2)
      const remainingBytes = chunk.length % 2
      if (remainingBytes > 0) {
        remainder = chunk.slice(chunk.length - remainingBytes)
      }

      for (let i = 0; i < sampleCount; i++) {
        const val = Math.abs(chunk.readInt16LE(i * 2))
        if (val > currentMax) currentMax = val
        sampleCounter++

        if (sampleCounter >= samplesPerPeak) {
          peaks.push(currentMax / 32768)
          currentMax = 0
          sampleCounter = 0
        }
      }
    })

    proc.on('close', (code) => {
      if (sampleCounter > 0) {
        peaks.push(currentMax / 32768)
      }

      // Normalize peaks if maximum amplitude is low
      let maxVal = 0
      for (let i = 0; i < peaks.length; i++) {
        if (peaks[i] > maxVal) maxVal = peaks[i]
      }
      if (maxVal > 0 && maxVal < 0.9) {
        const factor = 1 / maxVal
        for (let i = 0; i < peaks.length; i++) {
          peaks[i] = Math.min(1, peaks[i] * factor)
        }
      }

      const result = {
        duration: duration || (peaks.length / peaksPerSecond),
        peaks,
      }

      try {
        const stat = fs.statSync(videoPath)
        peaksCache.set(`${videoPath}_${stat.mtimeMs}`, result)
      } catch (e) {}

      resolve(result)
    })

    proc.on('error', (err) => {
      console.error('Erro no FFmpeg ao extrair peaks:', err)
      reject(err)
    })
  })
})

// 5b. Extract Audio for fast Waveform visualization (legacy fallback)
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
          mediaUrl: pathToMediaUrl(outputPath),
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
    mediaUrl: pathToMediaUrl(filePath),
  }
})

// 7. Export dialogue script as .txt (clean dialogue lines separated by newline)
ipcMain.handle('fs:exportScriptTxt', async (_, { filePath, lines }) => {
  const content = lines
    .map((l) => (l.text || '').trim())
    .filter((text) => text.length > 0)
    .join('\n')

  fs.writeFileSync(filePath, content ? content + '\n' : '', 'utf-8')
  return true
})

// Helper: build filter strings for voice effects & modulatable noise suppression
function getVoiceFilter(preset, volume, enableNoiseSuppression = false, noiseSuppressionLevel = 50) {
  let filter = `volume=${volume}`

  // Modulatable noise suppression (active only if enabled by user in mixing)
  if (enableNoiseSuppression) {
    const level = Math.max(10, Math.min(100, noiseSuppressionLevel || 50))
    // Map 10-100% to nr (noise reduction in dB): 6dB to 30dB
    const nr = Math.round(6 + ((level - 10) / 90) * 24)
    filter += `,afftdn=nr=${nr}:nf=-25`
  }

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
    enableNoiseSuppression,
    noiseSuppressionLevel,
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

    // 2. Dialogue takes with delay, voice effects, and modulatable noise suppression
    takeInputIndices.forEach((t, i) => {
      const delayMs = Math.round(t.startTime * 1000)
      const voiceFilter = getVoiceFilter(voicePreset, recordedVoicesVolume, enableNoiseSuppression, noiseSuppressionLevel)
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
    enableNoiseSuppression,
    noiseSuppressionLevel,
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
    const voiceFilter = getVoiceFilter(voicePreset, recordedVoicesVolume, enableNoiseSuppression, noiseSuppressionLevel)

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
