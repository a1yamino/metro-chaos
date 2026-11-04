import { PALETTE as P } from './palette';
import { isWater } from '../map/level1';

type Pt = { readonly x: number; readonly y: number };
export type CrossingKind = 'bridge' | 'tunnel';

/** 线段上落在水里的区间（0..1），按 3px 采样。 */
function waterSpans(a: Pt, b: Pt): [number, number][] {
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3)), out: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= n; i++) {
    const f = i / n, w = isWater({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    if (w && s < 0) s = f;
    if (!w && s >= 0) { out.push([s, f]); s = -1; }
  }
  if (s >= 0) out.push([s, 1]);
  return out;
}

/** 在已画好的线段上叠加桥或隧道造型；只改过水那一段。 */
export function drawCrossing(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, kind: CrossingKind, color: string) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const at = (f: number, o = 0) => ({ x: a.x + dx * f + nx * o, y: a.y + dy * f + ny * o });
  const seg = (p: Pt, q: Pt) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
  ctx.save(); ctx.lineCap = 'butt';
  for (const [f0, f1] of waterSpans(a, b)) {
    const pad = 6 / L, s0 = Math.max(0, f0 - pad), s1 = Math.min(1, f1 + pad);
    if (kind === 'bridge') {
      ctx.globalAlpha = 0.22; ctx.strokeStyle = P.ink; ctx.lineWidth = 17; seg(at(s0, 3), at(s1, 3)); // 投影
      ctx.globalAlpha = 1; ctx.strokeStyle = P.white; ctx.lineWidth = 15; seg(at(s0), at(s1));        // 桥面
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; seg(at(s0, 7.5), at(s1, 7.5)); seg(at(s0, -7.5), at(s1, -7.5)); // 护栏
      ctx.strokeStyle = color; ctx.lineWidth = 7; seg(at(s0), at(s1));
    } else {
      ctx.strokeStyle = P.water; ctx.lineWidth = 9; seg(at(f0), at(f1));                              // 线沉到水下
      ctx.globalAlpha = 0.55; ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.setLineDash([5, 5]); seg(at(f0), at(f1));
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round';                               // 洞口
      for (const [f, dir] of [[f0, -1], [f1, 1]] as const) {
        const c = at(f), r = 7.5, ang = Math.atan2(dy, dx) + (dir < 0 ? Math.PI : 0);
        ctx.beginPath(); ctx.arc(c.x, c.y, r, ang - Math.PI / 2, ang + Math.PI / 2); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }
  ctx.restore();
}
