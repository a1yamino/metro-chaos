/**
 * 规则：底图里按位置摆放的装饰物（路灯、屋顶、树冠、地名）不能落在 isWater 判定为水的位置上。
 * 来源：#16 曾出现路灯落在河面上。小船、码头、浪纹本来就在水上/岸边，不在此规则内。
 * 做法：用一个只记录调用的假 2D context 跑 drawBasemap（不需要真 canvas），按 fillStyle 区分装饰物，取各自的锚点检查。
 * 失败时请修 src/art/basemap.ts 里的摆放条件（例如 busy() / distToRiver），不要删掉装饰物或放宽 isWater。
 */
import { describe, expect, it, vi } from 'vitest';
import type { Pt } from '../src/map/types';
import { LEVEL1, isWater } from '../src/map/level1';
import { PALETTE as P } from '../src/art/palette';
import { LABELS, drawBasemap } from '../src/art/basemap';

type Hit = { kind: string; p: Pt };

function fakeCtx(hits: Hit[]) {
  const c: Record<string, unknown> = {
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, font: '', textAlign: '', lineDashOffset: 0,
    getTransform: () => ({ a: 1 }),
    fillRect(x: number, y: number, w: number, h: number) {
      const fs = c.fillStyle as string, p = { x: x + w / 2, y: y + h / 2 };
      if (fs === P.lamp) hits.push({ kind: '路灯', p });
      else if ((P.roofs as readonly string[]).includes(fs)) hits.push({ kind: '屋顶', p });
    },
    arc(x: number, y: number) { if (c.fillStyle === P.tree) hits.push({ kind: '树冠', p: { x, y } }); },
    fillText(s: string, x: number, y: number) { hits.push({ kind: `地名「${s}」`, p: { x, y } }); },
    strokeText(s: string, x: number, y: number) { hits.push({ kind: `地名描边「${s}」`, p: { x, y } }); },
  };
  for (const m of ['scale', 'save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'clip', 'drawImage', 'translate', 'rotate', 'setLineDash'])
    c[m] = () => {};
  return c;
}

describe('规则：装饰物不落水', () => {
  it('路灯、屋顶、树冠、地名都不在 isWater 上', () => {
    const hits: Hit[] = [];
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx(hits) }) });
    drawBasemap(fakeCtx(hits) as unknown as CanvasRenderingContext2D, LEVEL1, 90); // t=90 正午夜，全部路灯都画出来
    vi.unstubAllGlobals();
    for (const k of ['路灯', '屋顶', '树冠']) expect(hits.some((h) => h.kind === k), `没采到${k}，假 context 可能跟不上 basemap 的画法`).toBe(true);
    const wet = hits.filter((h) => isWater(h.p)).map((h) => `${h.kind}@(${h.p.x.toFixed(1)},${h.p.y.toFixed(1)})`);
    expect(wet, `这些装饰物落在水上：${wet.join(' ')}。正确做法：在 src/art/basemap.ts 的摆放条件里排除 isWater 的位置`).toEqual([]);
  });
});

describe('规则：地名的每个备选锚点都在干地上', () => {
  it('躲站点/线路换位时也不会把地名挪到水上', () => {
    for (const [s, cands] of LABELS) for (const [x, y] of cands)
      expect(isWater({ x, y }), `地名「${s}」的备选锚点 (${x},${y}) 在水上。正确做法：在 src/art/basemap.ts 的 LABELS 里换一个干地上的点`).toBe(false);
  });
});
