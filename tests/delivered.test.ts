import { describe, expect, it } from 'vitest';
import { connect, createGame, drainDeliveries, step, type Game } from '../src/sim';

const quiet = (g: Game) => { g.eventTimer = 1e9; g.stationTimer = 1e9; };
const runCollect = (g: Game, seconds: number, dt = 1 / 60) => {
  const out: { stationId: number; n: number }[] = [];
  for (let t = 0; t < seconds && g.status === 'playing'; t += dt) { step(g, dt); out.push(...drainDeliveries(g)); }
  return out;
};

describe('delivered 事件', () => {
  it('带正确的站点 id 和人数，同一停靠里下车+上车不丢事件', () => {
    const g = createGame(3); quiet(g);
    const [a, b] = g.stations;
    expect(a.shape).not.toBe(b.shape);
    expect(connect(g, a, b)).toBe('ok');
    const t = g.lines[0].train;
    t.cargo = [b.shape, b.shape, b.shape];
    b.queue = [a.shape, a.shape]; // 到 b 时同一帧既下车又上车
    a.queue = [];
    let first: { stationId: number; n: number } | undefined;
    for (let i = 0; i < 60 * 60 && !first; i++) { step(g, 1 / 60); first = drainDeliveries(g)[0]; }
    expect(first).toEqual({ stationId: b.id, n: 3 });
    expect(t.cargo.filter(p => p === a.shape).length).toBe(2);
    expect(g.delivered).toBe(3);
    const rest = runCollect(g, 60);
    expect(rest[0]).toEqual({ stationId: a.id, n: 2 });
  });

  it('固定种子长跑：事件人数之和 == delivered，且可复现', () => {
    const play = () => {
      const g = createGame(42);
      connect(g, g.stations[0], g.stations[1]);
      connect(g, g.stations[1], g.stations[2]);
      const ev = runCollect(g, 300);
      return { ev, delivered: g.delivered };
    };
    const r1 = play(), r2 = play();
    expect(r1.delivered).toBeGreaterThan(0);
    expect(r1.ev.reduce((s, e) => s + e.n, 0)).toBe(r1.delivered);
    expect(r1.ev.every(e => e.n > 0)).toBe(true);
    expect(r2.ev).toEqual(r1.ev);
  });
});
