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

  it('预警期间目标点失效（被洪水淹）→ 确定性重新找点，且新点合法', () => {
    const run = () => {
      const r = untilRelocateWarning(7)!;
      const { g, w } = r;
      g.events.push({ type: 'FLOOD', x: w.tx, y: w.ty, r: g.cfg.flood.radius, left: 1e9 });
      const old = { x: w.tx, y: w.ty };
      fire(g);
      const s = stationById(g, w.stationId)!;
      return { old, to: { x: s.tx, y: s.ty }, ok: stationSpotOk(g.cfg, s.tx, s.ty) };
    };
    const a = run(), b = run();
    expect(a.to).not.toEqual(a.old);
    expect(a.ok).toBe(true);
    expect(b).toEqual(a);
  });
});
