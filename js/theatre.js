// Reelhouse 3D auditorium — renders a LAYOUTS[...] entry from data.js as a stadium-seated cinema.
// API: createTheatre(canvas, opts) → { refresh, viewFromSeat, overview, view360, nudge360, setSpin360, zoom360, viewScore, resize, setActive, dispose }.
// Throws if WebGL is unavailable so the app can fall back to its 2D map.
//
// World frame: screen plane at z ≈ 0 facing +z, seating extends toward +z, row A nearest the screen.
// 1 seat-width unit (data.js x/w) = SW metres.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const SW = 0.6;                     // metres per seat-width unit
const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a)*t;
const easeIO = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

const CAT_COL = { classic:'#1d4f66', prime:'#952033', recliner:'#5c1820', motion:'#3a3e46' };
const WHEEL_COL = '#2f6fd6';
const SOLD_COL = '#2a2a2f';
const GOLD = '#ffcb5c';

let rectLibReady = false;

export function createTheatre(canvas, opts){
  const { layout, screenImage, palette = ['#0a0a0c', '#333', '#ccc', GOLD], format = '2D',
          stateOf = () => 'available', onHover = () => {}, onSeatClick = () => {}, onViewChange = () => {} } = opts;

  /* ------------------------------------------------------------ renderer */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance' }); }
  catch (e) { throw new Error('WebGL unavailable: ' + (e && e.message)); }
  if (!renderer.getContext()) throw new Error('WebGL unavailable');
  if (!rectLibReady){ RectAreaLightUniformsLib.init(); rectLibReady = true; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const PR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(PR);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050406');
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 200);

  // everything we allocate is tracked so dispose() can free it
  const owned = new Set();
  const own = x => (owned.add(x), x);
  const G = g => own(g), M = m => own(m), TX = t => own(t);
  const add = (geo, mat, parent = scene) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

  /* ------------------------------------------------------------ textures */
  function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = TX(new THREE.CanvasTexture(c)); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const seeded = seed => () => { seed = (seed*16807) % 2147483647; return (seed - 1)/2147483646; };
  const carpetTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#17121a'; g.fillRect(0, 0, w, h);
    const r = seeded(7);
    for (let i = 0; i < 6000; i++){ const v = r(); g.fillStyle = v > .5 ? `rgba(255,220,200,${.015 + r()*.03})` : `rgba(0,0,0,${.06 + r()*.08})`; g.fillRect(r()*w, r()*h, 1 + r()*1.5, 1 + r()*1.5); }
    g.strokeStyle = 'rgba(160,60,80,.16)'; g.lineWidth = 2;
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64){ g.beginPath(); g.moveTo(x + 32, y + 12); g.lineTo(x + 52, y + 32); g.lineTo(x + 32, y + 52); g.lineTo(x + 12, y + 32); g.closePath(); g.stroke(); }
    g.fillStyle = 'rgba(255,190,90,.10)'; for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64){ g.beginPath(); g.arc(x, y, 3, 0, Math.PI*2); g.fill(); }
  }, { repeat:true });
  const fabricTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#1b171c'; g.fillRect(0, 0, w, h); const r = seeded(11);
    for (let i = 0; i < 2500; i++){ g.fillStyle = `rgba(${r() > .5 ? '255,255,255' : '0,0,0'},${.02 + r()*.04})`; g.fillRect(r()*w, r()*h, 1, 1 + r()*3); }
  }, { repeat:true });
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const exitTex = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#0e7a3a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#eafff1'; g.font = 'bold 58px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', w/2 + 22, h/2 + 3);
    // running-man arrow hint
    g.beginPath(); g.moveTo(30, h/2); g.lineTo(56, h/2 - 18); g.lineTo(56, h/2 + 18); g.closePath(); g.fill();
  });
  const wheelTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.arc(58, 22, 10, 0, Math.PI*2); g.fill();                 // head
    g.beginPath(); g.moveTo(58, 38); g.lineTo(58, 70); g.lineTo(86, 70); g.lineTo(98, 100); g.stroke();   // body + leg
    g.beginPath(); g.moveTo(58, 50); g.lineTo(82, 50); g.stroke();             // arm
    g.beginPath(); g.arc(56, 84, 28, Math.PI*0.15, Math.PI*1.55); g.stroke();  // wheel
  });

  /* ------------------------------------------------------------ geometry of the room */
  const isImax = /IMAX/i.test(format);
  const curve = layout.curve, rise = layout.rise;
  const kindOfRow = row => row.seats.some(s => s.kind === 'recliner') ? 'recliner' : row.seats.some(s => s.kind === 'motion') ? 'motion' : 'std';
  const BACK_OFF = { std:0.42, recliner:0.56, motion:0.46 };
  const rows3 = []; let zf = layout.screenDist;
  layout.rows.forEach((row, r) => {
    const kind = kindOfRow(row);
    const d = kind === 'recliner' ? Math.max(1.7, layout.pitch) : Math.max(0.95, layout.pitch);
    rows3.push({ row, r, kind, zf, d, y: r*rise });
    zf += d;
  });
  const lastRow = rows3[rows3.length - 1];
  const yTop = lastRow.y;
  const zBackSeats = lastRow.zf + lastRow.d;
  const zBack = zBackSeats + 1.9;                                           // cross-aisle behind the last row
  let maxExtent = 0;
  for (const s of layout.seats) maxExtent = Math.max(maxExtent, (Math.abs(s.x) + s.w/2)*SW);
  const halfRoom = maxExtent + 1.75;
  const curveZ = x => curve*x*x;                                            // rows bow toward the screen at the ends

  // screen
  const scrW = layout.screenW;
  const scrAspect = isImax ? 1.55 : 2.05;
  const scrH = scrW/scrAspect;
  const scrBottom = isImax ? 0.75 : 1.35;
  const scrTop = scrBottom + scrH;
  const scrCY = scrBottom + scrH/2;
  const yCeil = Math.max(yTop + 3.8, scrTop + 1.5);

  // floor height under a z position (centre line)
  const floorAt = z => { if (z < rows3[0].zf) return 0; for (const r of rows3) if (z < r.zf + r.d) return r.y; return yTop; };

  /* ------------------------------------------------------------ materials */
  const mat = {
    carpet: M(new THREE.MeshStandardMaterial({ map:carpetTex, roughness:1 })),
    riser: M(new THREE.MeshStandardMaterial({ color:'#120e12', roughness:.95 })),
    fabric: M(new THREE.MeshStandardMaterial({ map:fabricTex, color:'#ffffff', roughness:1 })),
    slat: M(new THREE.MeshStandardMaterial({ color:'#2f2219', roughness:.6, metalness:.05 })),
    dark: M(new THREE.MeshStandardMaterial({ color:'#0b0a0d', roughness:.95 })),
    ceiling: M(new THREE.MeshStandardMaterial({ color:'#0c0b0f', roughness:1 })),
    mask: M(new THREE.MeshStandardMaterial({ color:'#040405', roughness:1 })),
    curtain: M(new THREE.MeshStandardMaterial({ color:'#3b0c14', roughness:.88, side:THREE.DoubleSide })),
    stage: M(new THREE.MeshStandardMaterial({ color:'#1a1310', roughness:.7 })),
    velvet: M(new THREE.MeshStandardMaterial({ color:'#ffffff', roughness:.86 })),
    leather: M(new THREE.MeshStandardMaterial({ color:'#ffffff', roughness:.46 })),
    plastic: M(new THREE.MeshStandardMaterial({ color:'#16151a', roughness:.55, metalness:.15 })),
    metal: M(new THREE.MeshStandardMaterial({ color:'#5b5f67', roughness:.32, metalness:.85 })),
    accent: M(new THREE.MeshBasicMaterial({ color: hdr('#ff7a1a', 0.75) })),
    person: M(new THREE.MeshStandardMaterial({ color:'#ffffff', roughness:.92 })),
    shell: M(new THREE.MeshStandardMaterial({ color:'#ffd88a', emissive:GOLD, emissiveIntensity:.55, roughness:.5 })),
    decal: M(new THREE.MeshStandardMaterial({ color:'#ffffff', roughness:.8, polygonOffset:true, polygonOffsetFactor:-2 })),
    symbol: M(new THREE.MeshBasicMaterial({ map:wheelTex, transparent:true, depthWrite:false, color:'#e9eef8', polygonOffset:true, polygonOffsetFactor:-4 })),
    stepLed: M(new THREE.MeshBasicMaterial({ color: hdr('#ffb35c', 1.9) })),
    sconce: M(new THREE.MeshBasicMaterial({ color: hdr('#ffc98a', 1.5) })),
    downlight: M(new THREE.MeshBasicMaterial({ color: hdr('#ffe9cc', 1.15) })),
    exit: M(new THREE.MeshBasicMaterial({ map:exitTex, color: hdr('#ffffff', 1.25) })),
    booth: M(new THREE.MeshBasicMaterial({ color: hdr('#fff1d6', 1.35) })),
    glow: M(new THREE.MeshBasicMaterial({ map:glowTex, color:'#ffb26b', transparent:true, opacity:.22, blending:THREE.AdditiveBlending, depthWrite:false })),
    pool: M(new THREE.MeshBasicMaterial({ map:glowTex, color:GOLD, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false })),
  };

  /* ------------------------------------------------------------ floor: stepped, curved platforms */
  carpetTex.repeat.set(1, 1);
  (function buildFloor(){
    const pos = [], uv = [], nor = [], idx = [];
    const quad = (a, b, c, d, n, uva, uvb, uvc, uvd) => {
      const i = pos.length/3; pos.push(...a, ...b, ...c, ...d); nor.push(...n, ...n, ...n, ...n); uv.push(...uva, ...uvb, ...uvc, ...uvd);
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    const N = 48, x0 = -halfRoom, x1 = halfRoom, U = 1.4;
    const strip = (zA, zB, y) => {          // horizontal curved strip from zA(x) to zB(x)
      for (let k = 0; k < N; k++){
        const xa = lerp(x0, x1, k/N), xb = lerp(x0, x1, (k + 1)/N);
        const a = [xa, y, zA - curveZ(xa)], b = [xb, y, zA - curveZ(xb)], c = [xb, y, zB - curveZ(xb)], d = [xa, y, zB - curveZ(xa)];
        quad(a, d, c, b, [0, 1, 0], [a[0]/U, -a[2]/U], [d[0]/U, -d[2]/U], [c[0]/U, -c[2]/U], [b[0]/U, -b[2]/U]);
      }
    };
    const riser = (z, y0, y1) => {
      for (let k = 0; k < N; k++){
        const xa = lerp(x0, x1, k/N), xb = lerp(x0, x1, (k + 1)/N), za = z - curveZ(xa), zb = z - curveZ(xb);
        quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], [0, 0, 1], [xa/U, y0/U], [xb/U, y0/U], [xb/U, y1/U], [xa/U, y1/U]);
      }
    };
    strip(-1.0, rows3[0].zf, 0);
    rows3.forEach((r, i) => { strip(r.zf, r.zf + r.d, r.y); if (i > 0) riser(r.zf, rows3[i - 1].y, r.y); });
    strip(zBackSeats, zBack + curveZ(halfRoom) + 0.5, yTop);
    const geo = G(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    add(geo, mat.carpet);
    // dark fill under the stepped floor so the sides never show gaps
    const under = add(G(new THREE.BoxGeometry(halfRoom*2, 0.02, zBack + 2)), mat.riser); under.position.set(0, -0.012, (zBack - 1)/2);
  })();

  /* ------------------------------------------------------------ walls, ceiling, stage, screen */
  const roomLen = zBack + 1.2;
  const wallGeo = G(new THREE.PlaneGeometry(roomLen, yCeil + 0.2));
  for (const s of [-1, 1]){
    const w = add(wallGeo, mat.fabric); w.rotation.y = -s*Math.PI/2; w.position.set(s*halfRoom, (yCeil + 0.2)/2 - 0.1, roomLen/2 - 1.2);
  }
  fabricTex.repeat.set(roomLen/2, (yCeil + 0.2)/2);
  const ceil = add(G(new THREE.PlaneGeometry(halfRoom*2, roomLen)), mat.ceiling); ceil.rotation.x = Math.PI/2; ceil.position.set(0, yCeil, roomLen/2 - 1.2);
  const back = add(G(new THREE.PlaneGeometry(halfRoom*2, yCeil + 0.2)), mat.fabric); back.rotation.y = Math.PI; back.position.set(0, (yCeil + 0.2)/2 - 0.1, zBack + curveZ(halfRoom)*0 + 0.0);
  const front = add(G(new THREE.PlaneGeometry(halfRoom*2, yCeil + 0.2)), mat.mask); front.position.set(0, (yCeil + 0.2)/2 - 0.1, -0.6);

  // acoustic slats along the side walls, following the stepped floor
  (function slats(){
    const zs = []; for (let z = 0.6; z < zBack - 0.4; z += 0.5) zs.push(z);
    const im = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.05, 1, 0.09)), mat.slat, zs.length*2);
    const m = new THREE.Matrix4(); let k = 0;
    for (const s of [-1, 1]) for (const z of zs){
      const y0 = floorAt(z) + 0.9, y1 = yCeil - 0.35, h = Math.max(0.5, y1 - y0);
      m.compose(new V3(s*(halfRoom - 0.05), (y0 + y1)/2, z), new THREE.Quaternion(), new V3(1, h, 1)); im.setMatrixAt(k++, m);
    }
    im.computeBoundingSphere(); scene.add(im);
    // wainscot rail at slat base
    for (const s of [-1, 1]){
      const rail = add(G(new THREE.BoxGeometry(0.06, 0.06, zBack)), mat.slat); rail.position.set(s*(halfRoom - 0.05), 0, zBack/2);
      rail.visible = false; // stepped floor makes a single rail look wrong; slats carry the look
    }
  })();

  // stage + screen + masking + curtains
  const stageH = isImax ? 0.3 : 0.5;
  const stage = add(G(new THREE.BoxGeometry(halfRoom*2, stageH, 1.6)), mat.stage); stage.position.set(0, stageH/2, 0.15);
  const stageLip = add(G(new THREE.BoxGeometry(halfRoom*2, 0.03, 0.03)), mat.stepLed); stageLip.position.set(0, stageH - 0.02, 0.96);

  const screenTex = TX(new THREE.CanvasTexture(screenImage)); screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const imgAspect = (screenImage.width || 16)/(screenImage.height || 9);
  const crop = scrAspect > imgAspect ? { x:1, y:imgAspect/scrAspect } : { x:scrAspect/imgAspect, y:1 };
  // screens curve toward the audience (IMAX strongly); masking strips follow the same arc
  const scrR = scrW*(isImax ? 2.1 : 3.6);
  const bentPlane = (w, h) => {
    const g = new THREE.PlaneGeometry(w, h, 48, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++){ const x = p.getX(i), a = x/scrR; p.setX(i, scrR*Math.sin(a)); p.setZ(i, scrR*(1 - Math.cos(a))); }
    g.computeVertexNormals(); return G(g);
  };
  const edgeZ = scrR*(1 - Math.cos((scrW/2 + 0.6)/scrR));
  const screenGeo = bentPlane(scrW, scrH);
  const screenMat = M(new THREE.MeshBasicMaterial({ map:screenTex, color:'#ffffff' }));
  const screen = add(screenGeo, screenMat); screen.position.set(0, scrCY, 0);
  // black masking frame
  const maskT = add(bentPlane(scrW + 1.2, 0.55), mat.mask); maskT.position.set(0, scrTop + 0.27, 0.01);
  const maskB = add(bentPlane(scrW + 1.2, 0.3), mat.mask); maskB.position.set(0, scrBottom - 0.15, 0.01);
  for (const s of [-1, 1]){ const mk = add(G(new THREE.PlaneGeometry(0.6, scrH + 0.85)), mat.mask); mk.position.set(s*(scrW/2 + 0.3)*Math.cos((scrW/2)/scrR), scrCY + 0.06, edgeZ*0.92 + 0.01); mk.rotation.y = -s*(scrW/2)/scrR; }

  // folded velvet curtains filling the proscenium either side of the screen and a valance above
  function foldedPlane(w, h, folds, depth, vertical = true){
    const g = new THREE.PlaneGeometry(w, h, Math.max(8, Math.round(folds*8)), vertical ? 1 : 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++){ const u = vertical ? p.getX(i)/w : p.getY(i)/h; p.setZ(i, Math.sin(u*Math.PI*2*folds)*depth); }
    g.computeVertexNormals(); return G(g);
  }
  const sideW = halfRoom - scrW/2 - 0.45;
  if (sideW > 0.3){
    const cg = foldedPlane(sideW, yCeil, sideW*2.2, 0.07);
    for (const s of [-1, 1]){ const c = add(cg, mat.curtain); c.position.set(s*(scrW/2 + 0.45 + sideW/2), yCeil/2, edgeZ + 0.45); }
  }
  const valH = yCeil - scrTop - 0.5;
  if (valH > 0.2){ const v = add(foldedPlane(halfRoom*2, valH, halfRoom*1.6, 0.05), mat.curtain); v.position.set(0, scrTop + 0.5 + valH/2, edgeZ + 0.5); }
  // tall curtain legs framing the screen edge
  for (const s of [-1, 1]){ const leg = add(foldedPlane(0.7, yCeil, 1.5, 0.06), mat.curtain); leg.position.set(s*(scrW/2 + 0.75), yCeil/2, edgeZ + 0.2); }

  /* ------------------------------------------------------------ lighting */
  const screenAvg = (() => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 6; const g = c.getContext('2d'); g.drawImage(screenImage, 0, 0, 6, 6);
      const d = g.getImageData(0, 0, 6, 6).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4){ r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length/4; return new THREE.Color(r/n/255, gg/n/255, b/n/255);
    } catch { return new THREE.Color(palette[2]); }
  })();
  const spill = new THREE.Color(palette[2]).lerp(screenAvg, .5).lerp(new THREE.Color('#ffffff'), .35);
  scene.add(new THREE.HemisphereLight('#4f4660', '#140d0d', 0.7));
  const rect = new THREE.RectAreaLight(spill, isImax ? 3.2 : 3.6, scrW, scrH);
  rect.position.set(0, scrCY, 0.4); rect.lookAt(0, scrCY, 20); scene.add(rect);
  const fill = new THREE.DirectionalLight(spill, 0.35); fill.position.set(0, scrCY, -2); fill.target.position.set(0, yTop*0.5, zBack); scene.add(fill, fill.target);
  const backFill = new THREE.DirectionalLight('#ffcf9e', 0.55); backFill.position.set(0, yCeil, zBack + 4); backFill.target.position.set(0, 0, zBack*0.4); scene.add(backFill, backFill.target);

  // wall sconces: emissive fitting + additive wash on the wall; a few real point lights for warmth
  (function sconces(){
    const zs = []; for (let z = 3.2; z < zBack - 1.2; z += 4.2) zs.push(z);
    const fit = G(new THREE.BoxGeometry(0.1, 0.26, 0.12)), wash = G(new THREE.PlaneGeometry(1.3, 2.6));
    zs.forEach((z, i) => {
      for (const s of [-1, 1]){
        const y = floorAt(z) + 2.5;
        const f = add(fit, mat.sconce); f.position.set(s*(halfRoom - 0.08), y, z);
        const w = add(wash, mat.glow); w.position.set(s*(halfRoom - 0.02), y + 0.35, z); w.rotation.y = -s*Math.PI/2;
        if (i % 2 === 0){ const l = new THREE.PointLight('#ffb978', 2.6, 6.5, 2); l.position.set(s*(halfRoom - 0.6), y, z); scene.add(l); }
      }
    });
  })();

  // recessed ceiling downlights (dim)
  (function downlights(){
    const pts = []; for (let z = 2; z < zBack - 0.5; z += 2.6) for (let x = -halfRoom + 1.6; x <= halfRoom - 1.6; x += 2.8) pts.push([x, z]);
    const im = new THREE.InstancedMesh(G(new THREE.CircleGeometry(0.07, 18).rotateX(Math.PI/2)), mat.downlight, pts.length);
    const m = new THREE.Matrix4(); pts.forEach(([x, z], i) => { m.makeTranslation(x, yCeil - 0.01, z); im.setMatrixAt(i, m); });
    im.computeBoundingSphere(); scene.add(im);
  })();

  // aisle step LEDs on every riser at each aisle edge
  (function stepLights(){
    const spots = [];
    rows3.forEach((r, i) => {
      if (i === 0) return;
      const xs = r.row.seats.map(s => [(s.x - s.w/2)*SW, (s.x + s.w/2)*SW]).sort((a, b) => a[0] - b[0]);
      const aisles = [xs[0][0] - 0.75, xs[xs.length - 1][1] + 0.75];
      for (let k = 0; k < xs.length - 1; k++) if (xs[k + 1][0] - xs[k][1] > 0.3) aisles.push((xs[k][1] + xs[k + 1][0])/2);
      for (const a of aisles) for (const d of [-0.26, 0.26]){ const x = a + d; spots.push([x, r.y - 0.05, r.zf - curveZ(x) + 0.006]); }
    });
    const im = new THREE.InstancedMesh(G(new THREE.BoxGeometry(0.07, 0.022, 0.012)), mat.stepLed, Math.max(1, spots.length));
    const m = new THREE.Matrix4(); spots.forEach(([x, y, z], i) => { m.makeTranslation(x, y, z); im.setMatrixAt(i, m); });
    im.count = spots.length; im.computeBoundingSphere(); scene.add(im);
  })();

  // EXIT signs + doors
  (function exits(){
    const sign = G(new THREE.BoxGeometry(0.62, 0.22, 0.05)), door = G(new THREE.PlaneGeometry(1.2, 2.2)), frame = G(new THREE.PlaneGeometry(1.36, 2.32));
    const place = (x, y, z, ry) => {
      const fr = add(frame, mat.slat); fr.position.set(x, y + 1.16, z); fr.rotation.y = ry; fr.translateZ(0.01);
      const d = add(door, mat.dark); d.position.set(x, y + 1.1, z); d.rotation.y = ry; d.translateZ(0.02);
      const sg = add(sign, [mat.dark, mat.dark, mat.dark, mat.dark, mat.exit, mat.dark]); sg.position.set(x, y + 2.55, z); sg.rotation.y = ry; sg.translateZ(0.05);
    };
    const zf0 = Math.max(1.6, rows3[0].zf - 2.4);
    place(-halfRoom + 0.005, 0, zf0, Math.PI/2); place(halfRoom - 0.005, 0, zf0, -Math.PI/2);
    place(-halfRoom + 1.6, yTop, zBack - 0.005, Math.PI); place(halfRoom - 1.6, yTop, zBack - 0.005, Math.PI);
  })();

  // projection booth window + volumetric beam + dust motes
  const yWin = Math.min(yCeil - 1.2, yTop + 2.1);
  const winMesh = add(G(new THREE.PlaneGeometry(1.3, 0.62)), mat.booth); winMesh.position.set(0, yWin, zBack - 0.02); winMesh.rotation.y = Math.PI;
  const winFrame = add(G(new THREE.PlaneGeometry(1.5, 0.82)), mat.dark); winFrame.position.set(0, yWin, zBack - 0.01); winFrame.rotation.y = Math.PI;
  const beamMat = M(new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    uniforms:{ uTime:{ value:0 }, uColor:{ value: spill.clone().lerp(new THREE.Color('#ffffff'), .5) }, uOpacity:{ value: .05 } },
    vertexShader:`attribute float along; varying float vAlong; varying vec3 vP; void main(){ vAlong = along; vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying float vAlong; varying vec3 vP;
      void main(){ float n = 0.5 + 0.5*sin(vP.x*1.9 + uTime*0.35)*sin(vP.y*2.7 - uTime*0.22 + vP.z*0.6);
        float a = uOpacity*mix(1.0, 0.25, vAlong)*(0.55 + 0.45*n)*smoothstep(0.0, 0.04, vAlong);
        gl_FragColor = vec4(uColor*a, a); }`,
  }));
  (function beam(){
    const W0 = [[-0.22, yWin - 0.12], [0.22, yWin - 0.12], [0.22, yWin + 0.12], [-0.22, yWin + 0.12]];
    const S0 = [[-scrW/2, scrBottom], [scrW/2, scrBottom], [scrW/2, scrTop], [-scrW/2, scrTop]];
    const pos = [], along = [];
    for (let k = 0; k < 4; k++){
      const a = W0[k], b = W0[(k + 1) % 4], c = S0[(k + 1) % 4], d = S0[k];
      const za = zBack - 0.05, zs = 0.2;
      pos.push(a[0], a[1], za, b[0], b[1], za, c[0], c[1], zs, a[0], a[1], za, c[0], c[1], zs, d[0], d[1], zs);
      along.push(0, 0, 1, 0, 1, 1);
    }
    const g = G(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    const b = add(g, beamMat); b.renderOrder = 5; b.frustumCulled = false;
  })();
  const dust = (() => {
    const n = 260, p = new Float32Array(n*3), seed = seeded(23);
    for (let i = 0; i < n; i++){
      const u = 0.18 + seed()*0.78, x = lerp(0, (seed() - .5)*scrW*.95, u), y = lerp(yWin, scrBottom + seed()*scrH, u), z = lerp(zBack - 0.05, 0.2, u);
      p.set([x, y, z], i*3);
    }
    const g = G(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = M(new THREE.PointsMaterial({ color:'#fff4e0', map:glowTex, size:0.035, transparent:true, opacity:.28, depthWrite:false, blending:THREE.AdditiveBlending }));
    const pts = new THREE.Points(g, m); scene.add(pts); return { pts, base: p.slice() };
  })();

  /* ------------------------------------------------------------ seat models (local: origin on floor at seat centre, facing −z) */
  const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r);
  // RoundedBoxGeometry is non-indexed while Box/Cylinder/Sphere are indexed — normalise before merging
  const merge = parts => mergeGeometries(parts.map(g => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); return n; }));
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, h) => new THREE.CylinderGeometry(r, r, h, 14);
  const MODELS = {
    std: { baseW:1, eye:1.15, person:[0, 0, 0],
      uph: G(merge([ rb(.52, .11, .48, .04).translate(0, .45, -.05), rb(.53, .62, .1, .045).rotateX(.18).translate(0, .82, .24) ])),
      frame: G(merge([ bx(.045, .62, .52).translate(-.285, .31, .02), bx(.045, .62, .52).translate(.285, .31, .02),
        bx(.07, .035, .46).translate(-.285, .64, -.01), bx(.07, .035, .46).translate(.285, .64, -.01), cyl(.038, .03).translate(.285, .665, -.19) ])),
    },
    recliner: { baseW:1.45, eye:1.06, person:[0, 0.05, 0.05],
      uph: G(merge([ rb(.6, .2, .62, .07).translate(0, .4, -.03), rb(.6, .72, .2, .08).rotateX(.24).translate(0, .88, .3),
        rb(.46, .17, .13, .06).rotateX(.24).translate(0, 1.2, .38), rb(.54, .11, .2, .045).translate(0, .27, -.42),
        rb(.12, .32, .74, .05).translate(-.36, .46, 0), rb(.12, .32, .74, .05).translate(.36, .46, 0) ])),
      frame: G(merge([ bx(.82, .3, .66).translate(0, .15, 0), cyl(.04, .025).translate(-.36, .625, -.26), cyl(.04, .025).translate(.36, .625, -.26) ])),
    },
    motion: { baseW:1, eye:1.32, person:[0, 0.2, 0],
      uph: G(merge([ rb(.5, .12, .48, .04).translate(0, .64, -.04), rb(.5, .66, .11, .045).rotateX(.16).translate(0, 1.02, .24) ])),
      frame: G(merge([ bx(.06, .3, .5).translate(-.28, .72, 0), bx(.06, .3, .5).translate(.28, .72, 0),
        bx(.09, .04, .48).translate(-.28, .88, -.01), bx(.09, .04, .48).translate(.28, .88, -.01), bx(.52, .06, .14).translate(0, .14, -.38) ])),
      metal: G(merge([ bx(.42, .46, .44).translate(0, .3, .02), bx(.6, .06, .62).translate(0, .03, 0) ])),
      accent: G(merge([ bx(.014, .3, .012).rotateX(.16).translate(-.245, 1.08, .3), bx(.014, .3, .012).rotateX(.16).translate(.245, 1.08, .3) ])),
    },
  };
  const personGeo = G(merge([ new THREE.SphereGeometry(.105, 16, 12).translate(0, 1.21, .17), rb(.42, .3, .22, .09).translate(0, .93, .21) ]));
  const decalGeo = G(new THREE.PlaneGeometry(.78, .78).rotateX(-Math.PI/2).translate(0, .008, 0));
  const symbolGeo = G(new THREE.PlaneGeometry(.52, .52).rotateX(-Math.PI/2).translate(0, .012, 0));
  const poolGeo = G(new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI/2).translate(0, .015, -.05));

  /* ------------------------------------------------------------ place seats */
  const FOCAL_Z = -18;                      // seats yaw toward a point behind the screen (gentle, like real rows)
  const S3 = new Map();                     // seat.id → placement
  const rowOf = new Map(rows3.map(r => [r.row.label, r]));
  for (const s of layout.seats){
    const r = rowOf.get(s.row), xm = s.x*SW;
    const rowKind = r.kind, kind = s.kind === 'wheelchair' ? 'wheelchair' : (s.kind === 'recliner' ? 'recliner' : s.kind === 'motion' ? 'motion' : 'std');
    const z = r.zf + r.d - BACK_OFF[rowKind] - curveZ(xm);
    const yaw = Math.atan2(xm, z - FOCAL_Z);
    const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), yaw);
    const pos = new V3(xm, r.y, z);
    const model = MODELS[kind === 'wheelchair' ? rowKind : kind];
    const m = new THREE.Matrix4().compose(pos, q, new V3(kind === 'wheelchair' ? 1 : s.w/model.baseW, 1, 1));
    S3.set(s.id, { seat:s, kind, pos, q, m, eye: kind === 'wheelchair' ? 1.25 : model.eye, model });
  }

  // instanced groups per kind
  const groups = {};
  const pick = [];
  for (const kind of ['std', 'recliner', 'motion', 'wheelchair']){
    const list = [...S3.values()].filter(p => p.kind === kind); if (!list.length) continue;
    const n = list.length, mkIM = (geo, mt, cnt = n) => { const im = new THREE.InstancedMesh(geo, mt, cnt); scene.add(im); return im; };
    const g = { list };
    if (kind === 'wheelchair'){
      g.uph = mkIM(decalGeo, mat.decal); g.sym = mkIM(symbolGeo, mat.symbol);
      list.forEach((p, i) => { g.uph.setMatrixAt(i, p.m); g.sym.setMatrixAt(i, p.m); g.uph.setColorAt(i, new THREE.Color(WHEEL_COL)); });
      g.uph.userData.list = list.map(p => p.seat); pick.push(g.uph);
    } else {
      const md = MODELS[kind];
      g.uph = mkIM(md.uph, kind === 'recliner' ? mat.leather : mat.velvet);
      g.frame = mkIM(md.frame, mat.plastic);
      if (md.metal) g.metal = mkIM(md.metal, mat.metal);
      if (md.accent) g.accent = mkIM(md.accent, mat.accent);
      g.shell = mkIM(md.uph, mat.shell); g.shell.count = 0; g.shell.frustumCulled = false;
      list.forEach((p, i) => { for (const im of [g.uph, g.frame, g.metal, g.accent]) if (im) im.setMatrixAt(i, p.m); g.uph.setColorAt(i, new THREE.Color(CAT_COL[p.seat.cat])); });
      g.uph.userData.list = g.frame.userData.list = list.map(p => p.seat); pick.push(g.uph, g.frame);
      if (g.metal){ g.metal.userData.list = g.uph.userData.list; pick.push(g.metal); }
    }
    for (const k of ['uph', 'frame', 'metal', 'accent', 'sym']) if (g[k]) g[k].computeBoundingSphere();
    groups[kind] = g;
  }
  const persons = new THREE.InstancedMesh(personGeo, mat.person, Math.max(1, layout.seats.length)); persons.count = 0; persons.frustumCulled = false; scene.add(persons);
  persons.userData.list = []; pick.push(persons);
  const pools = new THREE.InstancedMesh(poolGeo, mat.pool, Math.max(1, layout.seats.length)); pools.count = 0; pools.frustumCulled = false; pools.renderOrder = 4; scene.add(pools);

  /* ------------------------------------------------------------ seat colouring */
  let hovered = null;
  const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), hiK = new THREE.Matrix4().makeScale(1.035, 1.015, 1.035);
  const PERSON_COLS = ['#17161b', '#1d1a17', '#141820', '#201618', '#191919'].map(h => new THREE.Color(h));
  const safeState = s => { const st = stateOf(s); return st === 'available' || st === 'selected' ? st : 'sold'; };
  function colorFor(p, st, hov){
    if (st === 'selected') return tmpC.set(GOLD);
    if (st === 'sold') return tmpC.set(p.kind === 'wheelchair' ? '#3a3d44' : SOLD_COL);
    tmpC.set(p.kind === 'wheelchair' ? WHEEL_COL : CAT_COL[p.seat.cat]);
    if (hov) tmpC.lerp(new THREE.Color('#ffffff'), .3);
    return tmpC;
  }
  function paint(seat){
    const p = S3.get(seat.id); if (!p) return; const g = groups[p.kind], i = g.list.indexOf(p);
    g.uph.setColorAt(i, colorFor(p, safeState(seat), hovered === seat)); g.uph.instanceColor.needsUpdate = true;
  }
  function refresh(){
    let pc = 0, sc = 0;
    persons.userData.list = [];
    for (const g of Object.values(groups)){
      let shellN = 0;
      g.list.forEach((p, i) => {
        const st = safeState(p.seat);
        g.uph.setColorAt(i, colorFor(p, st, hovered === p.seat));
        if (st === 'selected'){
          if (g.shell){ g.shell.setMatrixAt(shellN++, tmpM.copy(p.m).multiply(hiK)); }
          pools.setMatrixAt(sc++, p.m);
        } else if (st === 'sold' && p.kind !== 'wheelchair'){
          const o = p.model.person, h = (p.seat.ri*31 + p.seat.num*17) % PERSON_COLS.length;
          tmpM.copy(p.m).multiply(new THREE.Matrix4().makeTranslation(o[0], o[1], o[2]));
          // undo the seat-width x-scale for the person
          const sx = new V3().setFromMatrixColumn(p.m, 0).length(); if (sx !== 1) tmpM.multiply(new THREE.Matrix4().makeScale(1/sx, 1, 1));
          persons.setMatrixAt(pc, tmpM); persons.setColorAt(pc, PERSON_COLS[h]); persons.userData.list[pc] = p.seat; pc++;
        }
      });
      g.uph.instanceColor.needsUpdate = true;
      if (g.shell){ g.shell.count = shellN; g.shell.instanceMatrix.needsUpdate = true; }
    }
    persons.count = pc; persons.instanceMatrix.needsUpdate = true; persons.boundingSphere = null; if (persons.instanceColor) persons.instanceColor.needsUpdate = true;
    pools.count = sc; pools.instanceMatrix.needsUpdate = true;
  }
  refresh();

  /* ------------------------------------------------------------ post-processing */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type:THREE.HalfFloatType, samples:4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(PR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.26, 0.45, 0.92);
  composer.addPass(bloom);
  const outPass = new OutputPass(); composer.addPass(outPass);

  /* ------------------------------------------------------------ camera + controls */
  // overview: high at the back, pitched ~16° down so the whole house and the full screen are in frame
  const ovPos = new V3(0, Math.min(yCeil - 0.5, yTop + 3.7), zBack - 1.2);
  const ovTz = rows3[0].zf + (zBackSeats - rows3[0].zf)*0.22;
  const ovTarget = new V3(0, ovPos.y - Math.tan(16*Math.PI/180)*(ovPos.z - ovTz), ovTz);
  camera.position.copy(ovPos); camera.lookAt(ovTarget);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(ovTarget);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8;
  const d0 = ovPos.distanceTo(ovTarget);
  controls.minDistance = d0*0.38; controls.maxDistance = d0;
  controls.minAzimuthAngle = -0.7; controls.maxAzimuthAngle = 0.7;
  const pol0 = Math.acos(clamp((ovPos.y - ovTarget.y)/d0, -1, 1));
  controls.minPolarAngle = Math.max(0.35, pol0 - 0.5); controls.maxPolarAngle = Math.min(1.5, pol0 + 0.22);
  controls.update();
  function clampCam(){
    const p = camera.position;
    p.x = clamp(p.x, -halfRoom + 0.6, halfRoom - 0.6);
    p.z = clamp(p.z, 1.0, zBack - 0.35);
    p.y = clamp(p.y, floorAt(p.z) + 1.25, yCeil - 0.35);
  }

  let mode = 'overview', flying = false, active = true, raf = 0, disposed = false;
  let seatLook = { yaw:0, pitch:0, tyaw:0, tpitch:0, base:new V3(), eye:new V3() };
  // 360° look-around: heading/elevation (radians) around the eye point, free yaw, slow auto-spin until the user takes over
  const look360 = { h:0, e:0, th:0, te:0, h0:0 };
  let fov360 = 72, baseFov = 46, spin360 = true, lastHeading = 1e9;
  const onHeading = opts.onHeading || (() => {});
  const curLook = ovTarget.clone();
  let savedOv = { pos: ovPos.clone(), target: ovTarget.clone() };

  const tweens = new Set();
  function tween(ms, fn){ if (REDUCED) ms = Math.min(ms, 200); return new Promise(res => tweens.add({ t0: performance.now(), ms, fn, res })); }
  function runTweens(now){ for (const tw of tweens){ const k = clamp((now - tw.t0)/tw.ms, 0, 1); tw.fn(easeIO(k)); if (k >= 1){ tweens.delete(tw); tw.res(); } } }

  function seatEye(seat, out = new V3()){
    const p = S3.get(seat.id);
    return out.set(0, p.eye, 0.14).applyQuaternion(p.q).add(p.pos);
  }
  const screenCentre = new V3(0, scrCY, 0);
  async function fly(toPos, toLook, ms, toFov = baseFov){
    flying = true; controls.enabled = false;
    const p0 = camera.position.clone(), l0 = curLook.clone(), mid = p0.clone().lerp(toPos, .5), f0 = camera.fov;
    mid.y += Math.min(2.5, p0.distanceTo(toPos)*0.12);
    const a = new V3(), b = new V3();
    await tween(ms, k => {
      a.lerpVectors(p0, mid, k); b.lerpVectors(mid, toPos, k); camera.position.lerpVectors(a, b, k);
      curLook.lerpVectors(l0, toLook, k); camera.lookAt(curLook);
      if (f0 !== toFov){ camera.fov = lerp(f0, toFov, k); camera.updateProjectionMatrix(); }
    });
    flying = false;
  }
  async function viewFromSeat(seat){
    if (!S3.has(seat.id) || disposed) return;
    if (mode === 'overview'){ savedOv = { pos: camera.position.clone(), target: controls.target.clone() }; curLook.copy(controls.target); }
    mode = 'seat'; setHover(null, 0, 0); onViewChange('seat', seat);
    const eye = seatEye(seat);
    seatLook = { yaw:0, pitch:0, tyaw:0, tpitch:0, eye, base: screenCentre.clone().sub(eye).normalize() };
    await fly(eye, screenCentre, 1100);
  }
  async function overview(){
    if (disposed) return;
    if (mode === 'overview' && !flying) return;
    mode = 'overview'; onViewChange('overview', null);
    await fly(savedOv.pos, savedOv.target, 1000, baseFov);
    controls.target.copy(savedOv.target); controls.enabled = true; controls.update();
  }

  // the seat nearest the sweet spot (centre, ~60% back) — where 360° starts when nothing is selected
  function centreSeat(){
    const rows = opts.layout.rows, target = rows.length*.6;
    const cost = s => Math.abs(s.x) + Math.abs(s.ri - target)*.8 + (safeState(s) === 'available' ? 0 : 50);   // prefer a free seat
    return opts.layout.seats.reduce((a, b) => cost(b) < cost(a) ? b : a);
  }
  async function view360(seat){
    if (disposed) return;
    seat = seat && S3.has(seat.id) ? seat : centreSeat();
    if (mode === 'overview'){ savedOv = { pos: camera.position.clone(), target: controls.target.clone() }; curLook.copy(controls.target); }
    mode = '360'; setHover(null, 0, 0); onViewChange('360', seat);
    const eye = seatEye(seat).add(new V3(0, 0.1, 0)), d = screenCentre.clone().sub(eye);
    seatLook.eye = eye;
    look360.h = look360.th = look360.h0 = Math.atan2(d.x, d.z);
    look360.e = look360.te = Math.atan2(d.y, Math.hypot(d.x, d.z));
    spin360 = !REDUCED; lastHeading = 1e9;
    await fly(eye, screenCentre, 1100, fov360);
  }
  function nudge360(dh, de){ if (mode !== '360') return; spin360 = false; look360.th += dh; look360.te = clamp(look360.te + de, -1.2, 1.2); }
  function setSpin360(on){ spin360 = !!on && !REDUCED; return spin360; }
  function zoom360(dFov){ fov360 = clamp(fov360 + dFov, 30, 95); }

  function viewScore(seat){
    const p = S3.get(seat.id); if (!p) return { score:0, label:'Good view' };
    const e = seatEye(seat), dz = Math.max(0.1, e.z), dist = Math.hypot(e.x, dz), ratio = dist/scrW;
    const angle = Math.atan2(Math.abs(e.x), dz)*180/Math.PI, vert = Math.atan2(scrCY - e.y, dz)*180/Math.PI;
    const dS = ratio < .55 ? .3 + ratio/.55*.4 : ratio < .85 ? .7 + (ratio - .55)/.3*.3 : ratio <= 1.45 ? 1 : Math.max(.55, 1 - (ratio - 1.45)*.6);
    const aS = angle < 12 ? 1 : Math.max(.3, 1 - (angle - 12)/40);
    const vS = vert > 12 ? Math.max(.5, 1 - (vert - 12)/30) : 1;
    const score = Math.round(100*dS*aS*vS);
    const label = (ratio < .55 || vert > 22) ? 'Too close' : angle > 30 ? 'Side view' : score >= 88 ? 'Perfect view' : score >= 72 ? 'Great view' : 'Good view';
    return { score, label };
  }

  /* ------------------------------------------------------------ input */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pd = null, lastMove = null;
  function pickAt(cx, cy){
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left)/r.width)*2 - 1, -((cy - r.top)/r.height)*2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pick, false).find(h => h.instanceId != null && h.object.userData.list && h.object.userData.list[h.instanceId]);
    return hit ? hit.object.userData.list[hit.instanceId] : null;
  }
  function setHover(seat, x, y){
    const prev = hovered;
    hovered = seat && safeState(seat) === 'available' ? seat : null;
    if (prev !== hovered){ if (prev) paint(prev); if (hovered) paint(hovered); }
    canvas.style.cursor = pd && pd.moved > 6 ? 'grabbing' : hovered ? 'pointer' : (mode !== 'seat' ? 'grab' : 'default');
    onHover(seat, x, y);
  }
  const onDown = e => { pd = { x:e.clientX, y:e.clientY, lx:e.clientX, ly:e.clientY, moved:0, id:e.pointerId, type:e.pointerType }; };
  const onMove = e => {
    if (pd && e.pointerId === pd.id){
      const dx = e.clientX - pd.lx, dy = e.clientY - pd.ly; pd.moved += Math.abs(dx) + Math.abs(dy); pd.lx = e.clientX; pd.ly = e.clientY;
      if (mode === '360' && !flying && pinch.size < 2){ spin360 = false; look360.th += dx*0.0032*(camera.fov/72); look360.te = clamp(look360.te + dy*0.0028*(camera.fov/72), -1.2, 1.2); }
      if (mode === 'seat' && !flying){ seatLook.tyaw = clamp(seatLook.tyaw - dx*0.0035, -0.75, 0.75); seatLook.tpitch = clamp(seatLook.tpitch + dy*0.0028, -0.35, 0.3); }
      if (pd.moved > 6 && hovered) setHover(null, e.clientX, e.clientY);
      return;
    }
    if (e.pointerType === 'mouse') lastMove = { x:e.clientX, y:e.clientY };
  };
  const onUp = e => {
    if (!pd || e.pointerId !== pd.id) return;
    const click = pd.moved < 6; pd = null;
    if (click && !flying){ const s = pickAt(e.clientX, e.clientY); if (s) onSeatClick(s); }
    if (e.pointerType === 'mouse') lastMove = { x:e.clientX, y:e.clientY };
  };
  const onCancel = () => { pd = null; };
  const onLeave = () => { lastMove = null; setHover(null, 0, 0); };
  // pinch / wheel zoom while in 360° (OrbitControls handles zoom in the overview)
  const pinch = new Map(); let pinchD0 = 0, pinchF0 = 72;
  const pinchDist = () => { const [a, b] = [...pinch.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const onPDown = e => { pinch.set(e.pointerId, {x:e.clientX, y:e.clientY}); if (pinch.size === 2){ pinchD0 = pinchDist(); pinchF0 = fov360; } };
  const onPMove = e => { if (!pinch.has(e.pointerId)) return; pinch.set(e.pointerId, {x:e.clientX, y:e.clientY}); if (pinch.size === 2 && mode === '360'){ spin360 = false; fov360 = clamp(pinchF0*pinchD0/pinchDist(), 30, 95); } };
  const onPUp = e => pinch.delete(e.pointerId);
  const onWheel = e => { if (mode !== '360') return; e.preventDefault(); spin360 = false; zoom360(e.deltaY*0.04); };
  canvas.addEventListener('pointerdown', onPDown); window.addEventListener('pointermove', onPMove); window.addEventListener('pointerup', onPUp); window.addEventListener('pointercancel', onPUp);
  canvas.addEventListener('wheel', onWheel, { passive:false });
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.style.touchAction = 'none';

  /* ------------------------------------------------------------ sizing + loop */
  function resize(){
    const el = canvas.parentElement || canvas, w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w/h;
    baseFov = w/h < 0.8 ? 64 : w/h < 1.2 ? 56 : 46;                  // portrait phones need a wider lens to fit the house
    if (w/h < 0.8) fov360 = Math.max(fov360, 82);
    camera.fov = mode === '360' ? fov360 : baseFov;
    camera.updateProjectionMatrix();
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
  resize();

  const clock = new THREE.Clock();
  let time = 0;
  const lookTmp = new V3(), qy = new THREE.Quaternion(), qx = new THREE.Quaternion(), side = new V3();
  function frame(now){
    raf = 0;
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05); time += dt;
    runTweens(now);
    // screen: slow Ken Burns drift + faint projector flicker; spill light follows
    const zoom = 1.06 + 0.035*Math.sin(time*0.05);
    screenTex.repeat.set(crop.x/zoom, crop.y/zoom);
    screenTex.offset.set((1 - screenTex.repeat.x)*(0.5 + 0.42*Math.sin(time*0.031)), (1 - screenTex.repeat.y)*(0.5 + 0.42*Math.cos(time*0.023)));
    const flick = REDUCED ? 1 : 0.965 + 0.02*Math.sin(time*23.0)*Math.sin(time*7.3) + 0.015*Math.sin(time*0.7);
    screenMat.color.setScalar(0.92*flick);
    rect.intensity = (isImax ? 3.2 : 3.6)*flick;
    beamMat.uniforms.uTime.value = time;
    // dust drifts gently in the beam
    const dp = dust.pts.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++){ dp.setY(i, dust.base[i*3 + 1] + Math.sin(time*0.25 + i)*0.05); dp.setX(i, dust.base[i*3] + Math.cos(time*0.18 + i*1.7)*0.04); }
    dp.needsUpdate = true;
    // selected seats breathe
    mat.shell.emissiveIntensity = 0.5 + (REDUCED ? 0 : Math.sin(time*2.4)*0.08);

    if (!flying){
      if (mode === 'overview'){ controls.update(); clampCam(); curLook.copy(controls.target); }
      else if (mode === '360'){
        if (spin360 && !pd) look360.th += dt*0.16;
        const k = 1 - Math.exp(-9*dt);
        look360.h = lerp(look360.h, look360.th, k); look360.e = lerp(look360.e, look360.te, k);
        const ce = Math.cos(look360.e);
        lookTmp.set(Math.sin(look360.h)*ce, Math.sin(look360.e), Math.cos(look360.h)*ce).multiplyScalar(10).add(seatLook.eye);
        camera.position.copy(seatLook.eye); camera.lookAt(lookTmp); curLook.copy(lookTmp);
        if (Math.abs(camera.fov - fov360) > .05){ camera.fov = lerp(camera.fov, fov360, k); camera.updateProjectionMatrix(); }
        const rel = look360.h - look360.h0;
        if (Math.abs(rel - lastHeading) > .004){ lastHeading = rel; onHeading(rel); }
      }
      else {
        seatLook.yaw = lerp(seatLook.yaw, seatLook.tyaw, 1 - Math.exp(-8*dt)); seatLook.pitch = lerp(seatLook.pitch, seatLook.tpitch, 1 - Math.exp(-8*dt));
        side.crossVectors(seatLook.base, new V3(0, 1, 0)).normalize();
        qy.setFromAxisAngle(new V3(0, 1, 0), seatLook.yaw); qx.setFromAxisAngle(side, -seatLook.pitch);
        lookTmp.copy(seatLook.base).applyQuaternion(qx).applyQuaternion(qy).multiplyScalar(10).add(seatLook.eye);
        camera.position.copy(seatLook.eye); camera.lookAt(lookTmp);
      }
    }
    if (lastMove && !pd && !flying){ const s = pickAt(lastMove.x, lastMove.y); setHover(s, lastMove.x, lastMove.y); lastMove = null; }
    composer.render();
    schedule();
  }
  function schedule(){ if (!raf && active && !disposed && !document.hidden) raf = requestAnimationFrame(frame); }
  const onVis = () => { if (!document.hidden){ clock.getDelta(); schedule(); } };
  document.addEventListener('visibilitychange', onVis);
  schedule();

  function setActive(on){ active = !!on; if (active){ clock.getDelta(); schedule(); } else if (raf){ cancelAnimationFrame(raf); raf = 0; } }

  function dispose(){
    if (disposed) return; disposed = true;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    tweens.clear();
    ro && ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerdown', onPDown); canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('pointermove', onPMove); window.removeEventListener('pointerup', onPUp); window.removeEventListener('pointercancel', onPUp);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
    controls.dispose();
    scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !owned.has(o.geometry)) o.geometry.dispose(); });
    for (const x of owned) x.dispose && x.dispose();
    bloom.dispose(); outPass.dispose && outPass.dispose(); rt.dispose(); composer.dispose && composer.dispose();
    renderer.dispose();
    canvas.style.cursor = '';
  }

  return { refresh, viewFromSeat, overview, view360, nudge360, setSpin360, zoom360, viewScore, resize, setActive, dispose };
}
