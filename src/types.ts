export interface DialogueTake {
  id: string
  takeNumber: number
  filePath: string
  duration: number
  createdAt: number
  audioBlobUrl?: string
}

export interface DialogueLine {
  id: string
  startTime: number
  endTime: number
  text: string
  takes: DialogueTake[]
  activeTakeIndex: number
  layer?: number // 1, 2, 3...
}

export interface AudioSettings {
  inputDeviceId: string
  outputDeviceId: string
  micGain: number // 0 to 2.0
  masterVolume: number // 0 to 1.0
  originalAudioVolumeDuringRecording: number // 0 to 1.0
  preRollSeconds: number // e.g. 1.5s
  countdownBeeps: boolean
}

export type VoiceEffectPreset = 'clean' | 'loudnorm' | 'radio' | 'reverb'

export interface ExportSettings {
  includeOriginalAudio: boolean
  originalAudioVolume: number
  customBgAudioPath: string | null
  customBgAudioVolume: number
  recordedVoicesVolume: number
  voicePreset: VoiceEffectPreset
  enableNoiseSuppression: boolean
  noiseSuppressionLevel: number // 10 to 100 (%)
  exportIndividualClips: boolean
  clipFormat: 'video' | 'audio'
  outputDir: string
}

export type AppStep = 'annotate' | 'record' | 'export'

export interface RecentProject {
  path: string
  name: string
  lastOpened: number
}

export interface DubDTProject {
  dubdtVersion: string
  name: string
  createdAt: number
  updatedAt: number
  videoPath: string | null
  videoName: string | null
  videoFileName?: string | null
  videoOriginalName?: string | null
  customBgAudioPath: string | null
  customBgAudioFileName?: string | null
  lines: DialogueLine[]
  audioSettings: AudioSettings
  exportSettings: ExportSettings
  embedMedia?: boolean
  currentLayer?: number
}
