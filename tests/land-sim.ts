/** A5 站点落点检查的共用模拟：CI 测试（小规模）和本地 soak（scripts/soak.ts，大规模）共用。 */
import { CONFIG, type Config } from '../src/config';
import { distToRiver, isWater } from '../src/map/level1';
import { createGame, step, type Game } from '../src/sim';

export function landViolations(g: Game, seed: number, cfg: Config = g.cfg): string[] {
  const out: string[] = [];
  for (const s of g.stations) for (const [x, y] of [[s.x, s.y], [s.tx, s.ty]]) {
    const why = isWater({ x, y }) ? '在水里'
      : distToRiver({ x, y }) < cfg.stationRiverMargin ? '离河太近'
      : x < cfg.stationEdgeMargin || x > cfg.width - cfg.stationEdgeMargin || y > cfg.height - cfg.stationEdgeMargin ? '贴边' : null;
    if (why) out.push(`seed=${seed} t=${g.t.toFixed(1)} 站点 ${s.id} (${x.toFixed(0)},${y.toFixed(0)}) ${why}`);
  }
  return out;
}

/** 跑 seeds 个种子各 seconds 秒，清空排队防止提前输掉；返回违规列表和 RELOCATE 次数。 */
export function runLand(seeds: number, seconds: number, cfg: Config = CONFIG, dt = 0.25, checkEvery = 8) {
  const violations: string[] = [];
  let relocations = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const g = createGame(seed, cfg);
    violations.push(...landViolations(g, seed));
    for (let i = 0; i < seconds / dt && g.status === 'playing'; i++) {
      g.upgradeOffer = false;
      for (const s of g.stations) s.queue.length = 0;
      step(g, dt);
      if (i % checkEvery === 0) violations.push(...landViolations(g, seed));
    }
    relocations += g.eventLog.filter(e => e === 'RELOCATE').length;
  }
  return { violations, relocations };
}
