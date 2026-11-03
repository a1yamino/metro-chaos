/**
 * 地形规则（ROADMAP A5）：站点不能落在水上。
 * 河港城的水域由 src/map/level1.ts 的 isWater 判定（河 + 海）。
 * 站点是半径 CONFIG.stationRadius 的圆，圆盘也不能压进河里：
 *   distToRiver(站心) > LEVEL1.river.width / 2 + CONFIG.stationRadius
 * 覆盖：开局站、随时间新增的站、RELOCATE 搬站的目标点（tx/ty）。
 *
 * 当前 main 上 sim.ts 的 freeSpot 不读地图，因此本规则用 it.fails 标注，
 * 断言的是"地形接入后"的行为。A5 修复后改为 it。
 * 失败时请修 src/sim.ts 的 freeSpot（候选点用 isWater/distToRiver 过滤），不要放宽本测试。
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { distToRiver, isWater, LEVEL1 } from '../src/map/level1';
import { createGame, step, type Game } from '../src/sim';

const SEEDS = Array.from({ length: 30 }, (_, i) => i);
const DT = 1 / 10;
const SECONDS = 120;
const MIN_RIVER_DIST = LEVEL1.river.width / 2 + CONFIG.stationRadius;

type Hit = { seed: number; id: number; kind: 'spawn' | 'relocate'; x: number; y: number };

const onWater = (x: number, y: number) => isWater({ x, y }) || distToRiver({ x, y }) <= MIN_RIVER_DIST;

function check(g: Game, seed: number, hits: Hit[], seen: Set<string>) {
  for (const s of g.stations) {
    // 搬站途中滑过水面不算；只检查落定的位置（x/y 与目标 tx/ty 重合）和搬站目标点
    const settled = s.x === s.tx && s.y === s.ty;
    for (const [kind, x, y] of [['spawn', s.x, s.y], ['relocate', s.tx, s.ty]] as const) {
      if (kind === 'spawn' && !settled) continue;
      const key = `${s.id}:${Math.round(x)}:${Math.round(y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (onWater(x, y)) hits.push({ seed, id: s.id, kind, x: Math.round(x), y: Math.round(y) });
    }
  }
}

function collectWaterStations(seeds = SEEDS): Hit[] {
  const hits: Hit[] = [];
  for (const seed of seeds) {
    const g = createGame(seed);
    const seen = new Set<string>();
    check(g, seed, hits, seen);
    for (let t = 0; t < SECONDS && g.status === 'playing'; t += DT) {
      step(g, DT);
      g.upgradeOffer = false;
      check(g, seed, hits, seen);
    }
  }
  return hits;
}

describe('规则：站点不在水上', () => {
  // A5 修复后改为 it
  it.fails('开局、新增、RELOCATE 搬站的站点都不落在河/海里', () => {
    const hits = collectWaterStations();
    expect(hits,
      `落水站：${hits.slice(0, 5).map(h => `seed=${h.seed} 站${h.id} ${h.kind} (${h.x},${h.y})`).join('；')}。` +
      `正确做法：sim.ts freeSpot 生成候选点时用 isWater 过滤，并要求 distToRiver > river.width/2 + stationRadius`).toEqual([]);
  });
});
