/* ============================================================
   NEXUS//OS — Web Audio sound engine
   Cash register on sale · ding on AI action · whoosh on notice
   ============================================================ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.7;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

/* browsers require a user gesture before audio — call on first pointerdown */
export function unlockAudio() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gainV: number, when = 0, slideTo?: number) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gainV, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, gainV: number, when = 0, hp = 2000) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gainV, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  setMuted(m: boolean) {
    muted = m;
  },
  isMuted() {
    return muted;
  },
  setVolume(v: number) {
    volume = v;
    if (master) master.gain.value = v;
  },
  /* cha-ching: metallic bell + drawer thunk */
  cash() {
    tone(1318.5, 0.5, "triangle", 0.22);
    tone(1975.5, 0.42, "triangle", 0.16, 0.06);
    tone(2637, 0.3, "sine", 0.1, 0.06);
    noise(0.14, 0.12, 0, 5200);
    tone(160, 0.12, "square", 0.12, 0.14);
    tone(95, 0.16, "sine", 0.16, 0.16);
  },
  /* AI action ding */
  ding() {
    tone(880, 0.28, "sine", 0.16);
    tone(1318.5, 0.34, "sine", 0.1, 0.07);
  },
  /* notification whoosh */
  whoosh() {
    const c = ac();
    if (!c || !master || muted) return;
    noise(0.3, 0.05, 0, 900);
    tone(420, 0.22, "sine", 0.07, 0, 780);
  },
  tick() {
    tone(1500, 0.045, "square", 0.025);
  },
  err() {
    tone(220, 0.2, "sawtooth", 0.08);
    tone(165, 0.26, "sawtooth", 0.08, 0.09);
  },
  approve() {
    tone(660, 0.12, "sine", 0.12);
    tone(990, 0.2, "sine", 0.12, 0.1);
  },
};
