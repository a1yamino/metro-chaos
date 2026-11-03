import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { connect, createGame, drainSignals, step, takeUpgrade, type Game, type Station } from '../src/sim';

function at(g: Game, x: number, y: number): Station {
  const s: Station = { id: g.nextId++, x, y, tx: x, ty: y, shape: 'circle', queue: [], crowdTime: 0, rush: false };
  g.stations.push(s);
  return s;
}
const fresh = () => { const g = createGame(1); g.stations = []; g.events = []; return g; };

describe('A2 过河规则', () => {
  it('开局有 2 桥 2 隧道', () => {
    const g = createGame(1);
    expect(g.bridges).toBe(CONFIG.startBridges);
    expect(g.tunnels).toBe(CONFIG.startTunnels);
    expect([CONFIG.startBridges, CONFIG.startTunnels]).toEqual([2, 2]);
  });
  it('同岸连线不消耗桥或隧道', () => {
    const g = fresh();
    expect(connect(g, at(g, 40, 100), at(g, 60, 600))).toBe('ok');
    expect([g.bridges, g.tunnels]).toEqual([2, 2]);
  });
  it('过河先用隧道，用完再用桥，都用完拒绝并发出 needCrossing', () => {
    const g = fresh();
    g.maxLines = 10;
    for (let i = 0; i < 4; i++) {
      expect(connect(g, at(g, 50, 250 + i * 10), at(g, 340, 250 + i * 10))).toBe('ok');
    }
    expect([g.tunnels, g.bridges]).toEqual([0, 0]);
    drainSignals(g);
    const before = g.lines.length;
    expect(connect(g, at(g, 50, 300), at(g, 340, 300))).toBe('needCrossing');
    expect(g.lines.length).toBe(before);
    expect(drainSignals(g)).toContain('needCrossing');
  });
  it('升级三选一包含桥或隧道，领取后数量 +1', () => {
    const g = createGame(3);
    let tries = 0;
    while (!g.upgradeOffer && tries++ < 10) { g.t = (g.upgradesGiven + 1) * CONFIG.upgradeInterval; stepOnce(g); }
    expect(g.upgradeChoices).toHaveLength(3);
    const extra = g.upgradeChoices.find(u => u === 'bridge' || u === 'tunnel')!;
    expect(extra).toBeDefined();
    const n = extra === 'bridge' ? g.bridges : g.tunnels;
    expect(takeUpgrade(g, extra)).toBe(true);
    expect(extra === 'bridge' ? g.bridges : g.tunnels).toBe(n + 1);
  });
  it('不在本次三选一里的升级不能领取', () => {
    const g = createGame(3);
    g.upgradeOffer = true; g.upgradeChoices = ['carriage', 'line', 'bridge'];
    expect(takeUpgrade(g, 'tunnel')).toBe(false);
  });
});

function stepOnce(g: Game) { step(g, 0.01); }
