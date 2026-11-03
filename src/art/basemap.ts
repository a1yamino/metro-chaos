import type { LevelMap, Poly, Pt } from '../map/types';
import { PALETTE as P } from './palette';

/** 底图：静态层（街区、公园、丘陵、海岸、河）缓存到离屏画布；河水波纹每帧按 t 重画。 */
let cache: { map: LevelMap; dpr: number; cv: HTMLCanvasElement } | null = null;

function poly(c: CanvasRenderingContext2D, pts: Poly) {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
}
/** 过中点的二次曲线，把折线中心线画成平滑河道 */
function smooth(c: CanvasRenderingContext2D, pts: Poly) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    c.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const l = pts[pts.length - 1]; c.lineTo(l[0], l[1]);
}
function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

function buildStatic(map: LevelMap, dpr: number) {
  const { w, h } = map.size, cv = document.createElement('canvas');
  cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d')!; c.scale(dpr, dpr);
  c.fillStyle = P.street; c.fillRect(0, 0, w, h);
  // 街区：错位网格，块大小有轻微随机
  const G = 26;
  for (let y = 0; y < h; y += G) for (let x = (y / G) % 2 ? -G / 2 : 0; x < w; x += G) {
    if (hash(x, y) < 0.08) continue; // 偶尔留空地
    const pad = 3 + hash(y, x) * 2;
    c.fillStyle = P.block; c.beginPath(); c.roundRect(x + pad, y + pad, G - pad * 2, G - pad * 2, 3); c.fill();
  }
  c.lineJoin = c.lineCap = 'round';
  for (const hl of map.hills) {
    c.fillStyle = P.hill; poly(c, hl); c.fill();
    // 等高线：向中心收缩三圈
    const cx = hl.reduce((a, p) => a + p[0], 0) / hl.length, cy = hl.reduce((a, p) => a + p[1], 0) / hl.length;
    c.strokeStyle = P.hillLine; c.lineWidth = 1.2;
    for (const k of [1, 0.7, 0.42]) { poly(c, hl.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as Pt)); c.stroke(); }
  }
  for (const pk of map.parks) {
    c.fillStyle = P.park; poly(c, pk); c.fill();
    c.save(); poly(c, pk); c.clip(); c.fillStyle = P.parkDot;
    for (let x = 0; x < w; x += 11) for (let y = 0; y < h; y += 11) if (hash(x + 3, y) < 0.35) { c.beginPath(); c.arc(x + hash(y, x) * 6, y, 2.6, 0, 7); c.fill(); }
    c.restore();
  }
  c.fillStyle = P.water; poly(c, map.sea); c.fill();
  c.strokeStyle = P.waterLine; c.lineWidth = 2; poly(c, map.sea); c.stroke();
  // 河：先画宽一点的岸线，再画水面
  smooth(c, map.river.path); c.strokeStyle = P.waterLine; c.lineWidth = map.river.width + 4; c.stroke();
  smooth(c, map.river.path); c.strokeStyle = P.water; c.lineWidth = map.river.width; c.stroke();
  return cv;
}

export function drawBasemap(ctx: CanvasRenderingContext2D, map: LevelMap, t: number) {
  const dpr = ctx.getTransform().a || 1;
  if (!cache || cache.map !== map || cache.dpr !== dpr) cache = { map, dpr, cv: buildStatic(map, dpr) };
  ctx.drawImage(cache.cv, 0, 0, map.size.w, map.size.h);
  // 波纹：沿河中心线的虚线缓慢流动，两条错开
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = P.waterLine; ctx.lineWidth = 1.6;
  for (const [off, k] of [[-0.22, 1], [0.22, 1.3]] as const) {
    ctx.setLineDash([10, 22]); ctx.lineDashOffset = -t * 14 * k;
    smooth(ctx, map.river.path.map(([x, y]) => [x, y + off * map.river.width] as Pt)); ctx.stroke();
  }
  ctx.restore();
}
