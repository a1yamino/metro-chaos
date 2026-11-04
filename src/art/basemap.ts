import type { LevelMap, Poly, Pt } from '../map/types';
import { isWater, pointInPolygon } from '../map/level1';
import { PALETTE as P } from './palette';
const W = 390, H = 844, G = 34, DAY = 180;

/** 底图：静态层（路网、屋顶、公园树冠、丘陵、海岸、码头、地名）缓存到离屏画布；
 *  波光、小船、浪花、昼夜色调、夜灯每帧按 t 画。全部低对比度，只做装饰。 */
let cache: { map: LevelMap; dpr: number; cv: HTMLCanvasElement; lamps: Pt[] } | null = null;

function path(c: CanvasRenderingContext2D, pts: Poly, close = true) {
  c.beginPath(); pts.forEach(({ x, y }, i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath();
}
function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
const centroid = (pl: Poly) => ({ x: pl.reduce((a, p) => a + p.x, 0) / pl.length, y: pl.reduce((a, p) => a + p.y, 0) / pl.length });
/** 折线上按弧长比例 u∈[0,1) 取点 */
function along(pts: Poly, u: number): Pt {
  const len: number[] = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { tot += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); len.push(tot); }
  const d = (((u % 1) + 1) % 1) * tot; let i = 0;
  while (i < len.length - 1 && len[i] < d) i++;
  const s0 = i ? len[i - 1] : 0, k = (d - s0) / (len[i] - s0 || 1), a = pts[i], b = pts[i + 1];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function buildStatic(map: LevelMap, dpr: number) {
  const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d')!; c.scale(dpr, dpr); c.lineJoin = c.lineCap = 'round';
  const lamps: Pt[] = [];
  c.fillStyle = P.street; c.fillRect(0, 0, W, H);
  const busy = (p: Pt) => isWater(p) || map.parks.some((pk) => pointInPolygon(p, pk)) || map.hills.some((h) => pointInPolygon(p, h));
  // 街区：大路每 4 格一条（更宽），其余是小巷；街区内切成 1~3 块屋顶，高度不同带落影
  for (let y = 0; y < H; y += G) for (let x = 0; x < W; x += G) {
    if (busy({ x: x + G / 2, y: y + G / 2 }) || hash(x, y) < 0.06) continue;
    const l = x + (x % (G * 4) ? 2 : 5), t = y + (y % (G * 4) ? 2 : 5), r = x + G - 2, b = y + G - 2;
    const split = hash(y, x) < 0.5, n = 1 + Math.floor(hash(x + 7, y) * 3);
    for (let i = 0; i < n; i++) {
      const lx = split ? l + ((r - l) * i) / n : l, ly = split ? t : t + ((b - t) * i) / n;
      const lw = split ? (r - l) / n - 1.5 : r - l, lh = split ? b - t : (b - t) / n - 1.5;
      const lv = Math.floor(hash(lx, ly) * 3), sh = 0.8 + lv * 0.9;
      c.fillStyle = P.roofShadow; c.fillRect(lx + sh, ly + sh, lw, lh);
      c.fillStyle = P.roofs[lv]; c.fillRect(lx, ly, lw, lh);
      if (hash(ly, lx) < 0.45) lamps.push({ x: lx + 3 + hash(lx, 1) * (lw - 6), y: ly + 3 + hash(ly, 2) * (lh - 6) });
    }
  }
  // 大路浅色路面 + 路灯
  c.fillStyle = P.road;
  for (let x = 0; x < W; x += G * 4) c.fillRect(x - 3, 0, 7, H);
  for (let y = 0; y < H; y += G * 4) c.fillRect(0, y - 3, W, 7);
  for (let x = 0; x < W; x += G * 4) for (let y = 17; y < H; y += G) if (!busy({ x, y })) lamps.push({ x, y });
  // 丘陵：由外到内逐层加深的等高线阴影（偏东南，像受西北光）
  for (const hl of map.hills) {
    const o = centroid(hl);
    [1, 0.78, 0.56, 0.34].forEach((k, i) => {
      const pts = hl.map(({ x, y }) => ({ x: o.x + (x - o.x) * k + i * 1.5, y: o.y + (y - o.y) * k + i * 1.5 }));
      c.fillStyle = i ? P.hillShade : P.hill; c.globalAlpha = i ? 0.55 : 1; path(c, pts); c.fill();
      c.globalAlpha = 1; c.strokeStyle = P.hillLine; c.lineWidth = 1; path(c, pts); c.stroke();
    });
  }
  // 公园：草地 + 带暗面的树冠
  for (const pk of map.parks) {
    c.fillStyle = P.park; path(c, pk); c.fill();
    c.save(); path(c, pk); c.clip();
    for (let x = 0; x < W; x += 12) for (let y = 0; y < H; y += 12) {
      if (!pointInPolygon({ x, y }, pk) || hash(x + 3, y) > 0.55) continue;
      const tx = x + hash(y, x) * 6, ty = y + hash(x, y + 1) * 6, rr = 3 + hash(x, y) * 2.5;
      c.fillStyle = P.treeDark; c.beginPath(); c.arc(tx + 1, ty + 1.2, rr, 0, 7); c.fill();
      c.fillStyle = P.tree; c.beginPath(); c.arc(tx, ty, rr, 0, 7); c.fill();
    }
    c.restore();
  }
  // 海与河
  c.fillStyle = P.water; path(c, map.sea); c.fill();
  c.strokeStyle = P.waterLine; c.lineWidth = 2; path(c, map.sea); c.stroke();
  path(c, map.river.center, false); c.strokeStyle = P.waterLine; c.lineWidth = map.river.width + 4; c.stroke();
  path(c, map.river.center, false); c.strokeStyle = P.water; c.lineWidth = map.river.width; c.stroke();
  // 码头：沿海岸伸进海里的几道栈桥
  c.fillStyle = P.pier;
  for (const px of [40, 120, 300, 350]) {
    let y = 700; while (y < 800 && !pointInPolygon({ x: px, y }, map.sea)) y++;
    c.fillRect(px - 3, y - 4, 6, 26); c.fillRect(px - 9, y + 18, 18, 5);
  }
  // 地名：淡色小字，放在角落空地
  c.fillStyle = P.label; c.font = '600 9px system-ui, sans-serif'; c.textAlign = 'center';
  for (const [s, x, y] of [['河 港 城', 70, 40], ['西 岸 公 园', 75, 488], ['东 山', 330, 680], ['南 港', 300, 800], ['北 门', 330, 120]] as const) c.fillText(s, x, y);
  return { cv, lamps };
}

export function drawBasemap(ctx: CanvasRenderingContext2D, map: LevelMap, t: number) {
  const dpr = ctx.getTransform().a || 1;
  if (!cache || cache.map !== map || cache.dpr !== dpr) cache = { map, dpr, ...buildStatic(map, dpr) };
  ctx.drawImage(cache.cv, 0, 0, W, H);
  ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
  // 河面波光：错开的短虚线缓慢流动，透明度轻微闪烁
  ctx.lineWidth = 1.6;
  for (const [off, k, col] of [[-0.22, 1, P.waterLine], [0.22, 1.3, P.waterLine], [0, 0.8, P.foam]] as const) {
    ctx.strokeStyle = col; ctx.globalAlpha = col === P.foam ? 0.35 + 0.25 * Math.sin(t * 1.7) : 1;
    ctx.setLineDash(col === P.foam ? [3, 41] : [10, 22]); ctx.lineDashOffset = -t * 14 * k;
    path(ctx, map.river.center.map(({ x, y }) => ({ x, y: y + off * map.river.width })), false); ctx.stroke();
  }
  // 海岸浪花：白色虚线沿岸线来回涌动
  ctx.setLineDash([6, 14]); ctx.lineDashOffset = Math.sin(t * 0.8) * 8; ctx.strokeStyle = P.foam;
  ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  path(ctx, map.sea.slice(0, 5).map(({ x, y }) => ({ x, y: y + 5 + Math.sin(t * 1.2 + x * 0.05) * 1.5 })), false); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // 小船：沿河中心线慢慢顺流漂下（约 70 秒一趟）
  for (const ph of [0, 0.5]) {
    const u = t / 70 + ph, p = along(map.river.center, u), q = along(map.river.center, u + 0.01);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
    ctx.fillStyle = P.boat; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(2, -2.5); ctx.lineTo(-5, -2.5); ctx.lineTo(-5, 2.5); ctx.lineTo(2, 2.5); ctx.fill();
    ctx.restore();
  }
  // 昼夜：180 秒一循环，t=0 白天；夜里整体淡淡发蓝，街区窗户/路灯亮起
  const night = 0.5 - 0.5 * Math.cos((t / DAY) * Math.PI * 2);
  ctx.globalAlpha = 0.16 * night; ctx.fillStyle = P.night; ctx.fillRect(0, 0, W, H);
  if (night > 0.45) {
    ctx.fillStyle = P.lamp;
    for (const [i, { x, y }] of cache.lamps.entries()) {
      const on = (night - 0.45) * 1.8 - hash(i, 9) * 0.4; if (on <= 0) continue;
      ctx.globalAlpha = Math.min(0.8, on); ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  ctx.restore();
}
