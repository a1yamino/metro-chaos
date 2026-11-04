import { describe, expect, it } from 'vitest';
import { pointAt, route, routeLength } from '../src/route';
import { segmentCrossesWater } from '../src/map/level1';
import { connect, createGame, type Game, type Station } from '../src/sim';

const deg = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const PAIRS: [number, number, number, number][] = [];
for (let i = 0; i < 60; i++) PAIRS.push([40 + ((i * 53) % 310), 130 + ((i * 97) % 650), 40 + ((i * 71) % 310), 130 + ((i * 131) % 650)]);

describe('A3 地铁图走线', () => {
  it('每条直线腿的角度都是 45° 的整数倍，腿首尾相接', () => {
    for (const [ax, ay, bx, by] of PAIRS) {
      const r = route({ x: ax, y: ay }, { x: bx, y: by });
      expect(r.legs.length).toBeGreaterThanOrEqual(1);
      expect(r.legs.length).toBeLessThanOrEqual(2);
      for (const l of r.legs) {
        const d = deg(l.a, l.b);
        expect(Math.abs(d / 45 - Math.round(d / 45)), `角度 ${d}`).toBeLessThan(1e-9);
      }
      if (r.legs.length === 2) expect(r.legs[0].b).toEqual(r.legs[1].a);
    }
  });
  it('路线首尾就是两站', () => {
    for (const [ax, ay, bx, by] of PAIRS) {
      const r = route({ x: ax, y: ay }, { x: bx, y: by });
      expect(r.pts[0]).toEqual({ x: ax, y: ay });
      expect(r.pts[r.pts.length - 1]).toEqual({ x: bx, y: by });
      expect(r.legs[0].a).toEqual({ x: ax, y: ay });
      expect(r.legs[r.legs.length - 1].b).toEqual({ x: bx, y: by });
      expect(pointAt(r, 0)).toMatchObject({ x: ax, y: ay });
      expect(pointAt(r, 1).x).toBeCloseTo(bx); expect(pointAt(r, 1).y).toBeCloseTo(by);
    }
  });
  it('有拐角时用圆弧：弧上采样点到圆心距离 = 半径，且路线比直角折线短', () => {
    const a = { x: 50, y: 200 }, b = { x: 300, y: 300 };
    const r = route(a, b);
    expect(r.legs).toHaveLength(2);
    expect(r.arc).not.toBeNull();
    const { cx, cy, r: rad } = r.arc!;
    expect(rad).toBeGreaterThan(0);
    const onArc = r.pts.slice(1, -1).filter(p => Math.abs(Math.hypot(p.x - cx, p.y - cy) - rad) < 1e-6);
    expect(onArc.length).toBeGreaterThanOrEqual(3);
    const sharp = r.legs.reduce((s, l) => s + Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y), 0);
    expect(routeLength(r)).toBeLessThan(sharp);
  });
  it('纯水平、竖直、45° 的两站只有一条腿、没有圆弧', () => {
    for (const b of [{ x: 300, y: 200 }, { x: 50, y: 600 }, { x: 250, y: 400 }]) {
      const r = route({ x: 50, y: 200 }, b);
      expect(r.legs).toHaveLength(1); expect(r.arc).toBeNull();
    }
  });
  it('过河判定按折线腿：直线会穿河、但地铁图走线不穿河时，不消耗隧道', () => {
    const A = { x: 40, y: 520 }, B = { x: 150, y: 140 };
    expect(segmentCrossesWater(A, B)).toBe(true); // 前提：直连会过河
    expect(route(A, B).legs.some(l => segmentCrossesWater(l.a, l.b))).toBe(false);
    const g: Game = createGame(1); g.stations = []; g.events = []; g.maxLines = 10;
    const mk = (p: { x: number; y: number }): Station => { const s: Station = { id: g.nextId++, ...p, tx: p.x, ty: p.y, shape: 'circle', queue: [], crowdTime: 0, rush: false }; g.stations.push(s); return s; };
    const before = [g.tunnels, g.bridges];
    expect(connect(g, mk(A), mk(B))).toBe('ok');
    expect([g.tunnels, g.bridges]).toEqual(before);
    expect(connect(g, mk({ x: 60, y: 300 }), mk({ x: 340, y: 300 }))).toBe('ok'); // 横跨河道仍消耗隧道
    expect(g.tunnels).toBe(before[0] - 1);
  });
});
