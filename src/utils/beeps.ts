let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function playBeep(freq = 440, duration = 0.08, type: OscillatorType = 'sine', volume = 0.3) {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    // Smooth envelope to avoid clicks
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (err) {
    console.warn('AudioContext beep error:', err)
  }
}

export function playCountdownStep(secondsLeft: number) {
  if (secondsLeft > 0) {
    // 3, 2, 1 beeps: 587.33 Hz (D5) or 600 Hz
    playBeep(600, 0.09, 'sine', 0.25)
  } else {
    // GO beep: 1000 Hz high pitch
    playBeep(1000, 0.14, 'triangle', 0.3)
  }
}
