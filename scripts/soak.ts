/** 本地长跑（不进 check/CI）：200 个种子 × 300 秒，确认站点从不落在水里、贴河或贴边。 */
import { runLand } from '../tests/land-sim';

const t0 = performance.now();
const { violations, relocations } = runLand(200, 300);
const ms = performance.now() - t0;
console.log(`soak 200 seeds × 300 s: ${violations.length} violations, ${relocations} relocations, ${(ms / 1000).toFixed(1)} s`);
if (violations.length) { console.error(violations.slice(0, 20).join('\n')); process.exit(1); }
