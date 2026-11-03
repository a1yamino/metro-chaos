import { describe, expect, it } from 'vitest';
import { CONFIG, type Config } from '../src/config';
import { runLand } from './land-sim';

// CI 版：加快刷站和突变，用小规模覆盖开局、新站、RELOCATE。完整的 200 种子 × 300 秒见 npm run soak。
// Config 是 as const 字面量类型，测试用的加速配置需要显式转换
const FAST = {
  ...CONFIG,
  eventInterval: { start: 2, min: 2, shrinkPerMinute: 0 },
  eventWarning: 1,
  stationSpawn: { start: 1, min: 1, ramp: 1e9 },
} as unknown as Config;

describe('A5 站点只在陆地上', () => {
  it('20 个种子 × 30 秒（加速刷站和突变）：开局、新站、搬迁后都不在水里、不贴河、不贴边', () => {
    const { violations, relocations } = runLand(20, 30, FAST, 0.25, 2);
    expect(violations).toEqual([]);
    expect(relocations, '没覆盖到 RELOCATE').toBeGreaterThan(20);
  });
});
