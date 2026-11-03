import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { addCarriage, connect, createGame, step, type Game, type Shape } from '../src/sim';

const run = (g: Game, seconds: number, dt = 1 / 60) => { for (let t = 0; t < seconds && g.status === 'playing'; t += dt) step(g, dt); };
const crowd = (n: number): Shape[] => Array.from({ length: n }, () => 'triangle');

describe('第一关规则', () => {
  it('送达达到目标即过关', () => {
    const g = createGame(1);
    g.delivered = CONFIG.goal;
    step(g, 0.016);
    expect(g.status).toBe('won');
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

  it('第 60、120 秒各奖励一节车厢，加到线上增加载客', () => {
    const g = createGame(4);
    connect(g, g.stations[0], g.stations[1]);
    g.eventTimer = 1e9;
    g.stations.forEach(s => (s.queue = []));
    const cap = g.lines[0].train.capacity;
    for (let t = 0; t < 121; t += 0.1) { step(g, 0.1); g.stations.forEach(s => (s.queue = [])); }
    expect(g.rewardsGiven).toBe(2);
    expect(addCarriage(g, 0)).toBe(true);
    expect(g.lines[0].train.capacity).toBe(cap + CONFIG.carriageCapacity);
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
