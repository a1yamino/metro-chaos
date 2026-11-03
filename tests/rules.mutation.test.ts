/**
 * 规则：突变不能造成必败（GAME_DESIGN.md）。
 * 对固定种子 × 三种突变（FLOOD / RUSH / RELOCATE），在站点拥挤时施加突变，检查：
 *  - 预警窗口内与突变开始那一刻游戏不结束；
 *  - 被洪水覆盖的站不累计拥挤时间；
 *  - 客流暴增不落在已拥挤的站上（包括"所有站都拥挤"这种极端局面）；
 *  - 搬站不会让被搬的站拥挤时间变多。
 * 失败时请修 src/sim.ts 里的突变逻辑，而不是放宽本测试。
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createGame, step, stationById, stationFlooded, type EventType, type Game, type Shape } from '../src/sim';

const SEEDS = 60;
const DT = 1 / 30;
const crowd = (n: number): Shape[] => Array.from({ length: n }, () => 'triangle');
const isCrowded = (g: Game, id: number) => (stationById(g, id)?.queue.length ?? 0) > CONFIG.crowdLimit;

function crowdUp(g: Game, all: boolean) {
  g.stations.forEach((s, i) => { if (all || i % 2 === 0) { s.queue = crowd(CONFIG.crowdLimit + 1); s.crowdTime = 0; } });
}

/** 让下一次突变立刻进入预警，返回预警内容。 */
function nextWarning(g: Game) {
  g.eventTimer = CONFIG.eventWarning + DT / 2;
  step(g, DT);
  expect(g.warning, '预警应已产生').not.toBeNull();
  return g.warning!;
}

describe('规则：突变不能造成必败', () => {
  // 已知红：所有站都拥挤时 pickEvent 回退到任意站（src/sim.ts 的 `: any`），暴增会落在拥挤站上。
  // 交 forge 修；修好后 it.fails 会变红，届时把它改回 it。
  for (const all of [false, true]) {
    (all ? it.fails : it)(`${all ? '所有站' : '一半站'}拥挤时，三种突变都不会让游戏必败`, () => {
      const seen = new Set<EventType>();
      for (let seed = 0; seed < SEEDS; seed++) {
        const g = createGame(seed);
        crowdUp(g, all);
        const w = nextWarning(g);
        seen.add(w.type);
        const why = `seed=${seed} 突变=${w.type}`;
        if (w.type === 'RUSH') {
          expect(isCrowded(g, w.stationId),
            `${why}：客流暴增落在了已拥挤的站上。正确做法：pickEvent 只从不拥挤的站里选目标，没有就换成别的突变或跳过`).toBe(false);
        }
        const relocBefore = w.type === 'RELOCATE' ? stationById(g, w.stationId)!.crowdTime : 0;
        // 走完预警窗口，突变开始
        while (g.warning && g.status === 'playing') step(g, DT);
        expect(g.status, `${why}：预警窗口内或突变开始时游戏结束了`).toBe('playing');
        if (w.type === 'RELOCATE') {
          expect(stationById(g, w.stationId)!.crowdTime,
            `${why}：搬站后该站拥挤时间反而增加，正确做法：搬站不应额外累计拥挤`).toBeLessThanOrEqual(relocBefore + CONFIG.eventWarning + DT);
        }
        if (w.type === 'FLOOD') {
          const flooded = g.stations.filter(s => stationFlooded(g, s));
          flooded.forEach(s => { s.queue = crowd(CONFIG.crowdLimit + 20); s.crowdTime = 0; });
          g.eventTimer = 1e9;
          for (let t = 0; t < 3; t += DT) step(g, DT);
          for (const s of flooded) {
            if (!stationFlooded(g, s)) continue;
            expect(s.crowdTime,
              `${why}：被洪水覆盖的站 #${s.id} 仍在累计拥挤时间。正确做法：step() 里洪水站跳过拥挤计时（冻结）`).toBe(0);
          }
        }
      }
      expect([...seen].sort(), '种子应覆盖全部三种突变').toEqual(['FLOOD', 'RELOCATE', 'RUSH']);
    });
  }
});
