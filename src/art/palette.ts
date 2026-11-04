/** Metro Chaos 调色板：色块风格，所有颜色只从这里取。键名与占位版一致。 */
export const PALETTE = {
  bg: '#f4f1ea',       // 纸色底
  ink: '#222222',      // 描边、文字、列车
  muted: '#888888',    // 次要文字
  white: '#ffffff',    // 站点填充
  lines: ['#e3342f', '#3490dc', '#38a169', '#f6993f', '#8d5a3b'], // 红 蓝 绿 橙 棕，避开洪水蓝、预警黄、暴增紫
  flood: '#5b8fd1',    // 洪水区
  floodDeep: '#1d4f91',
  warning: '#f6c23e',  // 突变预警
  rush: '#9561e2',     // 客流暴增，避开预警黄
  danger: '#e3342f',
  good: '#38a169',
  // 底图
  block: '#efebe2',     // 街区
  street: '#f9f7f2',    // 街道
  water: '#bcd6ea',     // 河与海
  waterLine: '#9cc0dd', // 岸线、波纹
  park: '#cfe3c1',
  parkDot: '#b5d3a3',
  hill: '#e2d7c0',
  hillLine: '#cdbf9f',
  road: '#fdfcf9',      // 大路
  roofs: ['#f1ede5', '#eeeae1', '#ebe6dc'], // 屋顶高低三档
  roofShadow: '#e7e1d5',
  tree: '#b2d19f',
  treeDark: '#9fc48a',
  hillShade: '#d9cbb0',
  pier: '#d8cdb8',
  foam: '#ffffff',
  boat: '#8a7a66',
  label: '#b4ab9b',
  night: '#141c33',
  lamp: '#ffd27a',
  overlay: 'rgba(34,34,34,0.6)',
} as const;
