# AGENTS.md — metro-chaos 团队规则

## PR
- 一个 PR 只做一件事。
- 合并前提：本地 `npm run check` 全绿（lint、测试、构建、`budget` JS gzip ≤ 30 KB、`bench` sim.step ≤ 1 ms），且 CI（`.github/workflows/ci.yml`）全绿。
- 有画面变化的 PR 必须附截图。
- 只用 squash 合并。禁止 force push，禁止改写 main 历史。

## 代码
- sim（`src/sim.ts`）必须确定性：随机数只用 `src/rng.ts` 的带种子 RNG，不用 `Math.random`。
- 渲染层只读 sim 的状态和事件（`drainSignals` / `drainDeliveries`），不改 sim 状态。
- 装饰物不能画在水上（河、海），由 `tests/rules.decor.test.ts` 检查。

## 测试
- 单元测试要快：每个测试文件约 100 ms 以内。
- 长跑用 `npm run soak`（`scripts/soak.ts`），只在本地跑，不进 CI。
- CI 总时长保持在 3 分钟以内（`timeout-minutes: 3`）。
