/** B7 站点动画：只读 sim 状态，用帧间差分推导事件（新站、送达），不改 sim。 */
import type { Game } from '../sim';
import { CONFIG } from '../config';
import { PALETTE as P } from './palette';

const POP = 0.4, N = 96, PLIFE = 0.6;
const born = new Map<number, number>(); // 站点 id → 首次看到的时刻
const cargoPrev = new Map<number, number>(); // 线路 id → 上帧车上人数
let deliveredPrev = 0, last: Game | null = null;
// 粒子池：定长 Float32Array 复用，[x, y, vx, vy, age, color]
const pool = new Float32Array(N * 6).fill(PLIFE + 1);
let next = 0;
const COLORS = [...P.lines, P.warning];

/** 在 (x,y) 冒一簇粒子 */
export function burst(x: number, y: number, n = 10) {
  for (let i = 0; i < n; i++) {
    const o = next * 6, a = (i / n) * Math.PI * 2 + Math.random() * 0.5, v = 50 + Math.random() * 50;
    pool[o] = x; pool[o + 1] = y; pool[o + 2] = Math.cos(a) * v; pool[o + 3] = Math.sin(a) * v - 30;
    pool[o + 4] = 0; pool[o + 5] = (next + i) % COLORS.length; next = (next + 1) % N;
  }
}

/** 每帧调用一次：差分出新站和送达 */
export function updateStationFx(g: Game, dt: number) {
  if (g !== last) { born.clear(); cargoPrev.clear(); deliveredPrev = g.delivered; last = g; }
  for (const s of g.stations) if (!born.has(s.id)) born.set(s.id, g.t);
  const gained = g.delivered - deliveredPrev;
  for (const l of g.lines) {
    const now = l.train.cargo.length, was = cargoPrev.get(l.id) ?? now;
    if (gained > 0 && now < was) {
      const t = l.train, id = l.stops[t.f < 0.5 ? t.seg : Math.min(t.seg + 1, l.stops.length - 1)];
      const s = g.stations.find((o) => o.id === id);
      if (s) burst(s.x, s.y, 8 + Math.min(8, was - now) * 2);
    }
    cargoPrev.set(l.id, now);
  }
  deliveredPrev = g.delivered;
  for (let o = 0; o < N * 6; o += 6) if (pool[o + 4] < PLIFE) {
    pool[o] += pool[o + 2] * dt; pool[o + 1] += pool[o + 3] * dt; pool[o + 3] += 140 * dt; pool[o + 4] += dt;
  }
}

/** 站点当前的位移和缩放：弹出 + 拥挤抖动 */
export function stationPose(s: { id: number; queue: unknown[] }, t: number) {
  const age = t - (born.get(s.id) ?? -9), u = Math.min(1, age / POP);
  const k = u >= 1 ? 1 : Math.max(0, 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2); // easeOutBack，夹到 ≥0 防 arc 负半径
  const crowd = Math.max(0, s.queue.length / CONFIG.crowdLimit - 0.6); // 0.6 起抖，越挤越大
  const amp = Math.min(3, crowd * 4);
  return { dx: amp * Math.sin(t * 37 + s.id), dy: amp * Math.sin(t * 29 + s.id * 2), k, ring: age < POP * 1.5 ? age / (POP * 1.5) : -1 };
}

/** 弹出时的扩散环（画在站点下面） */
export function drawPopRing(ctx: CanvasRenderingContext2D, x: number, y: number, ring: number) {
  if (ring < 0) return;
  ctx.globalAlpha = 0.5 * (1 - ring); ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, CONFIG.stationRadius + ring * 22, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
}

/** 送达粒子（画在站点上面） */
export function drawParticles(ctx: CanvasRenderingContext2D) {
  for (let o = 0; o < N * 6; o += 6) {
    const a = pool[o + 4]; if (a >= PLIFE) continue;
    ctx.globalAlpha = 1 - a / PLIFE; ctx.fillStyle = COLORS[pool[o + 5]];
    ctx.fillRect(pool[o] - 2, pool[o + 1] - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}
