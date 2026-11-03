# metro-chaos

竖屏迷你地铁变体：在最多 3 条线的限制下连接形状站点，同时应对随机地形突变（洪水 / 站点搬迁 / 客流暴增）。

- `prototype/index.html`：已验证的玩法原型（单文件，参考实现，不是正式代码）。
- `GAME_DESIGN.md`：第一关试玩版的目标与规则。

## 第一关试玩版
- `npm run dev` 本地试玩，`?seed=N` 固定随机种子。
- 所有参数在 `src/config.ts`；规则逻辑在 `src/sim.ts`（纯函数，可测）；渲染和输入在 `src/main.ts`。
- `npm run check`：lint → 测试 → 构建 → 包体积预算（JS gzip ≤ 30 KB）→ 帧基准（sim.step ≤ 1 ms）。
- 素材接口：`src/art/palette.ts`（`PALETTE`）、`src/audio/sfx.ts`（`playDeliver/playWarning/playClear`），目前是占位。
