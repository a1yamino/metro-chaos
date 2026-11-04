/**
 * 地铁图风格走线（ROADMAP A3）：两站之间 = 一段水平/竖直直线 + 一段 45° 斜线，拐角用圆弧过渡。
 * 纯函数，sim（过河判定、洪水判定、列车行驶）和渲染共用同一份几何。
 */
import { CONFIG } from './config';

export type P = { x: number; y: number };
export interface Leg { a: P; b: P }
export interface Route {
  /** 直线腿（1 或 2 段），每段角度都是 45° 的整数倍；过河判定按腿做。 */
  legs: Leg[];
  /** 拐角圆弧（没有拐角时为 null）：圆心、半径、起止角。 */
  arc: { cx: number; cy: number; r: number; start: number; end: number; ccw: boolean } | null;
  /** 实际行驶/绘制的折线（直线 + 圆弧采样点），首尾即两站。 */
  pts: P[];
  /** pts 的累计长度，cum[cum.length-1] 为总长。 */
  cum: number[];
}

const ARC_STEPS = 6;

export function route(a: P, b: P, radius: number = CONFIG.routeCornerRadius): Route {
  const dx = b.x - a.x, dy = b.y - a.y, ax = Math.abs(dx), ay = Math.abs(dy);
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const diag = Math.min(ax, ay);
  // 先走直线腿（沿主轴），再走 45° 斜线腿
  const c = ax >= ay ? { x: a.x + sx * (ax - diag), y: a.y } : { x: a.x, y: a.y + sy * (ay - diag) };
  const l1 = Math.hypot(c.x - a.x, c.y - a.y), l2 = Math.hypot(b.x - c.x, b.y - c.y);
  if (l1 < 1e-6 || l2 < 1e-6) return finish([{ a, b }], null, [a, b]);
  const u1 = { x: (c.x - a.x) / l1, y: (c.y - a.y) / l1 }, u2 = { x: (b.x - c.x) / l2, y: (b.y - c.y) / l2 };
  const turn = Math.PI / 4, tanHalf = Math.tan(turn / 2);
  const r = Math.min(radius, (Math.min(l1, l2) * 0.5) / tanHalf);
  const d = r * tanHalf;
  const p1 = { x: c.x - u1.x * d, y: c.y - u1.y * d }, p2 = { x: c.x + u2.x * d, y: c.y + u2.y * d };
  const cross = u1.x * u2.y - u1.y * u2.x; // >0 向右转（画布 y 向下）
  const n = cross > 0 ? { x: -u1.y, y: u1.x } : { x: u1.y, y: -u1.x };
  const cx = p1.x + n.x * r, cy = p1.y + n.y * r;
  const start = Math.atan2(p1.y - cy, p1.x - cx), end = Math.atan2(p2.y - cy, p2.x - cx);
  let sweep = end - start;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const pts: P[] = [a, p1];
  for (let i = 1; i < ARC_STEPS; i++) {
    const t = start + (sweep * i) / ARC_STEPS;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  pts.push(p2, b);
  return finish([{ a, b: c }, { a: c, b }], { cx, cy, r, start, end, ccw: sweep < 0 }, pts);
}

function finish(legs: Leg[], arc: Route['arc'], pts: P[]): Route {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { legs, arc, pts, cum };
}

export const routeLength = (r: Route) => r.cum[r.cum.length - 1];

/** 沿路线比例 f∈[0,1] 处的位置和朝向（弧度）。 */
export function pointAt(r: Route, f: number): { x: number; y: number; angle: number } {
  const L = routeLength(r), s = Math.max(0, Math.min(1, f)) * L;
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < s) i++;
  const p = r.pts[i - 1], q = r.pts[i], seg = r.cum[i] - r.cum[i - 1] || 1, k = (s - r.cum[i - 1]) / seg;
  return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, angle: Math.atan2(q.y - p.y, q.x - p.x) };
}
