import { describe, expect, it } from 'vitest';
import { createGame, stationById, stationSpotOk, step, type Game } from '../src/sim';

type Reloc = Extract<NonNullable<Game['warning']>, { type: 'RELOCATE' }>;
/** 跑到抽出一个 RELOCATE 预警为止（清空排队防止输掉）。 */
function untilRelocateWarning(seed: number): { g: Game; w: Reloc } | null {
  const g = createGame(seed);
  for (let i = 0; i < 60 * 600; i++) {
    for (const s of g.stations) s.queue = [];
    step(g, 1 / 30);
    if (g.warning?.type === 'RELOCATE') return { g, w: g.warning };
  }
  return null;
}
const fire = (g: Game) => { while (g.warning) { for (const s of g.stations) s.queue = []; step(g, 1 / 30); } };

describe('RELOCATE 预警里带目标点', () => {
  it('预警时目标点在陆地上，事件触发后站点正好搬到这个点', () => {
    let hits = 0;
    for (let seed = 1; seed <= 30 && hits < 5; seed++) {
      const r = untilRelocateWarning(seed);
      if (!r) continue;
      const { g, w } = r; const tx = w.tx, ty = w.ty;
      const s = stationById(g, w.stationId)!;
      if (tx === s.tx && ty === s.ty) continue; // 罕见：无处可搬
      expect(stationSpotOk(g.cfg, tx, ty)).toBe(true);
      fire(g);
      expect([s.tx, s.ty]).toEqual([tx, ty]);
      hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('预警期间目标点失效（被洪水淹）→ 取消搬迁：预警清掉、站点不动、tx/ty 不改写', () => {
    const { g, w } = untilRelocateWarning(7)!;
    const s = stationById(g, w.stationId)!;
    const warned = { tx: w.tx, ty: w.ty }, before = { tx: s.tx, ty: s.ty };
    g.events.push({ type: 'FLOOD', x: w.tx, y: w.ty, r: g.cfg.flood.radius, left: 1e9 });
    const n = g.eventLog.length;
    fire(g);
    expect(g.eventLog.length).toBe(n + 1);
    expect(g.warning).toBeNull();
    expect({ tx: s.tx, ty: s.ty }).toEqual(before);
    expect({ tx: w.tx, ty: w.ty }).toEqual(warned);
  });
});
