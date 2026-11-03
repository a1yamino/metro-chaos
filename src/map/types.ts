/** 地形数据格式（按 forge 定的 LEVEL1）。棋盘坐标 390×844，原点左上。 */
export type Pt = { readonly x: number; readonly y: number };
export type Poly = readonly Pt[];
export interface LevelMap {
  river: { center: Poly; width: number };
  sea: Poly;
  parks: readonly Poly[];
  hills: readonly Poly[];
}
