// DEMO-ONLY sound design for /stage, generated with Web Audio (no audio files):
// a low drone that rises with the blackout countdown, a hard cut to silence at the blackout,
// a short alarm, then the drone returns, quieter.
export class StageAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private drone: { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null

  /** Must run inside the PLAY click (browsers only start audio after a user gesture). */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
    }
    void this.ctx.resume()
  }

  private get now() {
    return this.ctx?.currentTime ?? 0
  }

  startDrone() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    this.stopDrone()
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 260
    filter.Q.value = 2
    const gain = ctx.createGain()
    gain.gain.value = 0
    filter.connect(gain).connect(this.master)
    // Root, a slightly detuned copy (slow beating) and a low fifth.
    const oscs = [
      [55, 'sawtooth'],
      [55.35, 'sawtooth'],
      [82.4, 'triangle'],
    ].map(([f, type]) => {
      const o = ctx.createOscillator()
      o.type = type as OscillatorType
      o.frequency.value = f as number
      o.connect(filter)
      o.start()
      return o
    })
    gain.gain.setTargetAtTime(0.05, this.now, 0.8)
    this.drone = { oscs, filter, gain }
  }

  /** 0 = calm, 1 = about to fail: pitch, brightness and volume all rise. */
  tension(p: number) {
    const d = this.drone
    if (!d) return
    const t = Math.max(0, Math.min(1, p))
    const base = [55, 55.35, 82.4]
    d.oscs.forEach((o, i) => o.frequency.setTargetAtTime(base[i] * (1 + 0.9 * t), this.now, 0.4))
    d.filter.frequency.setTargetAtTime(260 + 1400 * t, this.now, 0.4)
    d.gain.gain.setTargetAtTime(0.05 + 0.13 * t, this.now, 0.4)
  }

  /** Hard cut: the lights — and the sound — go out. */
  cut() {
    this.drone?.gain.gain.cancelScheduledValues(this.now)
    this.drone?.gain.gain.setValueAtTime(0, this.now)
  }

  /** Short three-pulse alarm (~0.9 s). */
  alarm() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t0 = this.now + 0.02
    ;[880, 660, 880].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'square'
      o.frequency.value = f
      g.gain.setValueAtTime(0, t0 + i * 0.3)
      g.gain.linearRampToValueAtTime(0.16, t0 + i * 0.3 + 0.02)
      g.gain.setValueAtTime(0.16, t0 + i * 0.3 + 0.18)
      g.gain.linearRampToValueAtTime(0, t0 + i * 0.3 + 0.22)
      o.connect(g).connect(this.master!)
      o.start(t0 + i * 0.3)
      o.stop(t0 + i * 0.3 + 0.25)
    })
  }

  /** After the blackout: the drone comes back low and quiet. */
  afterBlackout() {
    const d = this.drone
    if (!d) return
    const base = [48, 48.3, 72]
    d.oscs.forEach((o, i) => o.frequency.setValueAtTime(base[i], this.now))
    d.filter.frequency.setValueAtTime(220, this.now)
    d.gain.gain.setTargetAtTime(0.03, this.now, 1.2)
  }

  fadeOut(ms: number) {
    this.drone?.gain.gain.setTargetAtTime(0, this.now, ms / 1000 / 3)
  }

  stopDrone() {
    this.drone?.oscs.forEach((o) => {
      try {
        o.stop()
      } catch {
        // already stopped
      }
    })
    this.drone = null
  }

  suspend() {
    void this.ctx?.suspend()
  }

  resume() {
    void this.ctx?.resume()
  }
}
