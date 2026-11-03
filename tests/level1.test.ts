import { describe, expect, it } from 'vitest';
import { LEVEL1, distToRiver, isWater, segmentCrossesWater } from '../src/map/level1';

describe('第一关地形', () => {
  it('河道中心点与海里的点是水，岸上的点不是', () => {
    for (const p of LEVEL1.river.center) expect(isWater(p)).toBe(true);
    expect(distToRiver(LEVEL1.river.center[3])).toBe(0);
    expect(isWater({ x: 195, y: 820 })).toBe(true);
    expect(isWater({ x: 50, y: 150 })).toBe(false);
    expect(isWater({ x: 340, y: 400 })).toBe(false);
  });
  it('distToRiver 随离岸变远而增大', () => {
    expect(distToRiver({ x: 60, y: 300 })).toBeCloseTo(80, 0);
  });
  it('横跨河道的线段过水，同岸线段不过水', () => {
    expect(segmentCrossesWater({ x: 50, y: 300 }, { x: 340, y: 300 })).toBe(true);
    expect(segmentCrossesWater({ x: 40, y: 100 }, { x: 60, y: 600 })).toBe(false);
    expect(segmentCrossesWater({ x: 330, y: 100 }, { x: 340, y: 500 })).toBe(false);
  });
  it('两岸都留有足够陆地', () => {
    let west = 0, east = 0;
    for (let y = 80; y < 720; y += 20) for (let x = 10; x < 390; x += 20) {
      if (isWater({ x, y })) continue;
      if (x < 150) west++; else if (x > 260) east++;
    }
    expect(west).toBeGreaterThan(100);
    expect(east).toBeGreaterThan(100);
  });
});
