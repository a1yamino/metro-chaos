import { CONFIG } from './config';
import { PALETTE as P } from './art/palette';
import { playClear, playDeliver, playWarning, unlockAudio } from './audio/sfx';
import { addCarriage, connect, createGame, drainSignals, segmentFlooded, stationById, stationFlooded, step, type Game, type Shape, type Station } from './sim';

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
const EV_LABEL = { FLOOD: '🌊 洪水', RELOCATE: '🏗 站点搬迁', RUSH: '👥 客流暴增' } as const;

function restart() { g = createGame(Date.now()); pops = []; drag = null; placingCarriage = false; }

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
  if (g.t < 10) return '站上乘客超过 6 人会变红，红满 10 秒就输';
  return `每 ${CONFIG.eventInterval} 秒有一次突变，提前 ${CONFIG.eventWarning} 秒预警`;
}

function draw() {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  for (const e of g.events) if (e.type === 'FLOOD') {
    ctx.globalAlpha = 0.28; ctx.fillStyle = P.flood; circle(e.x, e.y, e.r); ctx.fill(); ctx.globalAlpha = 1;
  }
  const w = g.warning;
  if (w?.type === 'FLOOD') {
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(g.t * 12); ctx.strokeStyle = P.flood; ctx.lineWidth = 3; ctx.setLineDash([4, 8]);
    circle(w.x, w.y, w.r); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const l of g.lines) {
    const S = l.stops.map(id => stationById(g, id)!);
    for (let i = 0; i < S.length - 1; i++) {
      const broken = segmentFlooded(g, S[i], S[i + 1]);
      ctx.strokeStyle = P.lines[l.id]; ctx.globalAlpha = broken ? 0.35 : 1; ctx.lineWidth = placingCarriage ? 11 : 7;
      if (broken) ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(S[i].x, S[i].y); ctx.lineTo(S[i + 1].x, S[i + 1].y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  if (drag) {
    ctx.strokeStyle = drag.bad ? P.danger : P.muted; ctx.lineWidth = 5; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(drag.s.x, drag.s.y); ctx.lineTo(drag.x, drag.y); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const l of g.lines) {
    const S = l.stops.map(id => stationById(g, id)!), t = l.train;
    const a = S[t.seg], b = S[Math.min(t.seg + 1, S.length - 1)];
    const cars = t.capacity / CONFIG.carriageCapacity, len = 28 + (cars - 1) * 16;
    ctx.save(); ctx.translate(a.x + (b.x - a.x) * t.f, a.y + (b.y - a.y) * t.f); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    ctx.fillStyle = P.lines[l.id]; ctx.fillRect(-len / 2, -8, len, 16);
    t.cargo.forEach((c, k) => shape(-len / 2 + 5 + (k % (3 * cars)) * 9 * (len / (27 * cars)) , -3.5 + Math.floor(k / (3 * cars)) * 7, c, 2.6, P.white));
    ctx.restore();
  }
  for (const s of g.stations) {
    const off = stationFlooded(g, s);
    if (s.rush) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(g.t * 8); ctx.fillStyle = P.rush; circle(s.x, s.y, 26); ctx.fill(); ctx.globalAlpha = 1; }
    if (w && w.type !== 'FLOOD' && w.stationId === s.id) { ctx.strokeStyle = P.warning; ctx.lineWidth = 2; circle(s.x, s.y, 22 + 4 * Math.sin(g.t * 12)); ctx.stroke(); }
    if (s.crowdTime > 0) {
      ctx.strokeStyle = off ? P.flood : P.danger; ctx.lineWidth = 5; ctx.beginPath();
      ctx.arc(s.x, s.y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.crowdTime / CONFIG.crowdFailSeconds); ctx.stroke();
    }
    shape(s.x, s.y, s.shape, CONFIG.stationRadius, off ? '#cfe0f5' : P.white, off ? P.floodDeep : P.ink);
    s.queue.forEach((p, k) => shape(s.x + 18 + (k % 6) * 9, s.y - 8 + Math.floor(k / 6) * 9, p, 3.5, off ? P.flood : s.queue.length > CONFIG.crowdLimit ? P.danger : P.ink));
  }
  for (const p of pops) { ctx.globalAlpha = Math.max(0, p.a); text(p.text, p.x, p.y, 'bold 16px sans-serif', p.color); ctx.globalAlpha = 1; }

  // HUD
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(0, 0, W, 64);
  text(`🚇 ${g.delivered}/${CONFIG.goal}`, 16, 40, 'bold 22px sans-serif', P.ink, 'left');
  text(`下个突变 ${Math.ceil(g.eventTimer)}s`, W - 16, 28, '14px sans-serif', P.ink, 'right');
  text(`线路 ${g.lines.length}/${CONFIG.maxLines}`, W - 16, 48, '14px sans-serif', P.ink, 'right');
  ctx.fillStyle = '#e5e5e5'; ctx.fillRect(16, 52, 150, 5);
  ctx.fillStyle = P.good; ctx.fillRect(16, 52, 150 * Math.min(1, g.delivered / CONFIG.goal), 5);
  const active = g.events[0];
  const banner = w ? `⚠ ${EV_LABEL[w.type]} ${Math.ceil(g.eventTimer)}s` : active ? `${EV_LABEL[active.type]} ${Math.ceil(active.left)}s` : null;
  if (banner) { ctx.fillStyle = w ? P.warning : P.floodDeep; ctx.fillRect(0, 64, W, 34); text(banner, W / 2, 87, 'bold 16px sans-serif', P.white); }

  if (g.pendingCarriages > 0 && g.status === 'playing') {
    const b = CARRIAGE_BTN;
    ctx.fillStyle = placingCarriage ? P.warning : P.ink; ctx.fillRect(b.x, b.y, b.w, b.h);
    text(placingCarriage ? '点一条线' : `+车厢 ×${g.pendingCarriages}`, b.x + b.w / 2, b.y + 28, 'bold 15px sans-serif', P.white);
  }
  const hint = g.status === 'playing' ? tutorialHint() : null;
  if (hint) { ctx.fillStyle = 'rgba(34,34,34,0.85)'; ctx.fillRect(16, H - 120, W - 32, 40); text(hint, W / 2, H - 94, '15px sans-serif', P.white); }

  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (g.status !== 'playing') drawResults();
}

function drawResults() {
  ctx.fillStyle = P.overlay; ctx.fillRect(0, 0, W, H);
  const won = g.status === 'won';
  text(won ? '第一关通过！' : '站点瘫痪', W / 2, H / 2 - 110, 'bold 34px sans-serif', P.white);
  text(`送达 ${g.delivered} 人 · 用时 ${Math.floor(g.t / 60)}:${String(Math.floor(g.t % 60)).padStart(2, '0')}`, W / 2, H / 2 - 60, '20px sans-serif', P.white);
  const counts = g.eventLog.reduce<Record<string, number>>((m, e) => ((m[e] = (m[e] ?? 0) + 1), m), {});
  const evs = (Object.keys(EV_LABEL) as (keyof typeof EV_LABEL)[]).filter(k => counts[k]).map(k => `${EV_LABEL[k]} ×${counts[k]}`);
  text('经历的突变', W / 2, H / 2 - 16, '16px sans-serif', '#ccc');
  (evs.length ? evs : ['无']).forEach((e, i) => text(e, W / 2, H / 2 + 12 + i * 24, '17px sans-serif', P.white));
  ctx.fillStyle = P.white; ctx.fillRect(W / 2 - 80, H / 2 + 110, 160, 50);
  text('重新开始', W / 2, H / 2 + 142, 'bold 18px sans-serif', P.ink);
}

function update(dt: number) {
  step(g, dt);
  for (const s of drainSignals(g)) {
    if (s === 'deliver') playDeliver();
    else if (s === 'warning') playWarning();
    else if (s === 'won') playClear();
    else if (s === 'eventStart' || s === 'lost') flash = 1;
    else if (s === 'carriage') pop(W / 2, H - 140, '获得 1 节车厢！', P.good);
  }
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
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1], dx = b.x - a.x, dy = b.y - a.y;
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
  if (g.pendingCarriages > 0 && inBtn(p, CARRIAGE_BTN)) { placingCarriage = !placingCarriage; return; }
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
  const r = connect(g, drag.s, s);
  if (r === 'ok') drag.s = s;
  else if (!drag.warned) { drag.warned = true; pop(p.x, p.y - 20, r === 'flooded' ? '不能穿过洪水' : r === 'maxLines' ? `最多 ${CONFIG.maxLines} 条线` : '', P.danger); }
}
const up = () => { drag = null; };
cv.addEventListener('mousedown', down); addEventListener('mousemove', move); addEventListener('mouseup', up);
cv.addEventListener('touchstart', down, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', up);

let last = performance.now();
function loop(now: number) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
(window as unknown as { __game: () => Game }).__game = () => g;
