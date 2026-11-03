/** 占位音效（WebAudio 合成），artisan 会替换实现；函数名保持不变。 */
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  return ctx;
}
function beep(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
export const unlockAudio = () => { void ac()?.resume(); };
export const playDeliver = () => beep(880, 0.08, 'triangle');
export const playWarning = () => beep(330, 0.25, 'square', 0.05);
export const playClear = () => { beep(523, 0.15); setTimeout(() => beep(784, 0.3), 150); };
