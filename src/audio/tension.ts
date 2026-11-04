import type { Game } from '../sim';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 背景音乐的紧张度 0..1。只读 sim 状态，不改任何字段。 */
export function tensionOf(g: Readonly<Game>): number {
  if (g.status !== 'playing') return 0;
  const c = g.cfg;
  let crowd = 0, fail = 0;
  for (const s of g.stations) {
    crowd = Math.max(crowd, s.queue.length / c.crowdLimit);
    fail = Math.max(fail, s.crowdTime / c.crowdFailSeconds);
  }
  const warn = g.warning ? 1 : 0;
  const time = clamp01(g.t / 600);
  // 最挤的站占大头；有站在倒计时失败时直接拉高；突变预警和时间做底
  return clamp01(0.55 * clamp01(crowd) + 0.45 * fail + 0.2 * warn + 0.15 * time);
}
