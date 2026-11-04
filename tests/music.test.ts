import { describe, expect, it } from 'vitest';
import { layerLevels, LAYERS } from '../src/audio/music';
import { tensionOf } from '../src/audio/tension';
import { createGame } from '../src/sim';

describe('背景音乐紧张度', () => {
  it('各层音量随紧张度单调不减（铺底除外），0 时只有铺底，1 时全开', () => {
    const a = layerLevels(0), b = layerLevels(1);
    expect(a.arp + a.bass + a.hats + a.high).toBe(0);
    for (const k of LAYERS) if (k !== 'pad') expect(b[k]).toBe(1);
    for (let t = 0; t < 1; t += 0.05) for (const k of LAYERS) if (k !== 'pad') expect(layerLevels(t + 0.05)[k]).toBeGreaterThanOrEqual(layerLevels(t)[k]);
  });
  it('tensionOf 只读：在 0..1 内、拥挤时变高、不改 sim', () => {
    const g = createGame(7), before = JSON.stringify(g.stations);
    const t0 = tensionOf(g);
    expect(JSON.stringify(g.stations)).toBe(before);
    g.stations[0].queue = Array(g.cfg.crowdLimit).fill('circle');
    g.stations[0].crowdTime = g.cfg.crowdFailSeconds / 2;
    const t1 = tensionOf(g);
    expect(t0).toBeGreaterThanOrEqual(0); expect(t1).toBeLessThanOrEqual(1); expect(t1).toBeGreaterThan(t0 + 0.5);
  });
});
