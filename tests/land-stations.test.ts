import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { distToRiver, isWater } from '../src/map/level1';
import { createGame, step, type Game } from '../src/sim';

function assertLand(g: Game, seed: number) {
  for (const s of g.stations) for (const [x, y] of [[s.x, s.y], [s.tx, s.ty]]) {
    const where = `seed=${seed} t=${g.t.toFixed(1)} 站点 ${s.id} (${x.toFixed(0)},${y.toFixed(0)})`;
    expect(isWater({ x, y }), `${where} 在水里`).toBe(false);
    expect(distToRiver({ x, y }), `${where} 离河太近`).toBeGreaterThanOrEqual(CONFIG.stationRiverMargin);
    expect(x >= CONFIG.stationEdgeMargin && x <= CONFIG.width - CONFIG.stationEdgeMargin, `${where} 贴边`).toBe(true);
    expect(y <= CONFIG.height - CONFIG.stationEdgeMargin, `${where} 贴底边`).toBe(true);
  }
}

describe('A5 站点只在陆地上', () => {
  it('200 个种子 × 300 秒：开局、新站、搬迁后都不在水里、不贴河、不贴边', () => {
    let relocations = 0;
    for (let seed = 0; seed < 200; seed++) {
      const g = createGame(seed);
      expect(g.stations.length).toBe(CONFIG.initialStations);
      assertLand(g, seed);
      for (let i = 0; i < 300 * 4 && g.status === 'playing'; i++) {
        if (g.upgradeOffer) g.upgradeOffer = false;
        for (const s of g.stations) s.queue.length = 0; // 不让游戏提前输掉，好跑满突变和刷站
        step(g, 0.25);
        if (i % 8 === 0) assertLand(g, seed);
      }
      relocations += g.eventLog.filter(e => e === 'RELOCATE').length;
    }
    expect(relocations, '没覆盖到 RELOCATE').toBeGreaterThan(50);
  }, 60_000);
});
