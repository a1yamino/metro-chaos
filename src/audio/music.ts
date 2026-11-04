/**
 * 自适应背景音乐：WebAudio 实时合成，无音频文件，原创旋律。
 * 5 层共用一个 16 分音符时钟：pad（常驻）、琶音、低音脉冲、沙锤/踩镲、高音紧张层。
 * setTension(0..1) 用 setTargetAtTime 平滑淡入淡出各层（约 1.5 s），不会爆音。
 * 调度用 lookahead：每 25 ms 把未来 0.15 s 内的音符排好；每帧不创建节点。
 */
export const BPM = 92;
const STEP = 60 / BPM / 4; // 16 分音符
export const LAYERS = ['pad', 'arp', 'bass', 'hats', 'high'] as const;
export type Layer = typeof LAYERS[number];

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 紧张度到各层音量（0..1）的映射；纯函数，可测 */
export function layerLevels(t: number): Record<Layer, number> {
  return {
    pad: 0.7 + 0.3 * (1 - smooth(0.6, 1, t)),
    arp: smooth(0.1, 0.4, t),
    bass: smooth(0.3, 0.6, t),
    hats: smooth(0.5, 0.8, t),
    high: smooth(0.75, 1, t),
  };
}
const LAYER_VOL: Record<Layer, number> = { pad: 0.16, arp: 0.09, bass: 0.13, hats: 0.05, high: 0.04 };

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
// 4 小节和声（MIDI 根音 + 和弦音）。平静：C 利底亚色彩；紧张：转到 A 小调方向
const CALM = [[48, [60, 64, 67, 71]], [45, [57, 60, 64, 67]], [53, [57, 60, 65, 69]], [50, [57, 62, 66, 69]]] as const;
const TENSE = [[45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [43, [59, 62, 67, 71]], [40, [56, 59, 64, 68]]] as const;
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2]; // 每小节 16 步，取和弦音的序号
const HIGH = [0, -1, 3, -1, 2, -1, 3, 1, -1, 3, -1, 2, 3, -1, 1, -1];

export class Music {
  readonly out: GainNode;
  private layer = {} as Record<Layer, GainNode>;
  private filter: BiquadFilterNode;
  private noise: AudioBuffer;
  private step = 0; private next = 0; private tension = 0; private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private ac: BaseAudioContext, dest: AudioNode = ac.destination) {
    this.out = ac.createGain(); this.out.gain.value = 0.8;
    this.filter = ac.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 1400; this.filter.Q.value = 0.5;
    this.filter.connect(this.out).connect(dest);
    for (const k of LAYERS) { const g = ac.createGain(); g.gain.value = 0; g.connect(k === 'hats' ? this.out : this.filter); this.layer[k] = g; }
    const n = Math.floor(ac.sampleRate * 0.05); this.noise = ac.createBuffer(1, n, ac.sampleRate);
    const d = this.noise.getChannelData(0); let s = 12345; // 确定性噪声，不用 Math.random
    for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 2 ** 31 - 1) * (1 - i / n); }
    this.setTension(0, true);
  }
  /** 设置紧张度；instant 用于开始时直接到位 */
  setTension(t: number, instant = false) {
    t = Math.max(0, Math.min(1, t));
    if (!instant && Math.abs(t - this.tension) < 0.01) return; // 每帧调用也不堆积自动化事件
    this.tension = t;
    const now = this.ac.currentTime, lv = layerLevels(this.tension);
    for (const k of LAYERS) {
      const p = this.layer[k].gain, v = lv[k] * LAYER_VOL[k];
      if (instant) p.setValueAtTime(v, now); else p.setTargetAtTime(v, now, 0.5);
    }
    const f = 1400 + 3600 * this.tension;
    if (instant) this.filter.frequency.setValueAtTime(f, now); else this.filter.frequency.setTargetAtTime(f, now, 0.5);
  }
  levels() { return layerLevels(this.tension); }
  get level(): Record<Layer, number> { const r = {} as Record<Layer, number>; for (const k of LAYERS) r[k] = this.layer[k].gain.value / LAYER_VOL[k]; return r; }
  private note(dest: AudioNode, f: number, t0: number, dur: number, vol: number, type: OscillatorType, atk = 0.01, detune = 0) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.setTargetAtTime(0, t0 + Math.max(atk, dur - 0.05), dur / 4 + 0.02);
    o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + dur + 0.3);
  }
  private hat(t0: number, vol: number) {
    const s = this.ac.createBufferSource(), hp = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 7000; g.gain.value = vol;
    s.connect(hp).connect(g).connect(this.layer.hats); s.start(t0);
  }
  /** 排一个 16 分音符步上所有层的音。只给音量 > 0 的层建节点。 */
  private play(i: number, t0: number) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, tense = this.tension > 0.7;
    const [root, ch] = (tense ? TENSE : CALM)[bar], lv = layerLevels(this.tension), on = (k: Layer) => lv[k] > 0.001 || this.layer[k].gain.value > 0.0005;
    if (s === 0) for (const n of ch) for (const d of [-6, 6]) this.note(this.layer.pad, midi(n), t0, STEP * 16, 0.25, 'triangle', 0.6, d);
    if (on('arp') && s % 2 === 0) this.note(this.layer.arp, midi(ch[ARP[s]] + 12), t0, STEP * 1.6, 1, 'triangle');
    if (on('bass') && (s % 4 === 0 || s % 4 === 3)) this.note(this.layer.bass, midi(root - 12), t0, STEP * (s % 4 ? 0.8 : 1.8), 1, 'square', 0.005);
    if (on('hats') && s % 2 === 0) this.hat(t0, s % 4 === 2 ? 1 : 0.45);
    if (on('high') && HIGH[s] >= 0) this.note(this.layer.high, midi(ch[HIGH[s]] + 24), t0, STEP * 0.9, 1, 'square', 0.005);
  }
  /** 把 until 之前的步都排好（离线渲染也用它） */
  scheduleUntil(until: number) { while (this.next < until) { this.play(this.step++, this.next); this.next += STEP; } }
  start() {
    if (this.timer) return;
    this.next = this.ac.currentTime + 0.05;
    this.timer = setInterval(() => this.scheduleUntil(this.ac.currentTime + 0.15), 25);
    this.scheduleUntil(this.ac.currentTime + 0.15);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.out.gain.setTargetAtTime(0, this.ac.currentTime, 0.1); }
  resumeOut() { this.out.gain.setTargetAtTime(0.8, this.ac.currentTime, 0.1); }
}
