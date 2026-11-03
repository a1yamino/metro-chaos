// 帧预算：满场（14 站、3 线、洪水）下 sim.step 平均耗时需 < 1 ms（60fps 帧预算 16.7 ms 的 6%）。
import { addStation, connect, createGame, step } from '../src/sim';
const g = createGame(42);
while (g.stations.length < 14 && addStation(g));
for (let i = 0; i + 1 < g.stations.length; i++) connect(g, g.stations[i], g.stations[i + 1]);
g.events.push({ type: 'FLOOD', x: 195, y: 420, r: 95, left: 1e9 });
g.status = 'playing';
const N = 20000, t0 = performance.now();
for (let i = 0; i < N; i++) { step(g, 1 / 60); g.status = 'playing'; g.stations.forEach(s => (s.crowdTime = 0)); }
const ms = (performance.now() - t0) / N;
console.log(`sim.step ${ms.toFixed(4)} ms/frame (limit 1 ms)`);
if (ms > 1) process.exit(1);
