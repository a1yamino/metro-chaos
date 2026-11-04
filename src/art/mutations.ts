/**
 * B9 突变演出：只读 sim 状态（warning / eventTimer / events / stations），不写回。
 * 过场靠帧间差分：上一帧还有 warning、这一帧没了 → 该突变刚发生。
 */
import type { Game, GameEvent, Shape } from '../sim';
import { CONFIG } from '../config';
import { PALETTE as P } from './palette';

/** 渲染需要的只读视图（演示页可以直接传假对象） */
export type MutView = Pick<Game, 't' | 'warning' | 'eventTimer' | 'events' | 'stations'>;

export const PLAY = 1; // 过场时长（秒）
const N = 48, LIFE = 0.8;
const pool = new Float32Array(N * 6).fill(LIFE + 1); // [x, y, vx, vy, age, kind] 定长复用
let next = 0;
type Play = { ev: GameEvent; t0: number; fx: number; fy: number; cancel: boolean };
const CANCEL = 0.5; // 搬迁取消：目标残影消散时长
let plays: Play[] = [];
let prevWarn: GameEvent | null = null, last: MutView | null = null;

function spray(x: number, y: number, n: number, kind: number, v0: number) {
  for (let i = 0; i < n; i++) {
    const o = next * 6, a = (i / n) * Math.PI * 2 + Math.random() * 0.4, v = v0 * (0.6 + Math.random() * 0.6);
    pool[o] = x; pool[o + 1] = y; pool[o + 2] = Math.cos(a) * v; pool[o + 3] = Math.sin(a) * v;
    pool[o + 4] = 0; pool[o + 5] = kind; next = (next + 1) % N;
  }
}

/** 突变刚发生：登记过场。from 是站点搬迁前的位置。 */
export function startMutation(ev: GameEvent, t0: number, from?: { x: number; y: number }, cancel = false) {
  plays.push({ ev, t0, fx: from?.x ?? 0, fy: from?.y ?? 0, cancel });
  if (cancel) return;
  if (ev.type === 'FLOOD') spray(ev.x, ev.y, 18, 0, 120);
  else if (from) spray(from.x, from.y, 14, ev.type === 'RUSH' ? 2 : 1, 70);
}

/** 每帧调用一次：差分出刚发生的突变，推进粒子 */
export function updateMutationFx(g: MutView, dt: number) {
  if (g !== last) { plays = []; prevWarn = null; last = g; pool.fill(LIFE + 1); }
  if (prevWarn && g.warning !== prevWarn) {
    const w = prevWarn;
    const s = w.type === 'FLOOD' ? null : g.stations.find(o => o.id === w.stationId);
    // 站点刚被设了新目标，x/y 还在原地（sim 本帧只挪了一小步，误差可忽略）
    // 搬迁的 tx/ty 是承诺：站点目标没变成它 → sim 取消了这次搬迁
    const cancel = w.type === 'RELOCATE' && !!s && (s.tx !== w.tx || s.ty !== w.ty);
    startMutation(w.type === 'FLOOD' ? (g.events.find(e => e.type === 'FLOOD' && e.x === w.x && e.y === w.y) ?? w) : w, g.t, s ?? undefined, cancel);
  }
  prevWarn = g.warning;
  plays = plays.filter(p => g.t - p.t0 < PLAY);
  for (let o = 0; o < N * 6; o += 6) if (pool[o + 4] < LIFE) {
    pool[o] += pool[o + 2] * dt; pool[o + 1] += pool[o + 3] * dt;
    pool[o + 2] *= 1 - 2.5 * dt; pool[o + 3] *= 1 - 2.5 * dt; pool[o + 4] += dt;
  }
}

const easeOut = (u: number) => 1 - (1 - u) ** 3;
const circ = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); };

function shapePath(ctx: CanvasRenderingContext2D, x: number, y: number, sh: Shape, r: number) {
  ctx.beginPath();
  if (sh === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (sh === 'square') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r, y + r * 0.75); ctx.lineTo(x - r, y + r * 0.75); ctx.closePath(); }
}

/** 虚线箭头 a→b，箭头停在目标残影外。B10：底下垫一道预警黄宽边，上面压深色墨线虚线，浅底和夜色上都看得清 */
function arrow(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, alpha: number) {
  const L = Math.hypot(bx - ax, by - ay); if (L < 50) return;
  const ux = (bx - ax) / L, uy = (by - ay) / L, sx = ax + ux * 30, sy = ay + uy * 30, ex = bx - ux * 28, ey = by - uy * 28;
  const head = () => { ctx.beginPath(); ctx.moveTo(ex - ux * 10 - uy * 7, ey - uy * 10 + ux * 7); ctx.lineTo(ex, ey); ctx.lineTo(ex - ux * 10 + uy * 7, ey - uy * 10 - ux * 7); ctx.stroke(); };
  ctx.save(); ctx.lineCap = ctx.lineJoin = 'round'; ctx.globalAlpha = alpha;
  for (const [col, lw] of [[P.warning, 5.5], [P.ink, 3]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); head();
  }
  ctx.restore();
}

/** 倒计时环：剩余预警时间占满一圈的比例 */
function countdown(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, left: number, color: string) {
  const u = Math.max(0, Math.min(1, left / CONFIG.eventWarning));
  ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.15; circ(ctx, x, y, r); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u); ctx.stroke();
}

/** 画在线路下面：洪水水面（含涨水过场）和洪水预警 */
export function drawMutationsUnder(ctx: CanvasRenderingContext2D, g: MutView) {
  for (const e of g.events) if (e.type === 'FLOOD') {
    const p = plays.find(q => q.ev === e), u = p ? easeOut((g.t - p.t0) / PLAY) : 1;
    const r = e.r * u;
    ctx.globalAlpha = 0.3; ctx.fillStyle = P.flood; circ(ctx, e.x, e.y, r); ctx.fill();
    ctx.globalAlpha = 0.18; ctx.fillStyle = P.floodDeep; circ(ctx, e.x, e.y, r * 0.55); ctx.fill();
    // 水面波纹：一圈圈往外走
    ctx.strokeStyle = P.foam; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { const f = (g.t * 0.35 + k / 3) % 1; ctx.globalAlpha = 0.35 * (1 - f); circ(ctx, e.x, e.y, r * (0.3 + 0.65 * f)); ctx.stroke(); }
    if (p) { ctx.globalAlpha = 0.9 * (1 - u); ctx.lineWidth = 6; circ(ctx, e.x, e.y, r); ctx.stroke(); } // 涨水的浪头
    ctx.globalAlpha = 0.7; ctx.strokeStyle = P.floodDeep; ctx.lineWidth = 2; circ(ctx, e.x, e.y, r); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const w = g.warning;
  if (w?.type === 'FLOOD') {
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 10);
    ctx.globalAlpha = 0.2 + 0.15 * pulse; ctx.fillStyle = P.flood; circ(ctx, w.x, w.y, w.r); ctx.fill();
    ctx.strokeStyle = P.floodDeep; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) { const f = (g.t * 0.8 + k / 2) % 1; ctx.globalAlpha = 0.6 * (1 - f); circ(ctx, w.x, w.y, w.r * f); ctx.stroke(); }
    ctx.globalAlpha = 0.7 + 0.3 * pulse; ctx.strokeStyle = P.warning; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -g.t * 30; circ(ctx, w.x, w.y, w.r); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    ctx.globalAlpha = 1;
  }
}

/** 画在站点下面：站点预警（倒计时环）、暴增冲击波、搬迁残影 */
export function drawMutationsOver(ctx: CanvasRenderingContext2D, g: MutView) {
  const w = g.warning;
  if (w && w.type !== 'FLOOD') {
    const s = g.stations.find(o => o.id === w.stationId);
    if (s) {
      const c = w.type === 'RUSH' ? P.rush : P.warning, pulse = 0.5 + 0.5 * Math.sin(g.t * 12);
      ctx.globalAlpha = 0.25 * pulse; ctx.fillStyle = c; circ(ctx, s.x, s.y, 30); ctx.fill(); ctx.globalAlpha = 1;
      countdown(ctx, s.x, s.y, 27, g.eventTimer, c);
      if (w.type === 'RELOCATE') { // 新位置的虚线残影 + 倒计时环，站点到目标拖一条淡虚线箭头
        arrow(ctx, s.x, s.y, w.tx, w.ty, 0.9);
        ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.fillStyle = P.white; ctx.strokeStyle = P.warning; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
        shapePath(ctx, w.tx, w.ty, s.shape, CONFIG.stationRadius); ctx.globalAlpha *= 0.5; ctx.fill(); ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        countdown(ctx, w.tx, w.ty, 22, g.eventTimer, P.warning);
      }
    }
  }
  for (const p of plays) {
    const u = (g.t - p.t0) / PLAY;
    if (p.ev.type === 'RELOCATE' && p.cancel) {
      const s = g.stations.find(o => o.id === (p.ev as { stationId: number }).stationId), v = (g.t - p.t0) / CANCEL;
      if (!s || v >= 1) continue;
      const { tx, ty } = p.ev, k = CONFIG.stationRadius * (1 + 0.4 * v);
      ctx.globalAlpha = 1 - v; ctx.strokeStyle = P.warning; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      shapePath(ctx, tx, ty, s.shape, k); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = P.danger; ctx.lineWidth = 3; const d = 7;
      ctx.beginPath(); ctx.moveTo(tx - d, ty - d); ctx.lineTo(tx + d, ty + d); ctx.moveTo(tx + d, ty - d); ctx.lineTo(tx - d, ty + d); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.ev.type === 'RELOCATE') {
      const id = p.ev.stationId, s = g.stations.find(o => o.id === id);
      if (!s) continue;
      // 原地残影淡出，新位置虚线框收拢，中间拖一条虚线轨迹
      ctx.globalAlpha = 0.8 * (1 - u * 0.7); shapePath(ctx, p.fx, p.fy, s.shape, CONFIG.stationRadius);
      ctx.fillStyle = P.white; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 0.8 * (1 - u); ctx.strokeStyle = P.warning; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(p.fx, p.fy); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.globalAlpha = 1 - u * 0.6; shapePath(ctx, p.ev.tx, p.ev.ty, s.shape, CONFIG.stationRadius + 14 * (1 - easeOut(u))); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    } else if (p.ev.type === 'RUSH') {
      const id = p.ev.stationId, s = g.stations.find(o => o.id === id);
      if (!s) continue;
      ctx.strokeStyle = P.rush; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const f = u - k * 0.2; if (f <= 0 || f >= 1) continue; ctx.globalAlpha = 1 - f; circ(ctx, s.x, s.y, 18 + easeOut(f) * 60); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  const COL = [P.foam, P.hillLine, P.rush];
  for (let o = 0; o < N * 6; o += 6) if (pool[o + 4] < LIFE) {
    ctx.globalAlpha = 1 - pool[o + 4] / LIFE; ctx.fillStyle = COL[pool[o + 5]];
    circ(ctx, pool[o], pool[o + 1], pool[o + 5] === 0 ? 3 : 2.5); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
