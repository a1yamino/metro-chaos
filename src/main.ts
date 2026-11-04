import { drawBasemap } from './art/basemap';
import { drawCrossing } from './art/crossing';
import { burstAt, drawParticles, drawPopRing, stationPose, updateStationFx } from './art/stations';
import { drawMutationsOver, drawMutationsUnder, updateMutationFx } from './art/mutations';
import { drawTrain, resetTrainFx, smoothAngle } from './art/trains';
import { CONFIG } from './config';
import { LEVEL1 } from './map/level1';
import { PALETTE as P } from './art/palette';
import { playBridge, playDeliver, playGameOver, playTunnel, playUpgrade, playWarning, unlockAudio } from './audio/sfx';
import { pointAt, route, type Route } from './route';
import { segmentCrossesWater } from './map/level1';
import { addCarriage, connect, takeUpgrade, type Upgrade, createGame, drainDeliveries, drainSignals, segKey, segmentFlooded, stationById, stationFlooded, step, type Game, type Shape, type Station } from './sim';

const { width: W, height: H } = CONFIG;
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H), d = devicePixelRatio || 1;
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
}
addEventListener('resize', fit); fit();

const seedParam = new URLSearchParams(location.search).get('seed');
let g: Game = createGame(seedParam ? Number(seedParam) : Date.now());
interface Pop { x: number; y: number; text: string; color: string; a: number }
let pops: Pop[] = [];
let flash = 0;
let drag: { s: Station; x: number; y: number; bad: boolean; warned: boolean } | null = null;
let placingCarriage = false;
const pop = (x: number, y: number, text: string, color: string = P.ink) => pops.push({ x, y, text, color, a: 1 });
const lineColor = (id: number) => P.lines[id % P.lines.length];
const BEST_KEY = 'metro-chaos:best';
const readBest = () => Number(localStorage.getItem(BEST_KEY) ?? 0);
let best = readBest();
let newBest = false;
const UP_LABEL: Record<Upgrade, string> = { carriage: '🚃 车厢', line: '➕ 新线', bridge: '🌉 桥', tunnel: '🚇 隧道' };
const UP_DESC: Record<Upgrade, string> = { carriage: '一条线载客 +6', line: '可多建一条线', bridge: '一段线可过河或穿过洪水', tunnel: '一段线可从河底穿过' };
const upgradeBtn = (i: number) => ({ x: 30, y: 300 + i * 90, w: W - 60, h: 74 });
const EV_LABEL = { FLOOD: '🌊 洪水', RELOCATE: '🏗 站点搬迁', RUSH: '👥 客流暴增' } as const;

function restart() { g = createGame(Date.now()); pops = []; resetTrainFx(); drag = null; placingCarriage = false; newBest = false; }

function shape(x: number, y: number, sh: Shape, r: number, fill?: string, stroke?: string, lw = 3) {
  ctx.beginPath();
  if (sh === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (sh === 'square') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r, y + r * 0.75); ctx.lineTo(x - r, y + r * 0.75); ctx.closePath(); }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
const circle = (x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
function text(t: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(t, x, y);
}

const CARRIAGE_BTN = { x: W - 132, y: H - 64, w: 116, h: 44 };
function tutorialHint(): string | null {
  if (g.t > CONFIG.tutorialSeconds) return null;
  if (!g.lines.length) return '从一个站拖到另一个站，连出第一条线';
  if (g.delivered === 0) return '列车把乘客送到同形状的站就算送达';
  if (g.t < 10) return '站上乘客超过 6 人会变红，红满 10 秒结束';
  return `每隔一段时间有突变，提前 ${CONFIG.eventWarning} 秒预警`;
}

/** 画一条地铁图折线：直线腿 + arcTo 圆角。 */
function strokeRoute(r: Route) {
  const [a, c, b] = r.legs.length === 2 ? [r.legs[0].a, r.legs[0].b, r.legs[1].b] : [r.legs[0].a, null, r.legs[0].b];
  ctx.beginPath(); ctx.moveTo(a.x, a.y);
  if (c && r.arc) ctx.arcTo(c.x, c.y, b.x, b.y, r.arc.r);
  ctx.lineTo(b.x, b.y); ctx.stroke();
}

let lastTrainT = 0;
function draw() {
  drawBasemap(ctx, LEVEL1, g.t);
  drawMutationsUnder(ctx, g);
  const w = g.warning;
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const l of g.lines) {
    const S = l.stops.map(id => stationById(g, id)!);
    for (let i = 0; i < S.length - 1; i++) {
      const broken = segmentFlooded(g, S[i], S[i + 1]);
      ctx.strokeStyle = lineColor(l.id); ctx.globalAlpha = broken ? 0.35 : 1; ctx.lineWidth = placingCarriage ? 11 : 7;
      if (broken) ctx.setLineDash([8, 8]);
      const r = route(S[i], S[i + 1]);
      strokeRoute(r);
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      const k = segKey(S[i].id, S[i + 1].id);
      const kind = broken ? null : g.tunneled.has(k) ? 'tunnel' : g.bridged.has(k) ? 'bridge' : null;
      if (kind) for (const leg of r.legs) if (segmentCrossesWater(leg.a, leg.b)) drawCrossing(ctx, leg.a, leg.b, kind, lineColor(l.id));
    }
  }
  if (drag) {
    ctx.strokeStyle = drag.bad ? P.danger : P.muted; ctx.lineWidth = 5; ctx.setLineDash([6, 6]);
    strokeRoute(route(drag.s, drag)); ctx.setLineDash([]);
  }
  for (const l of g.lines) {
    const S = l.stops.map(id => stationById(g, id)!), t = l.train;
    const a = S[t.seg], b = S[Math.min(t.seg + 1, S.length - 1)];
    const cars = t.capacity / CONFIG.carriageCapacity;
    const at = pointAt(route(a, b), t.f);
    drawTrain(ctx, at.x, at.y, smoothAngle(l.id, at.angle, g.t - lastTrainT), lineColor(l.id), cars, t.cargo);
  }
  lastTrainT = g.t;
  drawMutationsOver(ctx, g);
  for (const s of g.stations) {
    const off = stationFlooded(g, s);
    if (s.rush) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(g.t * 8); ctx.fillStyle = P.rush; circle(s.x, s.y, 26); ctx.fill(); ctx.globalAlpha = 1; }
    if (s.crowdTime > 0) {
      ctx.strokeStyle = off ? P.flood : P.danger; ctx.lineWidth = 5; ctx.beginPath();
      ctx.arc(s.x, s.y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.crowdTime / CONFIG.crowdFailSeconds); ctx.stroke();
    }
    const ps = stationPose(s, g.t), sx = s.x + ps.dx, sy = s.y + ps.dy;
    drawPopRing(ctx, s.x, s.y, ps.ring);
    shape(sx, sy, s.shape, CONFIG.stationRadius * ps.k, off ? '#cfe0f5' : P.white, off ? P.floodDeep : P.ink);
    s.queue.forEach((p, k) => shape(s.x + 18 + (k % 6) * 9, s.y - 8 + Math.floor(k / 6) * 9, p, 3.5, off ? P.flood : s.queue.length > CONFIG.crowdLimit ? P.danger : P.ink));
  }
  drawParticles(ctx);
  for (const p of pops) { ctx.globalAlpha = Math.max(0, p.a); text(p.text, p.x, p.y, 'bold 16px sans-serif', p.color); ctx.globalAlpha = 1; }

  // HUD
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(0, 0, W, 64);
  text(`🚇 ${g.delivered}`, 16, 40, 'bold 22px sans-serif', P.ink, 'left');
  text(`最高 ${best} · ${fmtTime(g.t)} · 🌉${g.bridges} 🚇${g.tunnels}`, 16, 58, '12px sans-serif', P.muted, 'left');
  text(`下个突变 ${Math.ceil(g.eventTimer)}s`, W - 16, 28, '14px sans-serif', P.ink, 'right');
  text(`线路 ${g.lines.length}/${g.maxLines}`, W - 16, 48, '14px sans-serif', P.ink, 'right');
  const active = g.events[0];
  const banner = w ? `⚠ ${EV_LABEL[w.type]} ${Math.ceil(g.eventTimer)}s` : active ? `${EV_LABEL[active.type]} ${Math.ceil(active.left)}s` : null;
  if (banner) { ctx.fillStyle = w ? P.warning : P.floodDeep; ctx.fillRect(0, 64, W, 34); text(banner, W / 2, 87, 'bold 16px sans-serif', P.white); }

  if (g.carriages > 0 && g.status === 'playing') {
    const b = CARRIAGE_BTN;
    ctx.fillStyle = placingCarriage ? P.warning : P.ink; ctx.fillRect(b.x, b.y, b.w, b.h);
    text(placingCarriage ? '点一条线' : `+车厢 ×${g.carriages}`, b.x + b.w / 2, b.y + 28, 'bold 15px sans-serif', P.white);
  }
  const hint = g.status === 'playing' ? tutorialHint() : null;
  if (hint) { ctx.fillStyle = 'rgba(34,34,34,0.85)'; ctx.fillRect(16, H - 120, W - 32, 40); text(hint, W / 2, H - 94, '15px sans-serif', P.white); }

  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (g.upgradeOffer && g.status === 'playing') drawUpgrades();
  if (g.status !== 'playing') drawResults();
}

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const upgradeOk = (u: Upgrade) => u !== 'line' || g.maxLines < CONFIG.maxLinesCap;
function drawUpgrades() {
  ctx.fillStyle = P.overlay; ctx.fillRect(0, 0, W, H);
  text('选一个升级', W / 2, 260, 'bold 26px sans-serif', P.white);
  g.upgradeChoices.forEach((u, i) => {
    const b = upgradeBtn(i), ok = upgradeOk(u);
    ctx.globalAlpha = ok ? 1 : 0.4; ctx.fillStyle = P.white; ctx.fillRect(b.x, b.y, b.w, b.h);
    text(UP_LABEL[u], b.x + 20, b.y + 32, 'bold 20px sans-serif', P.ink, 'left');
    text(ok ? UP_DESC[u] : '线路已达上限', b.x + 20, b.y + 56, '14px sans-serif', P.muted, 'left');
    ctx.globalAlpha = 1;
  });
}

function drawResults() {
  ctx.fillStyle = P.overlay; ctx.fillRect(0, 0, W, H);
  text('站点瘫痪', W / 2, H / 2 - 150, 'bold 34px sans-serif', P.white);
  text(`${g.delivered} 分`, W / 2, H / 2 - 100, 'bold 30px sans-serif', P.white);
  text(`存活 ${fmtTime(g.t)} · 最高 ${best}${newBest ? ' 🎉 新纪录' : ''}`, W / 2, H / 2 - 60, '18px sans-serif', P.white);
  const counts = g.eventLog.reduce<Record<string, number>>((m, e) => ((m[e] = (m[e] ?? 0) + 1), m), {});
  const evs = (Object.keys(EV_LABEL) as (keyof typeof EV_LABEL)[]).filter(k => counts[k]).map(k => `${EV_LABEL[k]} ×${counts[k]}`);
  text('经历的突变', W / 2, H / 2 - 16, '16px sans-serif', '#ccc');
  (evs.length ? evs : ['无']).forEach((e, i) => text(e, W / 2, H / 2 + 12 + i * 24, '17px sans-serif', P.white));
  ctx.fillStyle = P.white; ctx.fillRect(W / 2 - 80, H / 2 + 110, 160, 50);
  text('重新开始', W / 2, H / 2 + 142, 'bold 18px sans-serif', P.ink);
}

function update(dt: number) {
  if (!g.upgradeOffer) step(g, dt); // 选升级时暂停
  for (const s of drainSignals(g)) {
    if (s === 'deliver') playDeliver();
    else if (s === 'warning') playWarning();
    else if (s === 'upgradeTaken') playUpgrade();
    else if (s === 'eventStart') flash = 1;
    else if (s === 'lost') { flash = 1; playGameOver(); if (g.delivered > best) { best = g.delivered; newBest = true; localStorage.setItem(BEST_KEY, String(best)); } }
  }
  for (const d of drainDeliveries(g)) { const s = stationById(g, d.stationId); if (s) burstAt(s, d.n); }
  updateStationFx(g, dt);
  updateMutationFx(g, dt);
  flash = Math.max(0, flash - dt * 1.5);
  for (const p of pops) { p.y -= 20 * dt; p.a -= dt * 0.8; }
  pops = pops.filter(p => p.a > 0);
}

// ---- input
type Pt = { x: number; y: number };
function pt(e: MouseEvent | TouchEvent): Pt {
  const r = cv.getBoundingClientRect();
  const p = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e;
  return { x: (p.clientX - r.left) * W / r.width, y: (p.clientY - r.top) * H / r.height };
}
const hit = (p: Pt) => g.stations.find(s => Math.hypot(s.x - p.x, s.y - p.y) < 26);
function nearestLine(p: Pt): number | null {
  let best: number | null = null, bd = 24;
  for (const l of g.lines) {
    const S = l.stops.map(id => stationById(g, id)!);
    for (let i = 0; i < S.length - 1; i++) for (const leg of route(S[i], S[i + 1]).legs) {
      const { a, b } = leg, dx = b.x - a.x, dy = b.y - a.y;
      const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(p.x - a.x - dx * k, p.y - a.y - dy * k);
      if (d < bd) { bd = d; best = l.id; }
    }
  }
  return best;
}
const inBtn = (p: Pt, b: { x: number; y: number; w: number; h: number }) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

function down(e: MouseEvent | TouchEvent) {
  e.preventDefault(); unlockAudio();
  const p = pt(e);
  if (g.status !== 'playing') { if (inBtn(p, { x: W / 2 - 80, y: H / 2 + 110, w: 160, h: 50 })) restart(); return; }
  if (g.upgradeOffer) { g.upgradeChoices.forEach((u, i) => { if (inBtn(p, upgradeBtn(i)) && upgradeOk(u)) takeUpgrade(g, u); }); return; }
  if (g.carriages > 0 && inBtn(p, CARRIAGE_BTN)) { placingCarriage = !placingCarriage; return; }
  if (placingCarriage) {
    const id = nearestLine(p);
    if (id !== null && addCarriage(g, id)) { pop(p.x, p.y - 20, '+车厢', P.good); placingCarriage = false; }
    return;
  }
  const s = hit(p);
  if (s) drag = { s, x: p.x, y: p.y, bad: false, warned: false };
}
function move(e: MouseEvent | TouchEvent) {
  if (!drag) return;
  e.preventDefault();
  const p = pt(e);
  drag.x = p.x; drag.y = p.y; drag.bad = segmentFlooded(g, drag.s, p);
  const s = hit(p);
  if (!s || s === drag.s) return;
  const nb = g.bridges, nt = g.tunnels, r = connect(g, drag.s, s);
  if (r === 'ok') { drag.s = s; if (g.tunnels < nt) playTunnel(); else if (g.bridges < nb) playBridge(); }
  else if (!drag.warned) { drag.warned = true; pop(p.x, p.y - 20, r === 'flooded' ? '不能穿过洪水（需要桥）' : r === 'maxLines' ? `最多 ${g.maxLines} 条线` : r === 'needCrossing' ? '过河需要桥或隧道（已用完）' : '', P.danger); }
}
const up = () => { drag = null; };
cv.addEventListener('mousedown', down); addEventListener('mousemove', move); addEventListener('mouseup', up);
cv.addEventListener('touchstart', down, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', up);

let last = performance.now();
function loop(now: number) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
(window as unknown as { __game: () => Game }).__game = () => g;
