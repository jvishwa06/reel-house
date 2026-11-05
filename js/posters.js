// Procedural key art for the fictional films: each movie's palette + motif paints a scene,
// then posters get title typography and a billing block. Cached per movie/size.
import { rng, hash } from './data.js';

const cache = new Map();
const DISPLAY = '"Bricolage Grotesque", "Arial Narrow", sans-serif';

function mk(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

/* ------------------------------------------------------------- shared painters */
function sky(g, w, h, P, y1 = 1){
  const gr = g.createLinearGradient(0, 0, 0, h*y1);
  gr.addColorStop(0, P[0]); gr.addColorStop(.62, P[1]); gr.addColorStop(1, mix(P[1], P[2], .35));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function mix(a, b, t){ const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = k => Math.round(((A >> k) & 255)*(1 - t) + ((B >> k) & 255)*t); return `rgb(${c(16)},${c(8)},${c(0)})`; }
function glow(g, x, y, r, col, a = .9){ const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hexA(col, a)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r*2, r*2); }
function stars(g, w, h, R, n, maxY = 1){ for (let i = 0; i < n; i++){ g.fillStyle = `rgba(255,255,255,${.25 + R()*.7})`; const s = R() < .08 ? 2 : 1; g.fillRect(R()*w, R()*h*maxY, s, s); } }
function grain(g, w, h, R, k = .06){
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4){ const n = (R() - .5)*255*k; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}
function vignette(g, w, h, a = .65){ const gr = g.createRadialGradient(w/2, h*.45, Math.min(w, h)*.25, w/2, h*.5, Math.max(w, h)*.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
function ridge(g, w, h, y, amp, col, R, step = 0.04){
  g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
  let yy = y; for (let x = 0; x <= 1.0001; x += step){ yy = y + (R() - .5)*amp; g.lineTo(x*w, yy*h); }
  g.lineTo(w, h); g.closePath(); g.fill();
}
function smoothRidge(g, w, h, y, amp, freq, phase, col){
  g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 4){ const t = x/w; g.lineTo(x, (y + Math.sin(t*freq + phase)*amp + Math.sin(t*freq*2.3 + phase*1.7)*amp*.35)*h); }
  g.lineTo(w, h); g.closePath(); g.fill();
}
// a standing figure seen from behind/front, used as the "hero" in most key art
function figure(g, x, base, s, col){
  g.fillStyle = col; g.beginPath();
  g.arc(x, base - s*1.72, s*.13, 0, Math.PI*2); g.fill();
  g.beginPath();
  g.moveTo(x - s*.2, base - s*1.55); g.quadraticCurveTo(x, base - s*1.62, x + s*.2, base - s*1.55);
  g.lineTo(x + s*.26, base - s*.95); g.lineTo(x + s*.16, base - s*.92); g.lineTo(x + s*.14, base);
  g.lineTo(x + s*.03, base); g.lineTo(x, base - s*.75); g.lineTo(x - s*.03, base); g.lineTo(x - s*.14, base);
  g.lineTo(x - s*.16, base - s*.92); g.lineTo(x - s*.26, base - s*.95); g.closePath(); g.fill();
}
function skyline(g, w, h, base, col, R, winCol, n = 26){
  let x = -10;
  while (x < w + 10){
    const bw = w*(.03 + R()*.06), bh = h*(.12 + R()*.38);
    g.fillStyle = col; g.fillRect(x, base - bh, bw, bh + 2);
    if (winCol) for (let yy = base - bh + 6; yy < base - 6; yy += 7) for (let xx = x + 3; xx < x + bw - 3; xx += 6) if (R() < .22){ g.fillStyle = hexA(winCol, .35 + R()*.5); g.fillRect(xx, yy, 2, 3); }
    x += bw + R()*4;
  }
}

/* ------------------------------------------------------------- motifs */
const MOTIF = {
  rain(g, w, h, P, R){
    sky(g, w, h, P); glow(g, w*.7, h*.18, w*.5, P[2], .25);
    // lightning
    g.strokeStyle = hexA('#ffffff', .8); g.lineWidth = 2; g.beginPath(); let lx = w*.72, ly = 0; g.moveTo(lx, ly);
    while (ly < h*.4){ lx += (R() - .5)*w*.08; ly += h*.04; g.lineTo(lx, ly); } g.stroke(); glow(g, lx, h*.2, w*.25, '#cfe8ff', .25);
    skyline(g, w, h, h*.8, mix(P[0], '#000000', .3), R, P[3]);
    g.fillStyle = mix(P[0], '#000000', .5); g.fillRect(0, h*.8, w, h*.2);
    // wet street reflections
    for (let i = 0; i < 40; i++){ g.fillStyle = hexA(P[3], .08 + R()*.15); g.fillRect(R()*w, h*.8 + R()*h*.2, 2 + R()*30, 1.5); }
    figure(g, w*.5, h*.93, h*.28, '#05080c');
    g.strokeStyle = hexA(P[2], .35); g.lineWidth = 1;
    for (let i = 0; i < 260; i++){ const x = R()*w, y = R()*h, l = 8 + R()*22; g.beginPath(); g.moveTo(x, y); g.lineTo(x - l*.25, y + l); g.stroke(); }
  },
  planet(g, w, h, P, R){
    g.fillStyle = P[0]; g.fillRect(0, 0, w, h); stars(g, w, h, R, 380);
    glow(g, w*.3, h*.25, w*.6, P[1], .55);
    const cx = w*.62, cy = h*.42, r = Math.min(w, h)*.34;
    const pg = g.createRadialGradient(cx - r*.35, cy - r*.35, r*.1, cx, cy, r);
    pg.addColorStop(0, P[2]); pg.addColorStop(.55, P[1]); pg.addColorStop(1, P[0]);
    g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.fill();
    for (let i = 0; i < 7; i++){ g.strokeStyle = hexA(P[2], .05 + R()*.08); g.lineWidth = r*.06*R() + 2; g.beginPath(); g.ellipse(cx, cy + (R() - .5)*r*1.2, r*.98, r*.06, 0, 0, Math.PI*2); g.stroke(); }
    g.save(); g.translate(cx, cy); g.rotate(-.28);
    for (let k = 0; k < 4; k++){ g.strokeStyle = hexA(P[3], .55 - k*.1); g.lineWidth = 3 + k*2; g.beginPath(); g.ellipse(0, 0, r*(1.55 + k*.1), r*(.3 + k*.02), 0, Math.PI*1.02, Math.PI*1.98, true); g.stroke(); }
    g.restore();
    // ship
    g.fillStyle = '#e8f6ff'; g.save(); g.translate(w*.24, h*.66); g.rotate(-.5); g.beginPath(); g.moveTo(0, -14); g.lineTo(5, 10); g.lineTo(-5, 10); g.closePath(); g.fill(); g.restore();
    glow(g, w*.24 - 8, h*.66 + 14, 30, P[3], .6);
  },
  lanterns(g, w, h, P, R){
    sky(g, w, h, P); glow(g, w*.5, h*.3, w*.55, P[2], .35);
    g.fillStyle = hexA('#fff1d0', .95); g.beginPath(); g.arc(w*.5, h*.28, Math.min(w, h)*.12, 0, Math.PI*2); g.fill(); glow(g, w*.5, h*.28, w*.3, '#ffe6b0', .45);
    // palace arches
    const base = h*.82; g.fillStyle = mix(P[0], '#000000', .35); g.fillRect(0, base - h*.2, w, h*.4);
    for (let i = 0; i < 7; i++){ const ax = w*(i + .5)/7, aw = w/7*.62; g.fillStyle = hexA(P[3], .55); g.beginPath(); g.moveTo(ax - aw/2, base); g.lineTo(ax - aw/2, base - h*.1); g.quadraticCurveTo(ax, base - h*.19, ax + aw/2, base - h*.1); g.lineTo(ax + aw/2, base); g.fill(); }
    g.fillStyle = mix(P[0], '#000000', .55); for (let i = 0; i < 3; i++){ const dx = w*(.2 + i*.3); g.beginPath(); g.arc(dx, base - h*.24, w*.06, Math.PI, 0); g.fill(); g.fillRect(dx - w*.06, base - h*.24, w*.12, h*.06); }
    for (let i = 0; i < 46; i++){ const x = R()*w, y = R()*h*.7, s = 4 + R()*9; glow(g, x, y, s*4, P[2], .35); g.fillStyle = hexA('#ffcf7a', .9); g.beginPath(); g.ellipse(x, y, s*.55, s*.75, 0, 0, Math.PI*2); g.fill(); }
    figure(g, w*.44, h*.97, h*.2, '#12040a'); figure(g, w*.56, h*.97, h*.215, '#12040a');
  },
  blade(g, w, h, P, R){
    g.fillStyle = P[0]; g.fillRect(0, 0, w, h); glow(g, w*.5, h*.5, w*.7, P[1], .7);
    for (let i = 0; i < 5; i++) ridge(g, w, h, .55 + i*.08, .08, mix(P[0], '#000000', .2 + i*.12), R, .02);
    g.save(); g.translate(w*.5, h*.45); g.rotate(-.55);
    const sg = g.createLinearGradient(-w, 0, w, 0); sg.addColorStop(0, hexA(P[2], 0)); sg.addColorStop(.5, hexA('#ffffff', .95)); sg.addColorStop(1, hexA(P[2], 0));
    g.fillStyle = sg; g.fillRect(-w, -3, w*2, 6); g.fillStyle = hexA(P[2], .35); g.fillRect(-w, -18, w*2, 36); g.restore();
    figure(g, w*.5, h*.98, h*.42, '#020000');
    for (let i = 0; i < 70; i++){ g.fillStyle = hexA(P[2], R()*.6); g.fillRect(R()*w, R()*h, 1 + R()*2, 1 + R()*2); }
  },
  lighthouse(g, w, h, P, R){
    sky(g, w, h, P); stars(g, w, h, R, 160, .6);
    const lx = w*.68, ly = h*.38;
    g.save(); g.globalCompositeOperation = 'lighter';
    const bg = g.createLinearGradient(lx, ly, 0, h*.2); bg.addColorStop(0, hexA(P[2], .55)); bg.addColorStop(1, hexA(P[2], 0));
    g.fillStyle = bg; g.beginPath(); g.moveTo(lx, ly); g.lineTo(-w*.1, h*.05); g.lineTo(-w*.1, h*.42); g.closePath(); g.fill(); g.restore();
    glow(g, lx, ly, w*.12, P[3], .9);
    g.fillStyle = '#0b0f14'; g.beginPath(); g.moveTo(lx - w*.035, ly + 6); g.lineTo(lx + w*.035, ly + 6); g.lineTo(lx + w*.06, h*.78); g.lineTo(lx - w*.06, h*.78); g.closePath(); g.fill();
    g.fillRect(lx - w*.045, ly - 12, w*.09, 18); g.beginPath(); g.moveTo(lx - w*.05, ly - 12); g.lineTo(lx, ly - 30); g.lineTo(lx + w*.05, ly - 12); g.fill();
    g.fillStyle = '#05080c'; g.beginPath(); g.moveTo(w*.4, h*.82); g.quadraticCurveTo(w*.66, h*.7, w*1.05, h*.75); g.lineTo(w, h); g.lineTo(w*.4, h); g.fill();
    for (let k = 0; k < 6; k++) smoothRidge(g, w, h, .8 + k*.035, .012, 9 + k*3, k, hexA(mix(P[1], '#000000', .4 + k*.08), 1));
    for (let i = 0; i < 60; i++){ g.fillStyle = hexA(P[2], R()*.25); g.fillRect(R()*w, h*.8 + R()*h*.2, 10 + R()*40, 1); }
  },
  boats(g, w, h, P, R){
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P[1]); gr.addColorStop(.55, mix(P[1], P[2], .5)); gr.addColorStop(.56, P[1]); gr.addColorStop(1, P[0]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h); glow(g, w*.75, h*.2, w*.3, P[2], .8);
    g.fillStyle = P[2]; g.beginPath(); g.arc(w*.75, h*.2, Math.min(w, h)*.07, 0, Math.PI*2); g.fill();
    for (let i = 0; i < 14; i++){ g.fillStyle = hexA('#ffffff', .4); g.beginPath(); g.ellipse(R()*w, R()*h*.45, 30 + R()*60, 8 + R()*10, 0, 0, Math.PI*2); g.fill(); }
    for (let i = 0; i < 80; i++){ g.strokeStyle = hexA('#ffffff', .12 + R()*.2); g.lineWidth = 1.5; const y = h*(.58 + R()*.42), x = R()*w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y - 4, x + 24, y); g.stroke(); }
    const boat = (x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.lineTo(x + s*.6, y + s*.45); g.lineTo(x - s*.6, y + s*.45); g.closePath(); g.fill();
      g.fillStyle = mix(col, '#000000', .15); g.beginPath(); g.moveTo(x - s*.5, y); g.lineTo(x, y - s*1.1); g.lineTo(x + s*.5, y); g.closePath(); g.fill(); };
    boat(w*.3, h*.66, w*.11, '#fffaf0'); boat(w*.58, h*.72, w*.08, P[3]); boat(w*.76, h*.63, w*.06, '#ffe9a8'); boat(w*.14, h*.8, w*.05, '#f6f2ff');
  },
  hills(g, w, h, P, R){
    sky(g, w, h, [P[1], mix(P[1], P[2], .45), P[2]]); glow(g, w*.3, h*.3, w*.45, P[3], .45);
    for (let i = 0; i < 6; i++) smoothRidge(g, w, h, .42 + i*.09, .05, 4 + i, i*1.3, mix(P[1], P[0], .25 + i*.14));
    // winding road + bus lights
    g.strokeStyle = hexA('#f2e6c8', .5); g.lineWidth = 3; g.beginPath(); g.moveTo(w*.1, h); g.bezierCurveTo(w*.6, h*.85, w*.2, h*.75, w*.7, h*.62); g.stroke();
    glow(g, w*.7, h*.62, 26, P[3], .9); g.fillStyle = '#fff3d0'; g.fillRect(w*.7 - 6, h*.62 - 3, 12, 6);
    for (let i = 0; i < 9; i++){ g.fillStyle = hexA('#ffffff', .5); g.beginPath(); g.arc(R()*w, h*.1 + R()*h*.25, 1.5, 0, Math.PI*2); g.fill(); }
  },
  pines(g, w, h, P, R){
    g.fillStyle = P[0]; g.fillRect(0, 0, w, h); glow(g, w*.5, h*.3, w*.5, P[1], .9);
    g.fillStyle = hexA('#f3ffe8', .92); g.beginPath(); g.arc(w*.5, h*.26, Math.min(w, h)*.1, 0, Math.PI*2); g.fill(); glow(g, w*.5, h*.26, w*.25, P[2], .3);
    const pine = (x, base, s, col) => { g.fillStyle = col; for (let k = 0; k < 5; k++){ const y = base - s*(.2 + k*.17), ww = s*(.32 - k*.05); g.beginPath(); g.moveTo(x - ww, y + s*.12); g.lineTo(x, y - s*.18); g.lineTo(x + ww, y + s*.12); g.fill(); } g.fillRect(x - s*.03, base - s*.2, s*.06, s*.2); };
    for (let layer = 0; layer < 4; layer++){ const col = mix(P[1], '#000000', .35 + layer*.2); for (let i = 0; i < 18; i++) pine(R()*w, h*(.68 + layer*.1), h*(.18 + layer*.07 + R()*.06), col); }
    for (let i = 0; i < 3; i++){ g.fillStyle = hexA(P[2], .08); g.fillRect(0, h*(.6 + i*.08), w, h*.05); }
    glow(g, w*.43, h*.8, 10, P[3], 1); glow(g, w*.47, h*.8, 10, P[3], 1);
  },
  sun(g, w, h, P, R){
    sky(g, w, h, [P[0], P[1], P[3]]);
    const cx = w*.5, cy = h*.42, r = Math.min(w, h)*.24;
    g.save(); g.translate(cx, cy); for (let i = 0; i < 36; i++){ g.rotate(Math.PI/18); g.fillStyle = hexA(P[2], .08); g.beginPath(); g.moveTo(0, 0); g.lineTo(w, -w*.05); g.lineTo(w, w*.05); g.fill(); } g.restore();
    glow(g, cx, cy, r*2.4, P[2], .5); g.fillStyle = P[2]; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.fill();
    ridge(g, w, h, .74, .06, mix(P[1], '#000000', .45), R, .05); ridge(g, w, h, .82, .03, mix(P[0], '#000000', .3), R, .03);
    figure(g, cx, h*.86, h*.4, '#0d0602');
    for (let i = 0; i < 120; i++){ g.fillStyle = hexA(P[3], R()*.5); g.fillRect(R()*w, h*.6 + R()*h*.4, 2, 2); }
  },
  comet(g, w, h, P, R){
    g.fillStyle = P[0]; g.fillRect(0, 0, w, h); stars(g, w, h, R, 300); glow(g, w*.7, h*.7, w*.55, P[1], .7);
    const planet = (x, y, r, a, b) => { const pg = g.createRadialGradient(x - r*.3, y - r*.3, r*.1, x, y, r); pg.addColorStop(0, a); pg.addColorStop(1, b); g.fillStyle = pg; g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill(); };
    planet(w*.18, h*.78, w*.16, P[3], P[1]); planet(w*.85, h*.22, w*.07, P[2], P[1]); planet(w*.7, h*.85, w*.05, '#ffe6a8', P[1]);
    const hx = w*.55, hy = h*.42;
    g.save(); g.translate(hx, hy); g.rotate(-.65);
    const tg = g.createLinearGradient(0, 0, w*.7, 0); tg.addColorStop(0, hexA(P[3], .85)); tg.addColorStop(1, hexA(P[2], 0));
    g.fillStyle = tg; g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(w*.35, -40, w*.7, 0); g.quadraticCurveTo(w*.35, 40, 0, 18); g.fill(); g.restore();
    glow(g, hx, hy, 60, '#ffffff', .9); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(hx, hy, 18, 0, Math.PI*2); g.fill();
    g.fillStyle = '#1b1240'; g.beginPath(); g.arc(hx - 6, hy - 3, 2.6, 0, Math.PI*2); g.arc(hx + 6, hy - 3, 2.6, 0, Math.PI*2); g.fill();
    g.strokeStyle = '#1b1240'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy + 3, 5, .2, Math.PI - .2); g.stroke();
  },
  dunes(g, w, h, P, R){
    sky(g, w, h, [P[0], P[1], P[3]]); glow(g, w*.3, h*.34, w*.3, P[2], .7);
    g.fillStyle = P[2]; g.beginPath(); g.arc(w*.3, h*.34, Math.min(w, h)*.08, 0, Math.PI*2); g.fill();
    for (let i = 0; i < 5; i++) smoothRidge(g, w, h, .55 + i*.09, .06, 3 + i*.7, i*2.1, mix(P[1], P[0], .1 + i*.18));
    // radio mast
    g.strokeStyle = '#140802'; g.lineWidth = 3; g.beginPath(); g.moveTo(w*.74, h*.62); g.lineTo(w*.74, h*.3); g.stroke(); glow(g, w*.74, h*.3, 14, '#ff4a2a', 1);
    figure(g, w*.62, h*.7, h*.13, '#140802');
  },
  stadium(g, w, h, P, R){
    g.fillStyle = P[0]; g.fillRect(0, 0, w, h); glow(g, w*.5, h*.15, w*.8, P[1], .7);
    for (const fx of [.12, .88]){ g.fillStyle = '#0a0f0b'; g.fillRect(w*fx - 3, h*.12, 6, h*.5);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++){ glow(g, w*fx - 12 + i*8, h*.1 + j*8, 22, '#ffffff', .5); g.fillStyle = '#ffffff'; g.fillRect(w*fx - 14 + i*8, h*.09 + j*8, 5, 5); } }
    g.fillStyle = mix(P[1], '#000000', .2); g.beginPath(); g.ellipse(w*.5, h*.95, w*.75, h*.32, 0, 0, Math.PI*2); g.fill();
    g.fillStyle = hexA(P[2], .5); g.fillRect(w*.47, h*.72, w*.06, h*.25);
    figure(g, w*.5, h*.86, h*.3, '#020a05');
    for (let i = 0; i < 300; i++){ g.fillStyle = hexA(P[2], R()*.35); g.fillRect(R()*w, h*.45 + R()*h*.15, 2, 2); }
  },
};

/* ------------------------------------------------------------- composition */
function paintScene(g, w, h, m){
  const R = rng(hash(m.id + '|art'));
  (MOTIF[m.motif] || MOTIF.planet)(g, w, h, m.palette, R);
  vignette(g, w, h);
}
function wrapTitle(g, text, maxW){
  const words = text.toUpperCase().split(' '), lines = []; let line = '';
  for (const wd of words){ const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line){ lines.push(line); line = wd; } else line = t; }
  lines.push(line); return lines;
}
export function posterCanvas(m, w = 480, h = 720){
  const key = `p|${m.id}|${w}`; if (cache.has(key)) return cache.get(key);
  const c = mk(w, h), g = c.getContext('2d');
  paintScene(g, w, h, m);
  const fade = g.createLinearGradient(0, h*.55, 0, h); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = fade; g.fillRect(0, h*.55, w, h*.45);
  // title
  let size = w*.16; g.font = `800 ${size}px ${DISPLAY}`;
  let lines = wrapTitle(g, m.title, w*.86);
  while (lines.length > 2 || lines.some(l => g.measureText(l).width > w*.88)){ size *= .92; g.font = `800 ${size}px ${DISPLAY}`; lines = wrapTitle(g, m.title, w*.86); }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fbf6ea'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 18;
  const ty = h*.84 - (lines.length - 1)*size*.9;
  lines.forEach((l, i) => g.fillText(l, w/2, ty + i*size*.9));
  g.shadowBlur = 0;
  g.font = `500 ${w*.032}px "Geist", sans-serif`; g.fillStyle = 'rgba(255,255,255,.78)'; g.fillText(m.tagline, w/2, ty - size*.95);
  // billing block
  g.font = `600 ${w*.017}px "Geist", sans-serif`; g.fillStyle = 'rgba(255,255,255,.42)';
  const bill = `A FILM BY ${m.director.toUpperCase()}   ${m.cast.slice(0, 3).map(n => n.replace('Voice: ', '').toUpperCase()).join('   ')}`;
  g.fillText(bill, w/2, h*.93, w*.9);
  g.fillText('MUSIC BY R. ANANTHAN · EDITED BY LEE SOKOLOV · PRODUCED BY REELHOUSE ORIGINALS', w/2, h*.955, w*.9);
  grain(g, w, h, rng(hash(m.id + 'grain')), .05);
  cache.set(key, c); return c;
}
export function backdropCanvas(m, w = 1280, h = 720){
  const key = `b|${m.id}|${w}`; if (cache.has(key)) return cache.get(key);
  const c = mk(w, h), g = c.getContext('2d');
  paintScene(g, w, h, m);
  grain(g, w, h, rng(hash(m.id + 'bgrain')), .035);
  cache.set(key, c); return c;
}
const urlCache = new Map();
export function posterURL(m, w = 480){ const k = 'p' + m.id + w; if (!urlCache.has(k)) urlCache.set(k, posterCanvas(m, w, Math.round(w*1.5)).toDataURL('image/jpeg', .86)); return urlCache.get(k); }
export function backdropURL(m, w = 1280){ const k = 'b' + m.id + w; if (!urlCache.has(k)) urlCache.set(k, backdropCanvas(m, w, Math.round(w*9/16)).toDataURL('image/jpeg', .82)); return urlCache.get(k); }
