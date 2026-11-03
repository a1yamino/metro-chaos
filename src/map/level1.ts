/** 第一关「河港城」地形数据。坐标为棋盘空间（390×844，原点左上）。纯数据 + 纯函数。 */
import { CONFIG } from '../config';

import type { LevelMap, Poly, Pt } from './types';
export type { LevelMap, Pt } from './types';

export const LEVEL1: LevelMap = {
  /** 河道中心线（折线），从顶部蜿蜒流入南边的海。 */
  river: {
    center: [{ x: 230, y: 0 }, { x: 215, y: 110 }, { x: 150, y: 200 }, { x: 140, y: 300 }, { x: 220, y: 400 }, { x: 250, y: 500 }, { x: 190, y: 600 }, { x: 180, y: 740 }],
    width: CONFIG.riverWidth,
  },
  /** 海：底部海岸线以外。 */
  sea: [{ x: 0, y: 760 }, { x: 90, y: 740 }, { x: 180, y: 730 }, { x: 280, y: 750 }, { x: 390, y: 735 }, { x: 390, y: 844 }, { x: 0, y: 844 }],
  /** 两块公园：西岸、东岸各一。 */
  parks: [
    [{ x: 30, y: 380 }, { x: 110, y: 370 }, { x: 120, y: 450 }, { x: 40, y: 470 }],
    [{ x: 290, y: 200 }, { x: 360, y: 190 }, { x: 370, y: 270 }, { x: 300, y: 285 }],
  ],
  /** 一块丘陵：东岸南部。 */
  hills: [[{ x: 290, y: 560 }, { x: 350, y: 540 }, { x: 375, y: 610 }, { x: 330, y: 660 }, { x: 280, y: 630 }]],
};

function distToSeg({ x: px, y: py }: Pt, { x: ax, y: ay }: Pt, { x: bx, y: by }: Pt): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function pointInPolygon({ x: px, y: py }: Pt, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const { x: ax, y: ay } = poly[i], { x: bx, y: by } = poly[j];
    if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** 点到河道中心线的距离。 */
export function distToRiver(p: Pt): number {
  const c = LEVEL1.river.center;
  let d = Infinity;
  for (let i = 1; i < c.length; i++) d = Math.min(d, distToSeg(p, c[i - 1], c[i]));
  return d;
}

/** 点是否在河或海里。 */
export function isWater(p: Pt): boolean {
  return distToRiver(p) <= LEVEL1.river.width / 2 || pointInPolygon(p, LEVEL1.sea);
}

/** 线段是否经过水面（按 4px 步长采样）。 */
export function segmentCrossesWater({ x: ax, y: ay }: Pt, { x: bx, y: by }: Pt): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
  for (let i = 0; i <= n; i++) if (isWater({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n })) return true;
  return false;
}
