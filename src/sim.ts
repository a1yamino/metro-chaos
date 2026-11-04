import { CONFIG, type Config } from './config';
import { makeRng, type Rng } from './rng';
import { pointAt, route, routeLength } from './route';
import { distToRiver, isWater, segmentCrossesWater } from './map/level1';

export type Shape = 'circle' | 'triangle' | 'square';
export const SHAPES: readonly Shape[] = ['circle', 'triangle', 'square'];
export type EventType = 'FLOOD' | 'RELOCATE' | 'RUSH';

export interface Station { id: number; x: number; y: number; tx: number; ty: number; shape: Shape; queue: Shape[]; crowdTime: number; rush: boolean }
export interface Train { seg: number; f: number; dir: 1 | -1; cargo: Shape[]; capacity: number; wait: number }
export interface Line { id: number; stops: number[]; train: Train }
export type GameEvent =
  | { type: 'FLOOD'; x: number; y: number; r: number; left: number }
  | { type: 'RELOCATE'; stationId: number; left: number }
  | { type: 'RUSH'; stationId: number; left: number };
export type Status = 'playing' | 'lost';
export type SimSignal = 'deliver' | 'warning' | 'eventStart' | 'lost' | 'upgradeOffer' | 'upgradeTaken' | 'needCrossing';
/** 只读的送达事件：某次停靠时在 stationId 站真正下车的乘客数（n>0）。渲染层用 drainDeliveries 读取。 */
export interface Delivered { readonly stationId: number; readonly n: number }
export type Upgrade = 'carriage' | 'line' | 'bridge' | 'tunnel';
export const UPGRADES: readonly Upgrade[] = ['carriage', 'line', 'bridge', 'tunnel'];

export interface Game {
  cfg: Config; rng: Rng; placeRng: Rng; t: number; status: Status;
  stations: Station[]; lines: Line[]; events: GameEvent[];
  warning: GameEvent | null; eventTimer: number; stationTimer: number;
  delivered: number; upgradesGiven: number; upgradeOffer: boolean;
  maxLines: number; carriages: number; bridges: number; bridged: Set<string>; tunnels: number; tunneled: Set<string>;
  upgradeChoices: Upgrade[];
  eventLog: EventType[]; nextId: number; signals: SimSignal[]; deliveries: Delivered[];
}

export function createGame(seed = Date.now(), cfg: Config = CONFIG): Game {
  const g: Game = {
    cfg, rng: makeRng(seed), placeRng: makeRng(seed ^ 0x9e3779b9), t: 0, status: 'playing', stations: [], lines: [], events: [],
    warning: null, eventTimer: cfg.eventInterval.start, stationTimer: cfg.stationSpawn.start,
    delivered: 0, upgradesGiven: 0, upgradeOffer: false,
    maxLines: cfg.startLines, carriages: 0, bridges: cfg.startBridges, bridged: new Set(), tunnels: cfg.startTunnels, tunneled: new Set(), upgradeChoices: [], eventLog: [], nextId: 0, signals: [], deliveries: [],
  };
  for (let i = 0; i < cfg.initialStations; i++) addStation(g, SHAPES[i % SHAPES.length]);
  return g;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const range = (g: Game, a: number, b: number) => a + g.rng() * (b - a);
export const stationById = (g: Game, id: number) => g.stations.find(s => s.id === id);

/** 站点只能放在陆地上：不在河/海里、离河道够远、整个站点圆不碰水、不贴棋盘边。 */
export function stationSpotOk(cfg: Config, x: number, y: number): boolean {
  const { width: W, height: H, stationEdgeMargin: m, stationRadius: r } = cfg;
  if (x < m || x > W - m || y < 130 || y > H - m) return false;
  if (distToRiver({ x, y }) < cfg.stationRiverMargin) return false;
  return ![[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].some(([dx, dy]) => isWater({ x: x + dx, y: y + dy }));
}

function freeSpot(g: Game, ignore?: Station): { x: number; y: number } | null {
  const { width: W, height: H, minStationGap, stationEdgeMargin: m } = g.cfg;
  const ok = (x: number, y: number) => stationSpotOk(g.cfg, x, y) && !pointFlooded(g, x, y)
    && g.stations.every(s => s === ignore || dist(s.x, s.y, x, y) > minStationGap);
  for (let k = 0; k < g.cfg.stationSpawnAttempts; k++) {
    const x = m + g.placeRng() * (W - 2 * m), y = 130 + g.placeRng() * (H - m - 130);
    if (ok(x, y)) return { x, y };
  }
  // 确定性兜底：按网格扫描第一个合法位置
  for (let y = 130; y <= H - m; y += 10) for (let x = m; x <= W - m; x += 10) if (ok(x, y)) return { x, y };
  return null;
}

export function addStation(g: Game, shape?: Shape): Station | null {
  const p = freeSpot(g);
  if (!p) return null;
  const r = g.rng();
  const s: Station = { id: g.nextId++, ...p, tx: p.x, ty: p.y, shape: shape ?? (r < 0.6 ? 'circle' : r < 0.8 ? 'triangle' : 'square'), queue: [], crowdTime: 0, rush: false };
  g.stations.push(s);
  return s;
}

export function pointFlooded(g: Game, x: number, y: number): boolean {
  return g.events.some(e => e.type === 'FLOOD' && dist(x, y, e.x, e.y) < e.r);
}
export const stationFlooded = (g: Game, s: Station) => pointFlooded(g, s.x, s.y);
export const segKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export function segmentFlooded(g: Game, a: { x: number; y: number; id?: number }, b: { x: number; y: number; id?: number }): boolean {
  if (a.id !== undefined && b.id !== undefined && g.bridged.has(segKey(a.id, b.id))) return false;
  const r = route(a, b);
  for (let k = 0; k <= 20; k++) { const p = pointAt(r, k / 20); if (pointFlooded(g, p.x, p.y)) return true; }
  return false;
}

export type ConnectResult = 'ok' | 'same' | 'flooded' | 'maxLines' | 'needCrossing';
/**
 * 穿过洪水的连线消耗一座桥；桥上的线段不再被洪水切断。
 * 过河（LEVEL1 水域）的连线消耗一条隧道，没有隧道时用桥；都没有则拒绝并发出 needCrossing。
 */
export function connect(g: Game, a: Station, b: Station): ConnectResult {
  if (a === b) return 'same';
  if (stationFlooded(g, a) || stationFlooded(g, b)) return 'flooded';
  const needsBridge = segmentFlooded(g, a, b);
  if (needsBridge && g.bridges <= 0) return 'flooded';
  const water = !needsBridge && route(a, b).legs.some(l => segmentCrossesWater(l.a, l.b));
  const use: 'bridge' | 'tunnel' | null = needsBridge ? 'bridge' : !water ? null : g.tunnels > 0 ? 'tunnel' : g.bridges > 0 ? 'bridge' : null;
  if (water && !use) { g.signals.push('needCrossing'); return 'needCrossing'; }
  const r = attach(g, a, b);
  if (r === 'ok' && use === 'bridge') { g.bridges--; g.bridged.add(segKey(a.id, b.id)); }
  if (r === 'ok' && use === 'tunnel') { g.tunnels--; g.tunneled.add(segKey(a.id, b.id)); }
  return r;
}
function attach(g: Game, a: Station, b: Station): ConnectResult {
  const tail = g.lines.find(l => l.stops[l.stops.length - 1] === a.id && !l.stops.includes(b.id));
  if (tail) { tail.stops.push(b.id); return 'ok'; }
  const head = g.lines.find(l => l.stops[0] === a.id && !l.stops.includes(b.id));
  if (head) { head.stops.unshift(b.id); head.train.seg++; return 'ok'; }
  if (g.lines.length >= g.maxLines) return 'maxLines';
  g.lines.push({ id: g.lines.length, stops: [a.id, b.id], train: { seg: 0, f: 0, dir: 1, cargo: [], capacity: g.cfg.carriageCapacity, wait: 0.5 } });
  return 'ok';
}

/** 领取三选一升级。车厢先存着，之后点一条线装上。 */
export function takeUpgrade(g: Game, u: Upgrade): boolean {
  if (!g.upgradeOffer || !g.upgradeChoices.includes(u)) return false;
  if (u === 'line' && g.maxLines >= g.cfg.maxLinesCap) return false;
  if (u === 'carriage') g.carriages++;
  else if (u === 'line') g.maxLines++;
  else if (u === 'bridge') g.bridges++;
  else g.tunnels++;
  g.upgradeOffer = false;
  g.signals.push('upgradeTaken');
  return true;
}
export function addCarriage(g: Game, lineId: number): boolean {
  const l = g.lines[lineId];
  if (!l || g.carriages <= 0) return false;
  l.train.capacity += g.cfg.carriageCapacity;
  g.carriages--;
  return true;
}
export function eventInterval(g: Game): number {
  const e = g.cfg.eventInterval;
  return Math.max(e.min, e.start - (g.t / 60) * e.shrinkPerMinute);
}

function spawnPassenger(g: Game, s: Station) {
  if (stationFlooded(g, s)) return;
  const others = [...new Set(g.stations.map(o => o.shape))].filter(h => h !== s.shape);
  if (others.length) s.queue.push(others[Math.floor(g.rng() * others.length)]);
}

function pickEvent(g: Game): GameEvent {
  const { flood, rush } = g.cfg;
  // 必败约束：暴增只落在不拥挤的站上；没有这样的站就不抽暴增
  const calm = g.stations.filter(s => s.queue.length <= g.cfg.crowdLimit / 2);
  const types = calm.length ? (['FLOOD', 'RELOCATE', 'RUSH'] as const) : (['FLOOD', 'RELOCATE'] as const);
  const type = types[Math.floor(g.rng() * types.length)];
  const any = g.stations[Math.floor(g.rng() * g.stations.length)];
  if (type === 'FLOOD') return { type, x: any.x + range(g, -30, 30), y: any.y + range(g, -30, 30), r: flood.radius, left: flood.duration };
  if (type === 'RELOCATE') return { type, stationId: any.id, left: 0 };
  return { type, stationId: calm[Math.floor(g.rng() * calm.length)].id, left: rush.duration };
}

function startEvent(g: Game, e: GameEvent) {
  g.eventLog.push(e.type);
  g.signals.push('eventStart');
  if (e.type === 'RELOCATE') {
    const s = stationById(g, e.stationId);
    const p = s && freeSpot(g, s);
    if (s && p) { s.tx = p.x; s.ty = p.y; }
    return;
  }
  if (e.type === 'RUSH') { const s = stationById(g, e.stationId); if (s) s.rush = true; }
  g.events.push(e);
}

function arrive(g: Game, t: Train, s: Station, stops: Station[]) {
  if (stationFlooded(g, s)) return;
  const before = t.cargo.length;
  t.cargo = t.cargo.filter(p => p !== s.shape);
  const n = before - t.cargo.length;
  if (n) { g.delivered += n; g.signals.push('deliver'); g.deliveries.push({ stationId: s.id, n }); }
  const reach = new Set(stops.filter(o => o !== s).map(o => o.shape));
  s.queue = s.queue.filter(p => {
    if (t.cargo.length < t.capacity && reach.has(p)) { t.cargo.push(p); return false; }
    return true;
  });
}

function stepTrain(g: Game, l: Line, dt: number) {
  const S = l.stops.map(id => stationById(g, id)!).filter(Boolean);
  if (S.length < 2) return;
  const t = l.train;
  if (t.seg >= S.length - 1) { t.seg = S.length - 2; t.f = 1; }
  if (t.wait > 0) { t.wait -= dt; return; }
  const a = S[t.seg], b = S[t.seg + 1];
  const path = route(a, b), len = routeLength(path) || 1;
  const nf = t.f + t.dir * g.cfg.trainSpeed * dt / len;
  const bridged = g.bridged.has(segKey(a.id, b.id));
  const inFlood = (f: number) => { if (bridged) return false; const p = pointAt(path, f); return pointFlooded(g, p.x, p.y); };
  if (inFlood(nf + t.dir * 14 / len) && !inFlood(t.f)) { t.dir = t.dir === 1 ? -1 : 1; t.wait = 0.3; return; }
  t.f = nf;
  if (t.f >= 1 || t.f <= 0) {
    const at = t.f >= 1 ? t.seg + 1 : t.seg;
    t.f = t.f >= 1 ? 1 : 0;
    arrive(g, t, S[at], S);
    if (t.dir > 0) { if (at >= S.length - 1) t.dir = -1; else { t.seg = at; t.f = 0; } }
    else { if (at <= 0) t.dir = 1; else { t.seg = at - 1; t.f = 1; } }
    t.wait = 0.4;
  }
}

export function passengerRate(g: Game): number {
  const { base, perSecond } = g.cfg.passengerRate;
  const r = base + g.t * perSecond;
  return g.t < g.cfg.passengerRateGraceSeconds ? r / 2 : r;
}

export function step(g: Game, dt: number): void {
  if (g.status !== 'playing') return;
  const c = g.cfg;
  g.t += dt;

  g.stationTimer -= dt;
  if (g.stationTimer <= 0 && g.stations.length < c.maxStations) {
    addStation(g);
    g.stationTimer = Math.max(c.stationSpawn.min, c.stationSpawn.start - g.t / c.stationSpawn.ramp);
  }
  if (g.t >= (g.upgradesGiven + 1) * c.upgradeInterval) {
    g.upgradesGiven++;
    if (!g.upgradeOffer) {
      // 三选一：车厢、新线，外加桥或隧道之一
      g.upgradeChoices = ['carriage', 'line', g.rng() < 0.5 ? 'bridge' : 'tunnel'];
      g.upgradeOffer = true; g.signals.push('upgradeOffer');
    }
  }

  const rate = passengerRate(g);
  for (const s of g.stations) {
    const k = Math.min(1, dt * 4);
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
    if (g.rng() < rate * dt * (s.rush ? c.rush.multiplier : 1)) spawnPassenger(g, s);
    if (stationFlooded(g, s)) continue; // 冻结：不计拥挤
    if (s.queue.length > c.crowdLimit) s.crowdTime += dt;
    else s.crowdTime = Math.max(0, s.crowdTime - dt * 2);
  }
  for (const l of g.lines) stepTrain(g, l, dt);

  g.eventTimer -= dt;
  if (!g.warning && g.eventTimer <= c.eventWarning) { g.warning = pickEvent(g); g.signals.push('warning'); }
  if (g.eventTimer <= 0 && g.warning) { startEvent(g, g.warning); g.warning = null; g.eventTimer = eventInterval(g); }
  for (const e of g.events) {
    e.left -= dt;
    if (e.left <= 0 && e.type === 'RUSH') { const s = stationById(g, e.stationId); if (s) s.rush = false; }
  }
  g.events = g.events.filter(e => e.left > 0);

  if (g.stations.some(s => s.crowdTime >= c.crowdFailSeconds)) { g.status = 'lost'; g.signals.push('lost'); }
}

/** 取走并清空本帧累积的送达事件（按发生顺序）。 */
export function drainDeliveries(g: Game): Delivered[] { const d = g.deliveries; g.deliveries = []; return d; }
/** 取出并清空本帧信号（给音效/特效用）。 */
export function drainSignals(g: Game): SimSignal[] { const s = g.signals; g.signals = []; return s; }
