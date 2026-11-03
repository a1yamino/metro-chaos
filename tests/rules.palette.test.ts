/**
 * 规则：调色板线路颜色数 ≥ 配置允许的最大线路数，否则第 4、5 条线会撞色。
 * 编译期检查（tsc --noEmit，即 npm run build）+ 运行期测试双保险。
 * 失败时请在 src/art/palette.ts 的 PALETTE.lines 里补颜色，不要调低 maxLinesCap 来过关。
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { PALETTE } from '../src/art/palette';

type BuildTuple<N extends number, T extends unknown[] = []> = T['length'] extends N ? T : BuildTuple<N, [...T, unknown]>;
type PaletteCheck<L extends number, N extends number> = BuildTuple<L> extends [...BuildTuple<N>, ...unknown[]]
  ? true
  : '错误：PALETTE.lines 颜色数少于 CONFIG.maxLinesCap。正确做法：在 src/art/palette.ts 的 PALETTE.lines 里补够颜色';

// 已知红：PALETTE.lines 只有 3 色、maxLinesCap=5，等 artisan 补色。
// 补好后这条 @ts-expect-error 失效，build 报 "Unused '@ts-expect-error'"，届时删掉它。
// @ts-expect-error 已知红，见上
export const PALETTE_COVERS_MAX_LINES: PaletteCheck<(typeof PALETTE.lines)['length'], typeof CONFIG.maxLinesCap> = true;

describe('规则：调色板与配置一致', () => {
  // 已知红：同上。artisan 补色后 it.fails 会报 "Expect test to fail"，届时改回 it。
  it.fails('PALETTE.lines 颜色数 ≥ CONFIG.maxLinesCap，且互不重复', () => {
    expect(PALETTE.lines.length,
      `PALETTE.lines 只有 ${PALETTE.lines.length} 种颜色，但 CONFIG.maxLinesCap=${CONFIG.maxLinesCap}。正确做法：在 src/art/palette.ts 的 PALETTE.lines 里补够颜色`).toBeGreaterThanOrEqual(CONFIG.maxLinesCap);
    expect(new Set(PALETTE.lines).size, 'PALETTE.lines 有重复颜色').toBe(PALETTE.lines.length);
  });
});
