/**
 * 活性规则（GAME_DESIGN.md）：正常开局后游戏必须"动起来"。
 *  1. 玩家用一条线连起开局的站，60 秒内一定有人送达。
 *  2. 不动任何计时器，第一次突变（或其预警）在开局 30 秒内出现。
 * 失败时请修 src/sim.ts / src/config.ts，不要放宽本测试。
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { connect, createGame, step, type Game } from '../src/sim';

const SEEDS = Array.from({ length: 30 }, (_, i) => i);
const DT = 1 / 30;
const run = (g: Game, seconds: number, until: (g: Game) => boolean) => {
  for (let t = 0; t < seconds && g.status === 'playing' && !until(g); t += DT) {
    step(g, DT);
    g.upgradeOffer = false; // 升级弹窗不影响活性
  }
};

describe('规则：活性', () => {
  it('一条线连起开局站点，60 秒内必有送达', () => {
    for (const seed of SEEDS) {
      const g = createGame(seed);
      const [a, b, c] = g.stations;
      expect(connect(g, a, b), `seed=${seed}：开局两站无法连线`).toBe('ok');
      if (c) connect(g, b, c);
      run(g, 60, x => x.delivered > 0);
      expect(g.delivered,
        `seed=${seed}：连了线 60 秒仍无人送达（status=${g.status}）。正确做法：检查列车行驶/上下客逻辑（stepTrain、arrive），以及开局乘客生成率 passengerRate`).toBeGreaterThan(0);
    }
  });

  it('不动计时器，第一次突变或其预警在 30 秒内出现', () => {
    for (const seed of SEEDS) {
      const g = createGame(seed);
      connect(g, g.stations[0], g.stations[1]);
      run(g, 30 + DT, x => x.warning !== null || x.eventLog.length > 0);
      expect(g.warning !== null || g.eventLog.length > 0,
        `seed=${seed}：开局 30 秒内没有任何突变或预警（eventInterval.start=${CONFIG.eventInterval.start}）。正确做法：按设计文档"每 30 秒突变、预警 5 秒"，让 createGame 的 eventTimer 初值 ≤ 30，并保证 step() 递减它`).toBe(true);
    }
  });
});
