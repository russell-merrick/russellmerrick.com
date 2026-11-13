// Russell Merrick — Avatar. Everything here runs in the browser. The camera picture never leaves the device:
// frames go to an on-device face finder (MediaPipe, vendored in ./vendor) and only a handful of numbers are kept.
"use strict";
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const KEY = "rm-avatar";

// ================= palettes =================
const SKIN = [[255, 224, 196], [247, 208, 172], [236, 188, 150], [222, 166, 124], [198, 140, 98], [170, 112, 76], [138, 88, 60], [104, 66, 46], [78, 50, 36]];
const HAIR = [[24, 20, 20], [58, 38, 28], [96, 62, 38], [138, 92, 52], [168, 74, 40], [214, 170, 98], [236, 214, 160], [150, 146, 142], [228, 226, 222], [226, 96, 140], [72, 108, 196]];
const EYE = [[52, 34, 24], [96, 62, 36], [128, 104, 52], [70, 112, 66], [64, 110, 170], [110, 124, 136]];
const SHIRT = [[232, 162, 58], [255, 107, 74], [255, 143, 163], [58, 209, 200], [124, 140, 255], [40, 48, 66]];
const STYLES = ["short", "side", "buzz", "medium", "long", "curly", "bun", "spiky", "bald"];
const FACES = { oval: [1, 1, 0.45, 0.55], round: [1.08, 0.94, 0.75, 0.25], long: [0.93, 1.1, 0.4, 0.6], square: [1.04, 1, 1, 0.3], heart: [1.02, 1, 0.2, 0.85] }; // faceW, faceH, jaw, chin
const EYES = { close: 0.34, medium: 0.41, wide: 0.48 };
const BEARDS = ["none", "stubble", "full", "mustache"];
const GLASSES = ["none", "round", "square"];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const shade = (c, k) => k >= 0 ? c.map(v => v + (255 - v) * k) : c.map(v => v * (1 + k));
const cdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const nearest = (c, pal) => pal.reduce((best, p) => cdist(c, p) < cdist(c, best) ? p : best, pal[0]);
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const pick = a => a[(Math.random() * a.length) | 0];

function defaultAvatar() { return { v: 1, skin: SKIN[2], hair: HAIR[1], brow: shade(HAIR[1], -0.2), style: "short", faceW: 1, faceH: 1, jaw: 0.45, chin: 0.55, eyeSep: 0.41, eyeSize: 1, eyeOpen: 1, eyeColor: EYE[1], noseW: 1, mouthW: 1, lip: 1, beard: 0, beardStyle: "none", beardColor: HAIR[1], glasses: "none", shirt: SHIRT[0], faceName: "oval", eyesName: "medium", source: "manual" }; }
function randomAvatar() {
  const a = defaultAvatar(), f = pick(Object.keys(FACES)), e = pick(Object.keys(EYES)), h = Math.random() < 0.85 ? pick(HAIR.slice(0, 9)) : pick(HAIR);
  Object.assign(a, { skin: pick(SKIN), hair: h, brow: shade(h, -0.2), beardColor: h, style: pick(STYLES), eyeColor: pick(EYE), shirt: pick(SHIRT), glasses: Math.random() < 0.25 ? pick(GLASSES.slice(1)) : "none" });
  const b = Math.random() < 0.3 ? pick(BEARDS.slice(1)) : "none"; setBeard(a, b); setFace(a, f); setEyes(a, e);
  a.eyeSize = 0.9 + Math.random() * 0.25; a.mouthW = 0.85 + Math.random() * 0.3; a.noseW = 0.85 + Math.random() * 0.3; return a;
}
function setFace(a, n) { const f = FACES[n]; a.faceName = n; a.faceW = f[0]; a.faceH = f[1]; a.jaw = f[2]; a.chin = f[3]; }
function setEyes(a, n) { a.eyesName = n; a.eyeSep = EYES[n]; }
function setBeard(a, n) { a.beardStyle = n; a.beard = n === "none" ? 0 : n === "stubble" ? 0.35 : 0.9; }

// ================= storage: parameters only, never pictures =================
function load() { try { const a = JSON.parse(localStorage.getItem(KEY)); if (a && a.v === 1 && Array.isArray(a.skin)) return Object.assign(defaultAvatar(), a); } catch (_) {} return null; }
function save(a) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, a, { savedAt: Date.now() }))); } catch (_) {} }
function forget() { try { localStorage.removeItem(KEY); localStorage.removeItem("rm-avatar-seen"); } catch (_) {} }

let av = load(), returning = !!av;
if (!av) { av = defaultAvatar(); }

// ================= canvas + scene =================
const cv = $("av"), ctx = cv.getContext("2d");
let W = innerWidth, H = innerHeight, dpr = 1;
function resize() { W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
addEventListener("resize", resize); resize();
const stars = Array.from({ length: 90 }, () => [Math.random(), Math.random() * 0.55, Math.random() * 1.2 + 0.3, Math.random() * 6.28]);
function drawScene(t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const horizon = H * 0.62;
  let g = ctx.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, "#0b0d12"); g.addColorStop(0.7, "#141a33"); g.addColorStop(1, "#3a2234"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizon);
  for (const s of stars) { ctx.fillStyle = `rgba(255,236,210,${0.25 + 0.25 * Math.sin(t * 0.8 + s[3])})`; ctx.fillRect(s[0] * W, s[1] * H, s[2], s[2]); }
  // striped retro sun
  const sr = Math.min(W * 0.42, H * 0.3), sx = W / 2, sy = horizon - sr * 0.35;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip();
  g = ctx.createLinearGradient(0, sy - sr, 0, sy + sr); g.addColorStop(0, "#ffd27a"); g.addColorStop(0.45, "#ff9a4a"); g.addColorStop(0.8, "#ff5f6d"); g.addColorStop(1, "#c2407a");
  ctx.shadowColor = "rgba(255,140,70,.45)"; ctx.shadowBlur = 60; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#1c1a33";
  for (let i = 0; i < 7; i++) { const y = sy + sr * (0.08 + i * 0.14), h = 2 + i * 1.6; ctx.fillRect(sx - sr, y, sr * 2, h); }
  ctx.restore();
  // floor + grid
  g = ctx.createLinearGradient(0, horizon, 0, H); g.addColorStop(0, "#22152a"); g.addColorStop(1, "#0b0d12"); ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = "rgba(232,162,58,.28)"; ctx.lineWidth = 1;
  const off = reduced ? 0 : (t * 0.25) % 1;
  for (let i = 0; i < 14; i++) { const z = (i + off) / 14, y = horizon + (H - horizon) * z * z; ctx.globalAlpha = 0.15 + z * 0.85; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.02, horizon); ctx.lineTo(W / 2 + i * W * 0.16, H); ctx.stroke(); }
  g = ctx.createLinearGradient(0, horizon - 2, 0, horizon + 30); g.addColorStop(0, "rgba(255,170,90,.45)"); g.addColorStop(1, "rgba(255,170,90,0)"); ctx.fillStyle = g; ctx.fillRect(0, horizon - 2, W, 32);
}

// ================= avatar drawing =================
// pose: yaw/pitch/roll in radians, blinkL/blinkR (screen left/right), jaw, smile, brow, frown, pucker, wide, lookX, lookY
const pose = { yaw: 0, pitch: 0, roll: 0, blinkL: 0, blinkR: 0, jaw: 0, smile: 0.15, brow: 0, frown: 0, pucker: 0, wide: 0, lookX: 0, lookY: 0 };
const target = Object.assign({}, pose);
function drawAvatar(a, p, cx, cy, S) {
  const u = S / 100, hw = 40 * u * a.faceW, hh = 48 * u * a.faceH;
  const sy = Math.sin(p.yaw), spt = Math.sin(p.pitch);
  const fx = sy * hw * 0.5, fy = -spt * hh * 0.32, hwE = hw * (1 - 0.06 * Math.abs(sy));
  const skin = a.skin, skinD = shade(skin, -0.16), hair = a.hair, hairD = shade(hair, -0.3), hairL = shade(hair, 0.22);
  // body
  ctx.save(); ctx.translate(cx + sy * 4 * u, cy);
  ctx.fillStyle = rgb(skinD); ctx.fillRect(-11 * u, hh * 0.6, 22 * u, 34 * u);
  let g = ctx.createLinearGradient(0, hh + 12 * u, 0, hh + 120 * u); g.addColorStop(0, rgb(a.shirt)); g.addColorStop(1, rgb(shade(a.shirt, -0.45)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-20 * u, hh + 14 * u); ctx.bezierCurveTo(-62 * u, hh + 18 * u, -72 * u, hh + 40 * u, -78 * u, hh + 140 * u); ctx.lineTo(78 * u, hh + 140 * u); ctx.bezierCurveTo(72 * u, hh + 40 * u, 62 * u, hh + 18 * u, 20 * u, hh + 14 * u); ctx.quadraticCurveTo(0, hh + 26 * u, -20 * u, hh + 14 * u); ctx.fill();
  ctx.strokeStyle = rgb(shade(a.shirt, 0.35), 0.6); ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(-20 * u, hh + 14 * u); ctx.quadraticCurveTo(0, hh + 26 * u, 20 * u, hh + 14 * u); ctx.stroke();
  ctx.restore();
  // head group
  ctx.save(); ctx.translate(cx, cy + hh * 0.7); ctx.rotate(p.roll); ctx.translate(0, -hh * 0.7);
  // back hair
  if (a.style === "long") { ctx.fillStyle = rgb(hairD); ctx.beginPath(); ctx.moveTo(-hwE * 1.12 + fx * 0.2, -hh * 0.2); ctx.bezierCurveTo(-hwE * 1.25, hh * 0.6, -hwE * 1.15, hh * 1.25, -hwE * 0.7, hh * 1.3); ctx.quadraticCurveTo(-hwE * 0.3, hh * 0.8, 0, hh * 0.8); ctx.quadraticCurveTo(hwE * 0.3, hh * 0.8, hwE * 0.7, hh * 1.3); ctx.bezierCurveTo(hwE * 1.15, hh * 1.25, hwE * 1.25, hh * 0.6, hwE * 1.12 + fx * 0.2, -hh * 0.2); ctx.closePath(); ctx.fill(); }
  if (a.style === "curly") { ctx.fillStyle = rgb(hairD); for (let i = 0; i < 14; i++) { const an = Math.PI * (0.95 + i / 13 * 1.1); ctx.beginPath(); ctx.arc(Math.cos(an) * hwE * 1.12 + fx * 0.15, Math.sin(an) * hh * 0.95 - hh * 0.05 + (Math.sin(an) > -0.2 ? hh * 0.15 : 0), hw * 0.3, 0, 7); ctx.fill(); } }
  if (a.style === "medium") { ctx.fillStyle = rgb(hairD); ctx.beginPath(); ctx.ellipse(fx * 0.15, -hh * 0.05, hwE * 1.12, hh * 0.98, 0, 0, Math.PI * 2); ctx.fill(); }
  if (a.style === "bun") { ctx.fillStyle = rgb(hair); ctx.beginPath(); ctx.arc(fx * 0.3, -hh * 1.02, hw * 0.34, 0, 7); ctx.fill(); }
  // ears (move opposite to the face when turning)
  for (const side of [-1, 1]) {
    const ex = side * hwE * 0.97 - fx * 0.3, ey = -hh * 0.02 + fy * 0.6; ctx.fillStyle = rgb(skinD);
    ctx.beginPath(); ctx.ellipse(ex, ey, 7 * u * (1 - 0.5 * Math.max(0, side * sy)), 10 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = rgb(shade(skin, -0.28), 0.5); ctx.beginPath(); ctx.ellipse(ex, ey, 3 * u * (1 - 0.5 * Math.max(0, side * sy)), 5.5 * u, 0, 0, 7); ctx.fill();
  }
  // head shape: rounded top, jaw that is wider or narrower, a chin that is rounder or more pointed
  const chx = fx * 0.3, jw = 0.45 + a.jaw * 0.35, cwid = hwE * (0.55 + a.jaw * 0.25 - a.chin * 0.25);
  const head = new Path2D();
  head.moveTo(-hwE, 0); head.ellipse(fx * 0.06, 0, hwE, hh * 0.96, 0, Math.PI, Math.PI * 2);
  head.bezierCurveTo(hwE, hh * jw, chx + cwid, hh * 1.0, chx, hh * 1.0);
  head.bezierCurveTo(chx - cwid, hh * 1.0, -hwE, hh * jw, -hwE, 0); head.closePath();
  g = ctx.createRadialGradient(-hw * 0.3 + fx * 0.5, -hh * 0.35, hw * 0.2, fx * 0.2, 0, hw * 1.45);
  g.addColorStop(0, rgb(shade(skin, 0.1))); g.addColorStop(0.65, rgb(skin)); g.addColorStop(1, rgb(skinD));
  ctx.fillStyle = g; ctx.fill(head);
  ctx.save(); ctx.clip(head);
  // turn shading on the far side of the face
  if (Math.abs(sy) > 0.02) { const s = Math.sign(sy); g = ctx.createLinearGradient(-s * hwE, 0, -s * hwE * 0.2, 0); g.addColorStop(0, rgb(shade(skin, -0.3), Math.min(0.5, Math.abs(sy) * 1.1))); g.addColorStop(1, rgb(skin, 0)); ctx.fillStyle = g; ctx.fillRect(-hwE * 1.2, -hh * 1.2, hwE * 2.4, hh * 2.4); }
  // beard
  if (a.beard > 0.05) {
    ctx.fillStyle = rgb(a.beardColor, a.beardStyle === "stubble" ? 0.32 : 0.95);
    const my = hh * 0.5 + fy;
    if (a.beardStyle !== "mustache") { ctx.beginPath(); ctx.moveTo(-hwE * 1.02, hh * 0.05); ctx.bezierCurveTo(-hwE, hh * (jw + 0.1), chx - cwid, hh * 1.06, chx, hh * 1.06); ctx.bezierCurveTo(chx + cwid, hh * 1.06, hwE, hh * (jw + 0.1), hwE * 1.02, hh * 0.05);
      ctx.lineTo(hwE * 0.78, hh * 0.08); ctx.quadraticCurveTo(fx + hw * 0.4, my - hh * 0.02, fx, my - hh * 0.05 + p.jaw * 3 * u); ctx.quadraticCurveTo(fx - hw * 0.4, my - hh * 0.02, -hwE * 0.78, hh * 0.08); ctx.closePath(); ctx.fill(); }
    if (a.beardStyle !== "stubble") { ctx.beginPath(); ctx.ellipse(fx, hh * 0.47 + fy, 13 * u * a.mouthW, 4 * u, 0, Math.PI, Math.PI * 2); ctx.ellipse(fx, hh * 0.47 + fy, 13 * u * a.mouthW, 2.2 * u, 0, 0, Math.PI); ctx.fill(); }
  }
  ctx.restore();
  // cheeks
  ctx.fillStyle = `rgba(255,110,110,${0.08 + 0.2 * p.smile})`;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fx + side * hw * 0.55, hh * 0.25 + fy, 8 * u, 5 * u, 0, 0, 7); ctx.fill(); }
  // eyes
  const eyeY = -hh * 0.04 + fy - p.smile * 1.2 * u;
  for (const side of [-1, 1]) {
    const blink = side < 0 ? p.blinkL : p.blinkR;
    const ex = fx + side * a.eyeSep * hw * (1 - 0.18 * side * sy);
    const ew = 7.2 * u * a.eyeSize * (1 - 0.2 * Math.max(0, side * sy)), eh = 8.6 * u * a.eyeSize * a.eyeOpen * (1 + p.wide * 0.25 - p.smile * 0.18);
    const open = clamp(1 - blink, 0, 1);
    const xx = ex;
    if (open < 0.18) { // closed: a soft lash curve
      ctx.strokeStyle = "#1c1412"; ctx.lineWidth = 2.2 * u; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(xx - ew, eyeY + 1 * u); ctx.quadraticCurveTo(xx, eyeY + (p.smile > 0.4 ? -4 : 4) * u, xx + ew, eyeY + 1 * u); ctx.stroke();
    } else {
      const oh = eh * open;
      ctx.save(); ctx.beginPath(); ctx.ellipse(xx, eyeY, ew, oh, 0, 0, 7); ctx.fillStyle = "#fbf7f2"; ctx.fill(); ctx.clip();
      const ix = xx + p.lookX * ew * 0.45, iy = eyeY + p.lookY * oh * 0.35;
      ctx.fillStyle = rgb(a.eyeColor); ctx.beginPath(); ctx.arc(ix, iy, ew * 0.66, 0, 7); ctx.fill();
      ctx.fillStyle = "#0e0a0a"; ctx.beginPath(); ctx.arc(ix, iy, ew * 0.34, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(ix - ew * 0.22, iy - ew * 0.26, ew * 0.17, 0, 7); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#1c1412"; ctx.lineWidth = 1.8 * u; ctx.beginPath(); ctx.ellipse(xx, eyeY, ew, oh, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    }
    // brows
    const by = eyeY - eh - 5.5 * u - p.brow * 4.5 * u + p.frown * 2 * u, bl = 9 * u, tilt = side * (-0.1 + p.frown * 0.32 - p.brow * 0.12);
    ctx.save(); ctx.translate(xx + side * 1 * u, by); ctx.rotate(tilt); ctx.strokeStyle = rgb(a.brow); ctx.lineWidth = 3.4 * u; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-bl, 1 * u); ctx.quadraticCurveTo(0, -2 * u, bl, 1 * u); ctx.stroke(); ctx.restore();
  }
  // glasses
  if (a.glasses !== "none") {
    ctx.strokeStyle = "rgba(232,162,58,.95)"; ctx.lineWidth = 2.2 * u; const r = 11 * u * a.eyeSize;
    const xs = [-1, 1].map(side => fx + side * a.eyeSep * hw * (1 - 0.18 * side * sy));
    for (const x of xs) { ctx.beginPath(); if (a.glasses === "round") ctx.arc(x, eyeY, r, 0, 7); else if (ctx.roundRect) ctx.roundRect(x - r * 1.1, eyeY - r * 0.8, r * 2.2, r * 1.6, 3 * u); else ctx.rect(x - r * 1.1, eyeY - r * 0.8, r * 2.2, r * 1.6); ctx.fillStyle = "rgba(180,210,255,.08)"; ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(xs[0] + r * 0.95, eyeY - 1 * u); ctx.quadraticCurveTo(fx, eyeY - 4 * u, xs[1] - r * 0.95, eyeY - 1 * u); ctx.stroke();
  }
  // nose
  const ny = hh * 0.28 + fy * 1.1, nx = fx * 1.12, nw = 5 * u * a.noseW;
  ctx.strokeStyle = rgb(shade(skin, -0.32), 0.85); ctx.lineWidth = 2 * u; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(nx - nw, ny); ctx.quadraticCurveTo(nx, ny + 3.5 * u, nx + nw, ny); ctx.stroke();
  // mouth
  const my = hh * 0.5 + fy * 1.05, mx = fx * 1.06, mw = 11 * u * a.mouthW * (1 + 0.22 * p.smile - 0.35 * p.pucker), o = clamp(p.jaw, 0, 1) * 15 * u, s = p.smile * 5.5 * u - p.frown * 1.5 * u;
  const lipC = mixc(shade(skin, -0.35), [190, 70, 80], 0.45);
  if (o < 1.6 * u) {
    ctx.strokeStyle = rgb(lipC); ctx.lineWidth = 2.6 * u * a.lip; ctx.beginPath(); ctx.moveTo(mx - mw, my - s); ctx.quadraticCurveTo(mx, my + s * 1.2 + 1.5 * u, mx + mw, my - s); ctx.stroke();
  } else {
    const m = new Path2D(); m.moveTo(mx - mw, my - s); m.quadraticCurveTo(mx, my - o * 0.12 + s * 0.35, mx + mw, my - s); m.quadraticCurveTo(mx + mw * 0.6, my + o * 1.1 + s * 0.5, mx, my + o * 1.1 + s * 0.6); m.quadraticCurveTo(mx - mw * 0.6, my + o * 1.1 + s * 0.5, mx - mw, my - s); m.closePath();
    ctx.fillStyle = "#3a1420"; ctx.fill(m); ctx.save(); ctx.clip(m);
    if (p.smile > 0.25) { ctx.fillStyle = "#fbf5ee"; ctx.fillRect(mx - mw, my - s - 2 * u, mw * 2, 3.6 * u + o * 0.12 + s * 0.35); }
    ctx.fillStyle = "#d4566a"; ctx.beginPath(); ctx.ellipse(mx, my + o * 1.05 + s * 0.5, mw * 0.55, o * 0.45, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = rgb(lipC); ctx.lineWidth = 2 * u * a.lip; ctx.stroke(m);
  }
  // front hair
  drawHair(a, hwE, hh, fx, u, hair, hairD, hairL);
  ctx.restore();
}
function drawHair(a, hw, hh, fx, u, hair, hairD, hairL) {
  const st = a.style; if (st === "bald") { ctx.fillStyle = rgb(hair, 0.55); for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * hw * 0.92 - fx * 0.2, -hh * 0.2, 5 * u, 12 * u, s * 0.2, 0, 7); ctx.fill(); } return; }
  const g = ctx.createLinearGradient(-hw, -hh, hw * 0.5, -hh * 0.2); g.addColorStop(0, rgb(hairL)); g.addColorStop(1, rgb(hair)); ctx.fillStyle = g;
  const ox = fx * 0.18, top = -hh * 1.02;
  ctx.beginPath();
  if (st === "buzz") { ctx.globalAlpha = 0.85; ctx.ellipse(ox, -hh * 0.06, hw * 1.02, hh * 0.98, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(ox, -hh * 0.78, ox - hw * 1.0, -hh * 0.38); ctx.fill(); ctx.globalAlpha = 1; return; }
  // cap over the top of the head, then a fringe line across the forehead
  ctx.moveTo(ox - hw * 1.06, -hh * 0.05);
  ctx.bezierCurveTo(ox - hw * 1.12, top * 0.9, ox - hw * 0.5, top * 1.08, ox, top * (st === "spiky" ? 1.0 : 1.04));
  ctx.bezierCurveTo(ox + hw * 0.5, top * 1.08, ox + hw * 1.12, top * 0.9, ox + hw * 1.06, -hh * 0.05);
  if (st === "side") { ctx.quadraticCurveTo(ox + hw * 0.95, -hh * 0.55, ox + hw * 0.55, -hh * 0.58); ctx.quadraticCurveTo(ox - hw * 0.2, -hh * 0.62, ox - hw * 0.85, -hh * 0.32); ctx.quadraticCurveTo(ox - hw * 0.98, -hh * 0.2, ox - hw * 1.06, -hh * 0.05); }
  else if (st === "medium" || st === "long") { ctx.lineTo(ox + hw * 1.06, hh * (st === "long" ? 0.45 : 0.15)); ctx.quadraticCurveTo(ox + hw * 0.92, -hh * 0.3, ox + hw * 0.3, -hh * 0.55); ctx.quadraticCurveTo(ox + 0, -hh * 0.62, ox - hw * 0.3, -hh * 0.55); ctx.quadraticCurveTo(ox - hw * 0.92, -hh * 0.3, ox - hw * 1.06, hh * (st === "long" ? 0.45 : 0.15)); }
  else if (st === "curly") { for (let i = 0; i <= 6; i++) { const x = ox + hw * (1.0 - i / 3), y = -hh * (0.48 + 0.08 * Math.sin(i * 1.7)); ctx.quadraticCurveTo(x + hw * 0.17, y + hh * 0.12, x, y); } }
  else { // short / bun / spiky: soft bumpy fringe
    ctx.quadraticCurveTo(ox + hw * 0.95, -hh * 0.5, ox + hw * 0.6, -hh * 0.52);
    for (let i = 0; i < 4; i++) { const x0 = ox + hw * (0.6 - (i + 1) * 0.3); ctx.quadraticCurveTo(x0 + hw * 0.15, -hh * 0.4, x0, -hh * 0.55); }
    ctx.quadraticCurveTo(ox - hw * 0.95, -hh * 0.5, ox - hw * 1.06, -hh * 0.05);
  }
  ctx.closePath(); ctx.fill();
  if (st === "spiky") { for (let i = -3; i <= 3; i++) { const x = ox + i * hw * 0.28, y = top * (1 - Math.abs(i) * 0.06); ctx.beginPath(); ctx.moveTo(x - hw * 0.16, y + hh * 0.18); ctx.lineTo(x + i * 2 * u, y - hh * 0.2); ctx.lineTo(x + hw * 0.16, y + hh * 0.18); ctx.fill(); } }
  // shine
  ctx.strokeStyle = rgb(shade(hair, 0.4), 0.35); ctx.lineWidth = 2.4 * u; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(ox - hw * 0.2, -hh * 0.2, hw * 0.75, Math.PI * 1.25, Math.PI * 1.45); ctx.stroke();
}

// ================= idle life (no camera) =================
let nextBlink = 1.5, blinkT = -1, hiT = -1, look = { x: 0, y: 0, t: 0 };
function idle(t, dt) {
  if (t > nextBlink && blinkT < 0) { blinkT = 0; nextBlink = t + 2 + Math.random() * 3.5; }
  let b = 0; if (blinkT >= 0) { blinkT += dt; b = blinkT < 0.08 ? blinkT / 0.08 : blinkT < 0.2 ? 1 - (blinkT - 0.08) / 0.12 : 0; if (blinkT > 0.2) blinkT = -1; }
  const sway = reduced ? 0 : 1;
  target.yaw = clamp(look.x * 0.45, -0.5, 0.5) + Math.sin(t * 0.5) * 0.06 * sway; target.pitch = clamp(look.y * 0.3, -0.3, 0.3) + Math.sin(t * 0.37) * 0.03 * sway; target.roll = Math.sin(t * 0.43) * 0.04 * sway;
  target.blinkL = target.blinkR = b; target.lookX = clamp(look.x * 1.2, -1, 1); target.lookY = clamp(-look.y, -1, 1);
  let hi = 0; if (hiT >= 0) { hiT += dt; hi = Math.sin(Math.min(1, hiT / 1.4) * Math.PI); if (hiT > 1.4) hiT = -1; }
  target.smile = 0.2 + hi * 0.8; target.jaw = hi * 0.35 * (0.6 + 0.4 * Math.sin(hiT * 18)); target.brow = hi * 0.6; target.frown = 0; target.pucker = 0; target.wide = hi * 0.3;
}
cv.addEventListener("pointermove", e => { if (camOn) return; look.x = (e.clientX / W - 0.5) * 2; look.y = (0.42 - e.clientY / H) * 2; });
cv.addEventListener("pointerdown", e => { if (camOn) return; look.x = (e.clientX / W - 0.5) * 2; look.y = (0.42 - e.clientY / H) * 2; if (Math.abs(e.clientX - W / 2) < W * 0.3) { hiT = 0; } });

// ================= camera + on-device face finder =================
const video = $("cam");
let stream = null, camOn = false, landmarker = null, landmarkerP = null, scanning = false, samples = [], lastVT = -1, camStartT = 0, noFaceT = 0;
function loadLandmarker() {
  if (landmarkerP) return landmarkerP;
  landmarkerP = (async () => {
    const { FilesetResolver, FaceLandmarker } = await import("./vendor/vision_bundle.mjs");
    const files = await FilesetResolver.forVisionTasks(new URL("vendor/wasm", location.href).href.replace(/\/$/, ""));
    const opts = d => ({ baseOptions: { modelAssetPath: new URL("vendor/face_landmarker.task", location.href).href, delegate: d }, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false });
    try { landmarker = await FaceLandmarker.createFromOptions(files, opts("GPU")); }
    catch (e) { console.warn("GPU face finder unavailable, using CPU", e); landmarker = await FaceLandmarker.createFromOptions(files, opts("CPU")); }
    return landmarker;
  })();
  landmarkerP.catch(() => { landmarkerP = null; });
  return landmarkerP;
}
function startCamera(scan) {
  // called straight from a tap: ask for the camera before anything else is awaited
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) { camFailed("This browser can't use the camera here."); return; }
  const gp = md.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  const lp = loadLandmarker();
  scanning = scan; samples = []; $("scan").hidden = false; $("scanbar").style.width = "0%"; $("scanmsg").textContent = "Allow the camera to scan your face…";
  gp.then(async s => {
    stream = s; video.srcObject = s; video.muted = true; video.setAttribute("playsinline", ""); await video.play().catch(() => {});
    camOn = true; camStartT = performance.now(); noFaceT = 0; setCamUI();
    if (!landmarker) $("scanmsg").textContent = "Loading the face finder (about 19 MB, first time only)…";
    try { await lp; } catch (e) { console.warn(e); stopCamera(); camFailed("The face finder couldn't start on this browser."); return; }
    if (!camOn) return;
    $("scanmsg").textContent = scan ? "Look at the screen and hold still…" : "Mirroring you. Blink, smile, turn your head.";
    if (!scan) setTimeout(() => { if (!scanning) $("scan").hidden = true; }, 1800);
    requestAnimationFrame(detectLoop);
  }).catch(e => { console.warn("camera", e && e.name); camFailed(e && e.name === "NotAllowedError" ? "Camera blocked. No problem, build one by hand instead." : "No camera available. Build one by hand instead."); });
}
function stopCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null; video.srcObject = null; camOn = false; scanning = false; $("scan").hidden = true; setCamUI();
}
function camFailed(msg) { $("scan").hidden = true; scanning = false; toast(msg, 4500); openEditor(); }
addEventListener("pagehide", stopCamera);
document.addEventListener("visibilitychange", () => { if (document.hidden && camOn) { stopCamera(); toast("Camera turned off. Tap MIRROR ME to turn it back on.", 4000); } });

// landmark helpers (MediaPipe face mesh indices)
const L = { cheekR: 234, cheekL: 454, top: 10, chin: 152, jawR: 172, jawL: 397, chinR: 148, chinL: 377, irisR: 468, irisL: 473, eRo: 33, eRi: 133, eLi: 362, eLo: 263, eRt: 159, eRb: 145, eLt: 386, eLb: 374, noseTip: 1, noseR: 64, noseL: 294, mouthR: 61, mouthL: 291, lipT: 0, lipB: 17, browR: 105, browL: 334, cheekPtR: 50, cheekPtL: 280, forehead: 151, philtrum: 164, underLip: 200 };
let vw = 640, vh = 480;
const P = (lm, i) => [lm[i].x * vw, lm[i].y * vh];
const dd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ear = (lm, t, b, o, i) => dd(P(lm, t), P(lm, b)) / (dd(P(lm, o), P(lm, i)) || 1);
let base = { earL: 0.28, earR: 0.28, pitch: 0.5 };
const sc = document.createElement("canvas"); sc.width = 320; sc.height = 240; const sctx = sc.getContext("2d", { willReadFrequently: true });
function sampler() { // grab one small frame to read colours from (stays in memory, never stored or sent)
  sctx.drawImage(video, 0, 0, sc.width, sc.height); const img = sctx.getImageData(0, 0, sc.width, sc.height).data;
  return (nx, ny, r = 3) => { const cx = Math.round(nx * sc.width), cy = Math.round(ny * sc.height); let R = 0, G = 0, B = 0, n = 0;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { if (x < 0 || y < 0 || x >= sc.width || y >= sc.height) continue; const k = (y * sc.width + x) * 4; R += img[k]; G += img[k + 1]; B += img[k + 2]; n++; }
    return n ? [R / n, G / n, B / n] : null; };
}
function measure(lm, colors) {
  const fw = dd(P(lm, L.cheekR), P(lm, L.cheekL)), fh = dd(P(lm, L.top), P(lm, L.chin));
  const m = { ratio: fh / fw, jaw: dd(P(lm, L.jawR), P(lm, L.jawL)) / fw, chin: dd(P(lm, L.chinR), P(lm, L.chinL)) / fw, eyeSep: dd(P(lm, L.irisR), P(lm, L.irisL)) / fw,
    eyeW: (dd(P(lm, L.eRo), P(lm, L.eRi)) + dd(P(lm, L.eLi), P(lm, L.eLo))) / 2 / fw, earR: ear(lm, L.eRt, L.eRb, L.eRo, L.eRi), earL: ear(lm, L.eLt, L.eLb, L.eLo, L.eLi),
    noseW: dd(P(lm, L.noseR), P(lm, L.noseL)) / fw, mouthW: dd(P(lm, L.mouthR), P(lm, L.mouthL)) / fw, lip: dd(P(lm, L.lipT), P(lm, L.lipB)) / fw, pitch: pitchRatio(lm) };
  if (colors) {
    const s = colors, at = (i, dx = 0, dy = 0) => s(lm[i].x + dx, lm[i].y + dy);
    // "up" along the face, in normalised image units, for sampling above the head and below the ears
    const ux = (lm[L.top].x - lm[L.chin].x), uy = (lm[L.top].y - lm[L.chin].y), sx = (lm[L.cheekL].x - lm[L.cheekR].x) / 2, sy2 = (lm[L.cheekL].y - lm[L.cheekR].y) / 2;
    const mid = [(lm[L.cheekR].x + lm[L.cheekL].x) / 2, (lm[L.cheekR].y + lm[L.cheekL].y) / 2];
    const rel = (a, b) => s(mid[0] + ux * a + sx * b, mid[1] + uy * a + sy2 * b);
    m.skin = medc([at(L.cheekPtR), at(L.cheekPtL), at(L.forehead), at(205), at(425), at(101), at(330), at(123), at(352)].filter(Boolean));
    m.hair1 = s(lm[L.top].x + ux * 0.07, lm[L.top].y + uy * 0.07, 2); m.hair2 = s(lm[L.top].x + ux * 0.2, lm[L.top].y + uy * 0.2, 3); m.hair3 = s(lm[L.top].x + ux * 0.36, lm[L.top].y + uy * 0.36, 3);
    m.sideEar = avgc([rel(0.12, 1.18), rel(0.12, -1.18)]); m.sideJaw = avgc([rel(-0.38, 1.15), rel(-0.38, -1.15)]); m.bg = avgc([rel(0.25, 2.1), rel(0.25, -2.1)]);
    m.brow = avgc([at(L.browR, 0, 0), at(L.browL, 0, 0)].map(c => c)); m.iris = avgc([s(lm[L.irisR].x, lm[L.irisR].y, 1), s(lm[L.irisL].x, lm[L.irisL].y, 1)]);
    m.chinC = s((lm[L.underLip].x + lm[L.chin].x) / 2, (lm[L.underLip].y + lm[L.chin].y) / 2, 2); m.jawC = avgc([s(lerp(lm[L.jawR].x, lm[L.mouthR].x, 0.4), lerp(lm[L.jawR].y, lm[L.mouthR].y, 0.4), 2), s(lerp(lm[L.jawL].x, lm[L.mouthL].x, 0.4), lerp(lm[L.jawL].y, lm[L.mouthL].y, 0.4), 2)]);
    m.must = s(lm[L.philtrum].x, lm[L.philtrum].y, 2);
  }
  return m;
}
function avgc(list) { const l = list.filter(Boolean); if (!l.length) return [128, 128, 128]; return [0, 1, 2].map(k => l.reduce((a, c) => a + c[k], 0) / l.length); }
function pitchRatio(lm) { const eyeY = (lm[L.irisR].y + lm[L.irisL].y) / 2; return (lm[L.noseTip].y - eyeY) / ((lm[L.chin].y - eyeY) || 1e-3); }
const med = arr => { const a = arr.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
const medc = arr => [0, 1, 2].map(k => med(arr.map(c => c[k])));
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function buildAvatar(ss) {
  const g = k => med(ss.map(s => s[k])), c = k => medc(ss.filter(s => s[k]).map(s => s[k]));
  const a = defaultAvatar(); a.source = "scan";
  // shape: compare to typical values and exaggerate a little so differences read at cartoon scale
  const ratio = g("ratio"), jaw = g("jaw"), chin = g("chin");
  a.faceH = clamp(1 + (ratio - 1.25) * 0.9, 0.88, 1.14); a.faceW = clamp(1 - (ratio - 1.25) * 0.5, 0.9, 1.1);
  a.jaw = clamp(0.45 + (jaw - 0.82) * 5, 0, 1); a.chin = clamp(0.55 - (chin - 0.22) * 5, 0, 1);
  a.eyeSep = clamp(0.41 + (g("eyeSep") - 0.45) * 1.8, 0.32, 0.5); a.eyeSize = clamp(1 + (g("eyeW") - 0.2) * 4, 0.85, 1.2);
  const earO = med(ss.map(s => (s.earL + s.earR) / 2)); a.eyeOpen = clamp(1 + (earO - 0.28) * 2.5, 0.78, 1.22);
  a.noseW = clamp(1 + (g("noseW") - 0.3) * 3, 0.8, 1.25); a.mouthW = clamp(1 + (g("mouthW") - 0.46) * 2.5, 0.8, 1.25); a.lip = clamp(1 + (g("lip") - 0.17) * 3, 0.8, 1.3);
  const faceKeys = Object.keys(FACES); a.faceName = faceKeys.reduce((b, k) => { const f = FACES[k], d = Math.abs(f[0] - a.faceW) + Math.abs(f[1] - a.faceH) + Math.abs(f[2] - a.jaw) * 0.3 + Math.abs(f[3] - a.chin) * 0.3; return d < b[1] ? [k, d] : b; }, ["oval", 9])[0];
  a.eyesName = a.eyeSep < 0.375 ? "close" : a.eyeSep > 0.445 ? "wide" : "medium";
  // colours: lighten camera shadows a touch, then pull part way toward the nearest cartoon swatch
  const skinRaw = c("skin"); const skinL = shade(skinRaw, -0.04); a.skin = mixc(skinL, nearest(skinL, SKIN), 0.45);
  const h1 = c("hair1"), h2 = c("hair2"), h3 = c("hair3"), side1 = c("sideEar"), side2 = c("sideJaw"), bg = c("bg"), brow = c("brow");
  const skinish = col => cdist(col, skinRaw) < 42, bgish = col => cdist(col, bg) < 34;
  let hairC = null, style = "short";
  if (!skinish(h1) && !bgish(h1)) hairC = h1; else if (!skinish(h2) && !bgish(h2)) hairC = h2;
  if (!hairC) { style = "bald"; hairC = shade(brow, -0.25); }
  else {
    const like = col => cdist(col, hairC) < 40 && !bgish(col);
    const tall = like(h3), ears = like(side1), jawSide = like(side2);
    style = jawSide ? "long" : ears ? (tall ? "curly" : "medium") : tall ? "curly" : (!skinish(h1) && skinish(h2)) ? "buzz" : "short";
    if (style === "curly" && !ears && lum(hairC) > 90) style = "spiky";
  }
  a.hair = mixc(hairC, nearest(hairC, HAIR), 0.5); a.brow = shade(mixc(a.hair, brow, 0.5), -0.15); a.beardColor = a.hair; a.style = style;
  const iris = c("iris"); a.eyeColor = mixc(iris, nearest(iris, EYE), 0.6);
  // facial hair: chin and jaw noticeably darker than the cheeks and close to the hair colour
  const chinC = c("chinC"), jawC = c("jawC"), must = c("must"), dark = col => lum(skinRaw) - lum(col);
  const beardScore = Math.min(dark(chinC), dark(jawC)) / Math.max(30, lum(skinRaw)), mustScore = dark(must) / Math.max(30, lum(skinRaw));
  setBeard(a, beardScore > 0.42 ? "full" : mustScore > 0.4 ? "mustache" : beardScore > 0.3 ? "stubble" : "none");
  a.shirt = SHIRT[0];
  base.earL = Math.max(0.12, med(ss.map(s => s.earL)) * 1.05); base.earR = Math.max(0.12, med(ss.map(s => s.earR)) * 1.05); base.pitch = g("pitch");
  a.earL0 = base.earL; a.earR0 = base.earR; a.pitch0 = base.pitch;
  window.__lastMeasure = { ratio, jaw, chin, eyeSep: g("eyeSep"), eyeW: g("eyeW"), earO, noseW: g("noseW"), mouthW: g("mouthW"), lip: g("lip"), skinRaw, h1, h2, h3, side1, side2, bg, brow, iris, beardScore, mustScore };
  return a;
}
function detectLoop() {
  if (!camOn || !landmarker) return;
  requestAnimationFrame(detectLoop);
  if (video.readyState < 2 || video.currentTime === lastVT) return;
  lastVT = video.currentTime; vw = video.videoWidth || 640; vh = video.videoHeight || 480;
  let res; try { res = landmarker.detectForVideo(video, performance.now()); } catch (e) { console.warn(e); return; }
  const lm = res && res.faceLandmarks && res.faceLandmarks[0];
  if (!lm) { noFaceT++; if (scanning) $("scanmsg").textContent = "I can't see a face yet. Move into the frame."; return; }
  noFaceT = 0;
  const bs = {}; if (res.faceBlendshapes && res.faceBlendshapes[0]) for (const c of res.faceBlendshapes[0].categories) bs[c.categoryName] = c.score;
  // work in mirrored image space so the avatar moves like a mirror
  const mx = i => 1 - lm[i].x, my = i => lm[i].y;
  const roll = Math.atan2((my(L.irisR) - my(L.irisL)) * vh, (mx(L.irisR) - mx(L.irisL)) * vw);
  const midX = (mx(L.cheekR) + mx(L.cheekL)) / 2, half = Math.abs(mx(L.cheekR) - mx(L.cheekL)) / 2 || 1e-3;
  const yawS = clamp((mx(L.noseTip) - midX) / half * 1.15, -0.95, 0.95);
  const pr = pitchRatio(lm);
  if (scanning) {
    const ok = Math.abs(yawS) < 0.3 && Math.abs(roll) < 0.25;
    if (ok && (samples.length < 4 || Math.random() < 0.6)) { samples.push(measure(lm, sampler())); }
    $("scanbar").style.width = Math.min(100, samples.length / 24 * 100) + "%";
    $("scanmsg").textContent = ok ? "Hold still…" : "Face the screen straight on…";
    if (samples.length >= 24) { av = buildAvatar(samples); save(av); returning = true; scanning = false; $("scan").hidden = true; toast("Here you are! Saved on this device only.", 3000); syncEditor(); setCamUI(); }
  }
  const eL = ear(lm, L.eLt, L.eLb, L.eLo, L.eLi), eR = ear(lm, L.eRt, L.eRb, L.eRo, L.eRi);
  const e0L = av.earL0 || base.earL, e0R = av.earR0 || base.earR;
  // subject's left eye shows on the screen's left in a mirror
  const blinkFrom = (e, e0) => clamp(1 - (e / e0 - 0.4) / 0.45, 0, 1);
  const bsBlink = ((bs.eyeBlinkLeft || 0) + (bs.eyeBlinkRight || 0)) / 2;
  target.blinkL = Math.max(blinkFrom(eL, e0L), bsBlink > 0.55 ? bsBlink : 0); target.blinkR = Math.max(blinkFrom(eR, e0R), bsBlink > 0.55 ? bsBlink : 0);
  target.roll = clamp(roll, -0.6, 0.6); target.yaw = Math.asin(yawS); target.pitch = clamp(((av.pitch0 || base.pitch) - pr) * 2.6, -0.5, 0.5);
  target.jaw = clamp(((bs.jawOpen || 0) - 0.05) * 1.4, 0, 1); target.smile = clamp(((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2 * 1.3, 0, 1);
  target.brow = clamp(((bs.browInnerUp || 0) + ((bs.browOuterUpLeft || 0) + (bs.browOuterUpRight || 0)) / 2) * 0.9, 0, 1); target.frown = clamp((((bs.browDownLeft || 0) + (bs.browDownRight || 0)) / 2 - 0.3) * 1.6, 0, 1) * (1 - target.smile * 0.6);
  target.pucker = clamp((bs.mouthPucker || 0) * 1.2, 0, 1); target.wide = clamp(((bs.eyeWideLeft || 0) + (bs.eyeWideRight || 0)) / 2 * 1.5, 0, 1);
  const lx = ((bs.eyeLookOutLeft || 0) - (bs.eyeLookInLeft || 0) + (bs.eyeLookInRight || 0) - (bs.eyeLookOutRight || 0)) / 2;
  target.lookX = clamp(-lx * 1.4, -1, 1); target.lookY = clamp((((bs.eyeLookDownLeft || 0) + (bs.eyeLookDownRight || 0)) - ((bs.eyeLookUpLeft || 0) + (bs.eyeLookUpRight || 0))) / 2 * 1.5, -1, 1);
  lastFace = performance.now();
}
let lastFace = 0;

// ================= UI =================
const camBtn = $("cambtn");
function setCamUI() {
  camBtn.textContent = camOn ? "STOP CAMERA" : "MIRROR ME";
  $("readout").innerHTML = camOn ? '<span class="dot"></span>CAMERA ON · STAYS ON THIS DEVICE' : (av.source === "scan" ? "SAVED ON THIS DEVICE ONLY" : "ON THIS DEVICE ONLY");
  $("note").textContent = camOn ? "BLINK · SMILE · OPEN YOUR MOUTH · RAISE YOUR BROWS · TURN YOUR HEAD" : "TAP YOUR AVATAR TO SAY HI";
}
camBtn.addEventListener("click", () => { if (camOn) stopCamera(); else startCamera(av.source !== "scan"); });
$("rescan").addEventListener("click", () => { if (camOn) { scanning = true; samples = []; $("scan").hidden = false; } else startCamera(true); });
function forgetFlow(btn) {
  if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = btn.id === "forget" ? "TAP AGAIN TO FORGET" : "Tap again to forget"; setTimeout(() => { btn.dataset.armed = ""; btn.textContent = old; }, 3500); return; }
  stopCamera(); forget(); av = defaultAvatar(); returning = false; closeEditor(); showStart(); toast("Forgotten. Nothing about you is stored here now.", 3500);
  btn.dataset.armed = ""; btn.textContent = btn.id === "forget" ? "FORGET ME" : "Forget me";
}
$("forget").addEventListener("click", e => forgetFlow(e.currentTarget));
$("forget2").addEventListener("click", e => forgetFlow(e.currentTarget));
let toastTimer = 0;
function toast(msg, ms) { const t = $("toast"); t.textContent = msg; t.hidden = false; t.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.opacity = 0; setTimeout(() => { t.hidden = true; }, 400); }, ms || 2500); }

// editor
function swatches(id, pal, key) {
  const el = $(id); el.innerHTML = "";
  pal.forEach(c => { const b = document.createElement("button"); b.style.background = rgb(c); b.setAttribute("aria-label", key + " colour"); b.addEventListener("click", () => { av[key] = c.slice(); if (key === "hair") { av.brow = shade(c, -0.2); av.beardColor = c.slice(); } av.source = av.source === "scan" ? "scan+edit" : av.source; syncEditor(); }); el.appendChild(b); });
}
swatches("sw-skin", SKIN, "skin"); swatches("sw-hair", HAIR, "hair"); swatches("sw-eye", EYE, "eyeColor"); swatches("sw-shirt", SHIRT, "shirt");
const CYC = { style: [STYLES, a => a.style, (a, v) => { a.style = v; }], face: [Object.keys(FACES), a => a.faceName, setFace], eyes: [Object.keys(EYES), a => a.eyesName, setEyes], beard: [BEARDS, a => a.beardStyle, setBeard], glasses: [GLASSES, a => a.glasses, (a, v) => { a.glasses = v; }] };
document.querySelectorAll("[data-cyc]").forEach(b => b.addEventListener("click", () => { const [list, get, set] = CYC[b.dataset.cyc]; const i = list.indexOf(get(av)); set(av, list[(i + +b.dataset.d + list.length) % list.length]); syncEditor(); }));
function syncEditor() {
  for (const [id, pal, key] of [["sw-skin", SKIN, "skin"], ["sw-hair", HAIR, "hair"], ["sw-eye", EYE, "eyeColor"], ["sw-shirt", SHIRT, "shirt"]]) {
    const near = nearest(av[key], pal); [...$(id).children].forEach((b, i) => b.setAttribute("aria-pressed", pal[i] === near));
  }
  for (const k in CYC) $("o-" + k).textContent = CYC[k][1](av).toUpperCase();
}
function openEditor() { $("start").hidden = true; $("edit").hidden = false; started = true; syncEditor(); }
function closeEditor() { $("edit").hidden = true; }
$("editbtn").addEventListener("click", () => { if ($("edit").hidden) openEditor(); else { save(av); returning = true; closeEditor(); } });
$("random").addEventListener("click", () => { const keep = { earL0: av.earL0, earR0: av.earR0, pitch0: av.pitch0 }; av = Object.assign(randomAvatar(), keep); syncEditor(); hiT = 0; });
$("done").addEventListener("click", () => { save(av); returning = true; closeEditor(); setCamUI(); toast("Saved on this device only.", 2200); hiT = 0; });

// start screen
let started = false;
function showStart() {
  started = false; $("start").hidden = false;
  if (returning) { $("st-title").textContent = "Welcome back"; $("st-text").textContent = "Your avatar is saved in this browser, and only here."; $("go").textContent = "Mirror me"; $("manual").textContent = "Just say hi"; $("forget2").hidden = false; }
  else { $("st-title").textContent = "Avatar"; $("st-text").textContent = "Your camera turns your face into a little avatar that blinks, smiles and turns its head with you."; $("go").textContent = "Scan my face"; $("manual").textContent = "Build one by hand"; $("forget2").hidden = true; }
  setCamUI();
}
$("go").addEventListener("click", () => { $("start").hidden = true; started = true; startCamera(!returning || av.source === "manual"); });
$("manual").addEventListener("click", () => { if (returning) { $("start").hidden = true; started = true; hiT = 0; } else { av = randomAvatar(); openEditor(); } });
showStart();

// ================= loop =================
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000), t = now / 1000; lastT = now;
  const live = camOn && landmarker && now - lastFace < 600;
  if (!live) idle(t, dt);
  if (camOn && now - camStartT > 180000 && !scanning) { stopCamera(); toast("Camera turned off after 3 minutes. Tap MIRROR ME to turn it back on.", 4000); }
  const kp = 1 - Math.exp(-dt * (live ? 14 : 6)), ke = 1 - Math.exp(-dt * (live ? 22 : 14));
  for (const k in pose) pose[k] += (target[k] - pose[k]) * (k === "yaw" || k === "pitch" || k === "roll" ? kp : ke);
  drawScene(t);
  const editing = !$("edit").hidden, S = Math.min(W * 0.56, H * (editing ? 0.2 : 0.31)), cy = H * (editing ? 0.24 : 0.39);
  ctx.globalAlpha = started || returning ? 1 : 0.5; drawAvatar(av, pose, W / 2, cy, S); ctx.globalAlpha = 1;
}
requestAnimationFrame(frame);
window.avatar = { get params() { return av; }, pose, stats: () => ({ camOn, scanning, samples: samples.length, landmarker: !!landmarker, source: av.source, measure: window.__lastMeasure || null, saved: !!localStorage.getItem(KEY) }), stopCamera };
