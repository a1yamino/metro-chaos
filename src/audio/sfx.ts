/** WebAudio 实时合成音效，无音频文件。首次用户交互后调用 unlockAudio()。 */
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  return ctx;
}
interface ToneOpts { type?: OscillatorType; vol?: number; to?: number }
function tone(freq: number, delay: number, dur: number, { type = 'square', vol = 0.15, to }: ToneOpts = {}) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export const unlockAudio = () => { void ac()?.resume(); };
/** 共用同一个 AudioContext（背景音乐用） */
export const audioContext = ac;
/** 送达：短促上行双音，频繁触发也不吵 */
export function playDeliver() {
  tone(880, 0, 0.06, { type: 'triangle', vol: 0.12 });
  tone(1320, 0.05, 0.08, { type: 'triangle', vol: 0.1 });
}
/** 预警：两声下行警报 */
export function playWarning() {
  for (let i = 0; i < 2; i++) tone(740, i * 0.28, 0.22, { vol: 0.12, to: 494 });
}
/** 升级到手：C 大调琶音 */
export function playUpgrade() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, i === 3 ? 0.6 : 0.14, { vol: 0.13 }));
  tone(261.63, 0.33, 0.6, { type: 'triangle', vol: 0.1 });
}
/** 结束：下行三音 */
export function playGameOver() {
  [392, 311.13, 233.08].forEach((f, i) => tone(f, i * 0.22, i === 2 ? 0.7 : 0.2, { type: 'triangle', vol: 0.14 }));
}
/** 兼容旧调用；无尽模式下请改用 playUpgrade */
export const playClear = playUpgrade;
/** 架桥：两声木槌敲击 */
export function playBridge() {
  tone(330, 0, 0.07, { type: 'triangle', vol: 0.2, to: 300 });
  tone(440, 0.09, 0.09, { type: 'triangle', vol: 0.18, to: 400 });
}
/** 挖隧道：低沉下滑的隆隆声 */
export function playTunnel() {
  tone(180, 0, 0.32, { type: 'sawtooth', vol: 0.07, to: 60 });
  tone(90, 0.02, 0.3, { type: 'triangle', vol: 0.12, to: 45 });
}
