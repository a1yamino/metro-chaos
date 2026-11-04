/**
 * 规则（#27，game lab 定）：RELOCATE 预警给出的落点 (tx,ty) 是承诺。
 * 搬迁发生时，站点的目标点只能是：预警给的点，或原地不动（落点失效 → 取消）。
 * 绝不允许换成第三个位置。失败时请修 src/sim.ts 的 startEvent，不要放宽本测试。
 */
import { describe, expect, it } from 'vitest';
import { createGame, step, stationById } from '../src/sim';

type Mode = 'natural' | 'flood';
const SEEDS = Array.from({ length: 20 }, (_, i) => i);
const DT = 1 / 10;
const SECONDS = 120;

describe('规则：RELOCATE 兑现预警落点或原地不动', () => {
  it.each<Mode>(['natural', 'flood'])('不会搬到预警之外的位置（%s：flood 在预警期间淹掉落点）', (mode) => {
    const bad: string[] = [];
    let fired = 0;
    for (const seed of SEEDS) {
      const g = createGame(seed);
      let pend: { id: number; tx: number; ty: number; ox: number; oy: number } | null = null;
      for (let t = 0; t < SECONDS && g.status === 'playing'; t += DT) {
        step(g, DT);
        const w = g.warning;
        if (!pend && w?.type === 'RELOCATE') {
          const s = stationById(g, w.stationId)!;
          pend = { id: w.stationId, tx: w.tx, ty: w.ty, ox: s.tx, oy: s.ty };
          if (mode === 'flood') g.events.push({ type: 'FLOOD', x: w.tx, y: w.ty, r: 40, left: 30 });
        } else if (pend && g.warning?.type !== 'RELOCATE') {
          fired++;
          const s = stationById(g, pend.id);
          if (s) {
            const kept = s.tx === pend.tx && s.ty === pend.ty;
            const stayed = s.tx === pend.ox && s.ty === pend.oy;
            if (!kept && !stayed) bad.push(`seed ${seed} 站 ${pend.id}: 预警 (${pend.tx},${pend.ty}) 实际 (${s.tx},${s.ty})`);
          }
          pend = null;
        }
      }
    }
    expect(fired).toBeGreaterThan(0);
    expect(bad, '搬迁换了预警之外的落点').toEqual([]);
  });
});
