import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { addCarriage, connect, createGame, eventInterval, step, takeUpgrade, type Game, type Shape } from '../src/sim';

const run = (g: Game, seconds: number, dt = 1 / 60) => { for (let t = 0; t < seconds && g.status === 'playing'; t += dt) step(g, dt); };
const crowd = (n: number): Shape[] => Array.from({ length: n }, () => 'triangle');

describe('第一关规则', () => {
  it('无尽模式：送多少人都不会结束', () => {
    const g = createGame(1);
    g.delivered = 1e6;
    step(g, 0.016);
    expect(g.status).toBe('playing');
  });

  it('突变间隔随时间缩短，但不低于下限', () => {
    const g = createGame(1);
    expect(eventInterval(g)).toBe(CONFIG.eventInterval.start);
    g.t = 3600;
    expect(eventInterval(g)).toBe(CONFIG.eventInterval.min);
  });

  it('站点拥挤持续 crowdFailSeconds 秒才失败', () => {
    const g = createGame(1);
    g.eventTimer = 1e9; // 排除突变
    g.stations[0].queue = crowd(CONFIG.crowdLimit + 20);
    run(g, CONFIG.crowdFailSeconds - 0.5);
    expect(g.status).toBe('playing');
    run(g, 1);
    expect(g.status).toBe('lost');
  });

  it('洪水覆盖拥挤的站时游戏不结束（突变不能造成必败）', () => {
    const g = createGame(2);
    const s = g.stations[0];
    s.queue = crowd(CONFIG.crowdLimit + 20);
    g.events.push({ type: 'FLOOD', x: s.x, y: s.y, r: CONFIG.flood.radius, left: 1e9 });
    g.eventTimer = 1e9;
    run(g, CONFIG.crowdFailSeconds * 3);
    expect(g.status).toBe('playing');
  });

  it('客流暴增不会落在已经拥挤的站上', () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = createGame(seed);
      g.stations[0].queue = crowd(CONFIG.crowdLimit + 1);
      g.eventTimer = CONFIG.eventWarning + 0.01;
      while (!g.warning) step(g, 0.016);
      const w = g.warning;
      if (w.type === 'RUSH') expect(w.stationId).not.toBe(g.stations[0].id);
    }
  });

  it('不能把线画进洪水', () => {
    const g = createGame(3);
    const [a, b] = g.stations;
    g.events.push({ type: 'FLOOD', x: b.x, y: b.y, r: 30, left: 10 });
    expect(connect(g, a, b)).toBe('flooded');
  });

  it('每 60 秒给一次三选一升级：车厢、新线、桥', () => {
    const g = createGame(4);
    connect(g, g.stations[0], g.stations[1]);
    g.eventTimer = 1e9;
    for (let t = 0; t < 61; t += 0.1) { step(g, 0.1); g.stations.forEach(s => (s.queue = [])); }
    expect(g.upgradeOffer).toBe(true);
    const cap = g.lines[0].train.capacity;
    expect(takeUpgrade(g, 'carriage')).toBe(true);
    expect(g.upgradeOffer).toBe(false);
    expect(addCarriage(g, 0)).toBe(true);
    expect(g.lines[0].train.capacity).toBe(cap + CONFIG.carriageCapacity);
    g.upgradeOffer = true; takeUpgrade(g, 'line');
    expect(g.maxLines).toBe(CONFIG.startLines + 1);
  });

  it('桥：消耗一座桥后可以把线画过洪水，且这段不再被切断', () => {
    const g = createGame(5);
    const [a, b] = g.stations;
    g.events.push({ type: 'FLOOD', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: 10, left: 1e9 });
    expect(connect(g, a, b)).toBe('flooded');
    g.bridges = 1;
    expect(connect(g, a, b)).toBe('ok');
    expect(g.bridges).toBe(0);
  });

  it('前期客流放缓：只连一条线也能撑过 40 秒（原型约 22 秒失败）', () => {
    let survived = 0;
    for (let seed = 0; seed < 50; seed++) {
      const g = createGame(seed);
      connect(g, g.stations[0], g.stations[1]);
      run(g, 40);
      if (g.status === 'playing') survived++;
    }
    expect(survived).toBeGreaterThanOrEqual(45);
  });
});
