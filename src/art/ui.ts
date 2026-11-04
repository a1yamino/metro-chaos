import { PALETTE as P } from './palette';

/** 顶栏小图标：14px 方框内的纯矢量线条图，颜色由调用方给。只画，不读 sim。 */
export type Icon = 'rider' | 'clock' | 'bridge' | 'tunnel' | 'lines' | 'warn' | 'trophy';
export function drawIcon(c: CanvasRenderingContext2D, kind: Icon, x: number, y: number, col: string) {
  c.save(); c.translate(x, y); c.strokeStyle = c.fillStyle = col; c.lineWidth = 1.8; c.lineCap = c.lineJoin = 'round';
  c.beginPath();
  if (kind === 'rider') { c.arc(7, 4, 3, 0, 7); c.fill(); c.beginPath(); c.arc(7, 14, 6, Math.PI, 0); c.fill(); }
  else if (kind === 'clock') { c.arc(7, 7, 6, 0, 7); c.moveTo(7, 3.5); c.lineTo(7, 7); c.lineTo(9.5, 8.5); c.stroke(); }
  else if (kind === 'bridge') { c.moveTo(0, 6); c.lineTo(14, 6); c.moveTo(1, 13); c.quadraticCurveTo(7, 3, 13, 13); c.moveTo(4, 6); c.lineTo(4, 9); c.moveTo(10, 6); c.lineTo(10, 9); c.stroke(); }
  else if (kind === 'tunnel') { c.moveTo(1, 13); c.lineTo(1, 7); c.arc(7, 7, 6, Math.PI, 0); c.lineTo(13, 13); c.moveTo(4.5, 13); c.lineTo(4.5, 8); c.arc(7, 8, 2.5, Math.PI, 0); c.lineTo(9.5, 13); c.stroke(); }
  else if (kind === 'lines') { P.lines.slice(0, 3).forEach((lc, i) => { c.strokeStyle = lc; c.lineWidth = 2.6; c.beginPath(); c.moveTo(1, 3 + i * 4); c.lineTo(13, 3 + i * 4); c.stroke(); }); }
  else if (kind === 'warn') { c.moveTo(7, 1); c.lineTo(13.5, 13); c.lineTo(0.5, 13); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(7, 5.5); c.lineTo(7, 9); c.stroke(); c.beginPath(); c.arc(7, 11, 0.6, 0, 7); c.stroke(); }
  else { c.moveTo(3, 1); c.lineTo(11, 1); c.lineTo(10, 7); c.quadraticCurveTo(7, 10, 4, 7); c.closePath(); c.fill(); c.fillRect(6, 9, 2, 3); c.fillRect(4, 12, 6, 1.8); }
  c.restore();
}

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/** 升级卡入场：每张卡错开 0.08s，0.35s 内由下方 36px 滑入并淡入（ease-out cubic）。返回 [位移, 透明度]。 */
export function cardEnter(age: number, i: number): [number, number] {
  const k = Math.max(0, Math.min(1, (age - i * 0.08) / 0.35)), e = 1 - (1 - k) ** 3;
  return [(1 - e) * 36, e];
}
