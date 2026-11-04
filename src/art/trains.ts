/** B8 胶囊车厢：纯渲染，只读列车状态。 */
import { PALETTE as P } from './palette';

export type CarShape = 'circle' | 'triangle' | 'square';
const CAR_L = 26, CAR_H = 15, GAP = 3, PER_CAR = 6; // PER_CAR 与 CONFIG.carriageCapacity 一致

const shown = new Map<number, number>();
/** 平滑转向：车厢前后对称，按 π 取最短转角，按 dt 指数逼近。 */
export function smoothAngle(key: number, target: number, dt: number): number {
  const cur = shown.get(key);
  if (cur === undefined || dt <= 0) { shown.set(key, target); return target; }
  let d = (target - cur) % Math.PI;
  if (d > Math.PI / 2) d -= Math.PI; else if (d < -Math.PI / 2) d += Math.PI;
  const a = cur + d * (1 - Math.exp(-dt * 14));
  shown.set(key, a); return a;
}
export function resetTrainFx() { shown.clear(); }

function capsule(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number) {
  const r = h / 2; ctx.beginPath();
  ctx.moveTo(x - l / 2 + r, y - r); ctx.lineTo(x + l / 2 - r, y - r); ctx.arc(x + l / 2 - r, y, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x - l / 2 + r, y + r); ctx.arc(x - l / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
}
function mini(ctx: CanvasRenderingContext2D, x: number, y: number, s: CarShape, r: number) {
  ctx.beginPath();
  if (s === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (s === 'square') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r, y + r * 0.75); ctx.lineTo(x - r, y + r * 0.75); ctx.closePath(); }
  ctx.fill();
}

/** 在 (x,y) 画一列 cars 节胶囊车厢，沿 angle 方向；乘客按顺序装进各节。 */
export function drawTrain(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, cars: number, cargo: readonly CarShape[]) {
  const total = cars * CAR_L + (cars - 1) * GAP;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  // 阴影：固定朝右下，先反旋转偏移
  const ox = 1.5 * Math.cos(-angle) - 2.5 * Math.sin(-angle), oy = 1.5 * Math.sin(-angle) + 2.5 * Math.cos(-angle);
  ctx.fillStyle = 'rgba(20,24,40,0.22)';
  for (let c = 0; c < cars; c++) { capsule(ctx, -total / 2 + CAR_L / 2 + c * (CAR_L + GAP) + ox, oy, CAR_L, CAR_H); ctx.fill(); }
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  for (let c = 0; c < cars - 1; c++) { const gx = -total / 2 + (c + 1) * (CAR_L + GAP) - GAP; ctx.beginPath(); ctx.moveTo(gx - 1, 0); ctx.lineTo(gx + GAP + 1, 0); ctx.stroke(); }
  for (let c = 0; c < cars; c++) {
    const cx = -total / 2 + CAR_L / 2 + c * (CAR_L + GAP);
    ctx.fillStyle = color; capsule(ctx, cx, 0, CAR_L, CAR_H); ctx.fill();
    ctx.strokeStyle = P.white; ctx.lineWidth = 1.5; ctx.stroke(); // 白边：和同色线路分开
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; capsule(ctx, cx, 0, CAR_L - 6, CAR_H - 6); ctx.fill(); // 车窗带
    ctx.fillStyle = P.white;
    for (let k = 0; k < PER_CAR; k++) {
      const s = cargo[c * PER_CAR + k]; if (!s) break;
      mini(ctx, cx - 7 + (k % 3) * 7, -2.6 + Math.floor(k / 3) * 5.2, s, 2.1);
    }
  }
  ctx.restore();
}
