// Seat selection: 3D auditorium (theatre.js) + synchronised 2D map, quantity picker, block selection,
// best-available, single-gap rule and the price bar. Returns a cleanup function for the router.
import { LAYOUTS, movieById, cinemaById, showsFor, soldSeats, isPast, catName, inr, fmtTime, fmtDay } from '../data.js';
import { backdropCanvas } from '../posters.js';
import { S, $, esc, I, toast, anyModalOpen, bookedSeats, showOrNull } from '../core.js';
import { notFound } from './browse.js';

const CAT_COL = { classic:'var(--c-classic)', prime:'var(--c-prime)', recliner:'var(--c-recliner)', motion:'var(--c-motion)' };
const MAX_SEATS = 10;          // per booking

export function renderSeats(main, showId){
  const show = showOrNull(showId);
  if (!show) return notFound(main, 'This show could not be found.');
  const m = movieById(show.movieId), c = cinemaById(show.cinemaId), L = LAYOUTS[show.layoutId];
  if (isPast(show)){ notFound(main, 'Booking for this show has closed.'); return; }
  const sold = soldSeats(show, bookedSeats(show.id));
  const freeCount = L.seats.length - sold.size;
  let sel = [];
  if (S.pending?.showId === show.id) sel = S.pending.seats.map(id => L.seats.find(s => s.id === id)).filter(s => s && !sold.has(s.id));
  // food/offer/payment choices survive a trip back from checkout to change seats
  const carry = S.pending?.showId === show.id ? { food:S.pending.food, offer:S.pending.offer, pay:S.pending.pay, upi:S.pending.upi, upiApp:S.pending.upiApp, wallet:S.pending.wallet } : {};
  let mode = 'overview', theatre = null, view3d = true, hover = null, alive = true;

  document.body.classList.add('on-seats');
  const others = showsFor(m, c, show.date).filter(s => !isPast(s));
  main.innerHTML = `<div class="seats view">
    <div>
      <div class="sbar">
        <a class="x-btn" href="#/movie/${m.id}/tickets?date=${show.date}" aria-label="Back to showtimes">${I.back}</a>
        <div class="ttl"><h1>${esc(m.title)} <span class="tag cert" style="vertical-align:3px">${m.cert}</span></h1>
          <p>${esc(c.name)} · ${fmtDay(show.date)}, ${fmtTime(show.time)} · ${show.screenLabel} · ${show.format} · ${show.lang}</p></div>
      </div>
      ${others.length > 1 ? `<nav class="show-sw" aria-label="Other showtimes">${others.map(s => `<a href="#/seats/${encodeURIComponent(s.id)}" aria-current="${s.id === show.id}">${fmtTime(s.time)}<small style="font-weight:500;color:var(--ink-3);margin-left:6px;font-family:var(--f-ui)">${s.format}</small></a>`).join('')}</nav>` : ''}
    </div>
    <div class="stage" id="stage">
      <canvas id="th" aria-label="3D view of the auditorium. Use the seat map for keyboard selection."></canvas>
      <div class="loading3d" id="ld"><div><div class="spin"></div>Setting up the auditorium…</div></div>
      <div class="map" id="map" hidden></div>
      <div class="tools">
        <div class="seg" role="group" aria-label="View"><button id="v3d" aria-pressed="true">${I.cube}3D</button><button id="v2d" aria-pressed="false">${I.grid}Seat map</button></div>
        <button class="tool-btn gold" id="bestBtn">${I.spark}Best available</button>
        <button class="tool-btn" id="btn360" title="Look all around the auditorium" aria-label="360° view" aria-pressed="false">${I.orbit}<span>360° view</span></button>
        <button class="tool-btn" id="seatViewBtn" hidden>${I.eye}<span>View from seat</span></button>
        <button class="tool-btn" id="resetBtn" hidden>${I.reset}Overview</button>
      </div>
      <div id="vbadge"></div>
      <div class="cats">${L.cats.map(k => `<span class="cat"><i style="background:${CAT_COL[k]}"></i>${catName(k)}<b>${inr(show.prices[k])}</b></span>`).join('')}</div>
      <div class="legend-mini"><span><i style="border:1.5px solid var(--ink-2)"></i>Available</span><span><i style="background:var(--accent)"></i>Selected</span><span><i style="background:#3a393f"></i>Sold</span></div>
    </div>
    <div class="sfoot">
      <div class="sel-list" id="selList"></div>
      <div class="sum"><small id="sumSub"></small><b id="sumTot">${inr(0)}</b></div>
      <button class="btn btn-primary" id="goBtn" disabled>Select seats</button>
    </div>
  </div>`;
  const tip = document.createElement('div'); tip.className = 'seat-tip'; tip.hidden = true; document.body.append(tip);

  /* ---------------------------------------------------------- selection model */
  const stateOf = s => sold.has(s.id) ? 'sold' : sel.includes(s) ? 'selected' : 'available';
  const rowSeats = s => L.rows[s.ri].seats;                     // in x order
  const adjacent = (a, b) => a && b && Math.abs(a.x - b.x) <= (a.w + b.w)/2 + .05;
  const free = s => s && !sold.has(s.id) && !sel.includes(s);
  function clickSeat(s){
    if (!s) return;
    if (sold.has(s.id)){ toast(`${s.id} is already booked`, I.x); return; }
    const i = sel.indexOf(s);
    if (i >= 0){ sel.splice(i, 1); return update(); }
    if (sel.length >= MAX_SEATS){ toast(`You can book up to ${MAX_SEATS} seats at a time`, I.info); return; }
    sel.push(s); update();
  }
  // best block of the same size as the current selection (a pair if nothing is picked yet)
  function bestAvailable(){
    const qty = Math.max(1, sel.length || 2), rows = L.rows.length, ideal = rows*.64; let best = null;
    for (const row of L.rows){
      const seats = row.seats;
      for (let a = 0; a + qty <= seats.length; a++){
        const win = seats.slice(a, a + qty);
        if (!win.every((s, j) => !sold.has(s.id) && s.kind !== 'wheelchair' && (j === 0 || (adjacent(win[j - 1], s) && s.cat === win[0].cat)))) continue;
        const cx = win.reduce((t, s) => t + s.x, 0)/qty;
        const score = Math.abs(cx)*1.1 + Math.abs(row.ri - ideal)*.9 + (win[0].cat === 'recliner' ? .6 : 0);
        if (!best || score < best.score) best = { score, win };
      }
    }
    if (!best){ toast(`No ${qty} seats together — try fewer seats or pick them yourself`, I.info, 3200); return; }
    sel = best.win; update();
    toast(`Best seats: ${sel.map(s => s.id).join(', ')} · ${catName(sel[0].cat)}`, I.spark);
  }
  function gapProblem(){
    for (const s of sel){
      const row = rowSeats(s), k = row.indexOf(s);
      for (const d of [-1, 1]){
        const n = row[k + d]; if (!adjacent(s, n) || !free(n)) continue;
        const nn = row[k + 2*d], edge = !adjacent(n, nn);
        if (edge || !free(nn)) return n;
      }
    }
    return null;
  }

  /* ---------------------------------------------------------- UI sync */
  function update(){
    sel.sort((a, b) => a.ri - b.ri || a.x - b.x);
    theatre?.refresh(); drawMap();
    const total = sel.reduce((t, s) => t + show.prices[s.cat], 0);
    $('#selList', main).innerHTML = sel.length ? sel.map(s => `<button class="s" data-rm="${s.id}" aria-label="Remove seat ${s.id}">${s.id}${I.x}</button>`).join('')
      : `<span class="hint">Tap seats to select them · or use Best available</span>`;
    $('#sumSub', main).textContent = sel.length ? `${sel.length} × ${[...new Set(sel.map(s => catName(s.cat)))].join(' + ')}` : `${freeCount} seats left`;
    $('#sumTot', main).textContent = inr(total);
    const go = $('#goBtn', main); go.disabled = !sel.length;
    go.textContent = sel.length ? `Proceed · ${inr(total)}` : 'Select seats';
    $('#seatViewBtn', main).hidden = !view3d || !sel.length || mode === 'seat';
    if (mode !== 'overview') badge(lastViewed);
  }
  $('#selList', main).addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; sel = sel.filter(s => s.id !== b.dataset.rm); update(); });

  // tooltip
  function showTip(s, x, y){
    if (!s){ tip.hidden = true; return; }
    const st = stateOf(s);
    tip.innerHTML = `<b>${s.id}</b><span>${catName(s.cat)}${s.kind === 'wheelchair' ? ' · Wheelchair space' : s.kind === 'recliner' && s.cat !== 'recliner' ? ' · Recliner' : ''}</span> · ${st === 'sold' ? '<span style="color:var(--rose)">Sold</span>' : `<em>${inr(show.prices[s.cat])}</em>${st === 'selected' ? ' · selected' : ''}`}`;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.transform = `translate(${Math.min(innerWidth - w - 8, Math.max(8, x + 14))}px, ${Math.min(innerHeight - h - 8, Math.max(8, y - h - 12))}px)`;
  }

  /* ---------------------------------------------------------- 2D map */
  const mapEl = $('#map', main);
  function drawMap(){
    if (mapEl.hidden) return;
    const span = Math.max(...L.seats.map(s => Math.abs(s.x) + s.w/2))*2;
    const U = Math.max(20, Math.min(32, (mapEl.clientWidth - 110)/span)), W = span*U + 60, RH = 34;
    let y = 0, prevCat = null, html = '';
    for (const row of L.rows){
      if (row.cat !== prevCat){ if (prevCat) y += 14; html += `<div class="cat-band" style="top:${y}px"><b>${catName(row.cat)}</b> · ${inr(show.prices[row.cat])}</div>`; y += 30; prevCat = row.cat; }
      html += `<div class="mrow" style="top:${y}px"><span class="rl" style="left:0">${row.label}</span><span class="rl" style="right:0">${row.label}</span>${row.seats.map(s => {
        const st = stateOf(s), left = 30 + (s.x - s.w/2 + span/2)*U + 2, w = s.w*U - 4;
        return `<button class="mseat ${st === 'sold' ? 'sold' : st === 'selected' ? 'sel' : 'av'}${s.kind === 'wheelchair' ? ' wc' : ''}" data-seat="${s.id}" style="left:${left}px;width:${w}px;border-color:${CAT_COL[s.cat]};color:${CAT_COL[s.cat]}" ${st === 'sold' ? 'aria-disabled="true"' : ''} aria-pressed="${st === 'selected'}" aria-label="Row ${row.label} seat ${s.num}, ${catName(s.cat)}${s.kind === 'wheelchair' ? ', wheelchair space' : ''}, ${st === 'sold' ? 'sold' : inr(show.prices[s.cat])}">${s.num}</button>`;
      }).join('')}</div>`;
      y += RH;
    }
    const keep = mapEl.scrollTop;
    mapEl.innerHTML = `<div class="map-in" style="width:${W}px;height:${y + 90}px"><div class="screen-arc" style="width:${W*.8}px"><span>SCREEN THIS WAY</span></div><div style="position:relative;height:${y}px">${html}</div></div>`;
    mapEl.scrollTop = keep;
  }
  mapEl.addEventListener('click', e => { const b = e.target.closest('[data-seat]'); if (!b) return; const s = L.seats.find(x => x.id === b.dataset.seat); clickSeat(s); requestAnimationFrame(() => mapEl.querySelector(`[data-seat="${s.id}"]`)?.focus()); });
  mapEl.addEventListener('pointerover', e => { const b = e.target.closest('[data-seat]'); if (b && e.pointerType === 'mouse'){ const r = b.getBoundingClientRect(); showTip(L.seats.find(x => x.id === b.dataset.seat), r.left + r.width/2, r.top); } });
  mapEl.addEventListener('pointerout', e => { if (e.target.closest('[data-seat]')) tip.hidden = true; });
  mapEl.addEventListener('keydown', e => {
    const b = e.target.closest('[data-seat]'); if (!b || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault(); const s = L.seats.find(x => x.id === b.dataset.seat);
    let t = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ const row = rowSeats(s), k = row.indexOf(s); t = row[k + (e.key === 'ArrowLeft' ? -1 : 1)]; }
    else { const r2 = L.rows[s.ri + (e.key === 'ArrowUp' ? -1 : 1)]; if (r2) t = r2.seats.reduce((a, b2) => Math.abs(b2.x - s.x) < Math.abs(a.x - s.x) ? b2 : a); }
    if (t) mapEl.querySelector(`[data-seat="${t.id}"]`)?.focus();
  });

  /* ---------------------------------------------------------- 3D */
  // tooltips follow the mouse; on touch they flash briefly where the seat was tapped
  let lastViewed = null, ptr = 'mouse', tapAt = {x:0, y:0}, tipT = 0;
  const stageEl = $('#stage', main);
  stageEl.addEventListener('pointerdown', e => { ptr = e.pointerType; }, true);
  stageEl.addEventListener('pointermove', e => { ptr = e.pointerType; }, true);
  stageEl.addEventListener('pointerup', e => { tapAt = {x:e.clientX, y:e.clientY}; }, true);
  function badge(s){
    const vb = $('#vbadge', main);
    if (mode === '360' && theatre){ badge360(s); return; }
    if (!s || mode !== 'seat' || !theatre){ vb.innerHTML = ''; return; }
    const v = theatre.viewScore(s);
    vb.innerHTML = `<div class="view-badge">${I.eye.replace('<svg', '<svg style="width:20px;height:20px;color:var(--accent)"')}<div><b>View from ${s.id}</b><small>${v.label} · ${catName(s.cat)} · ${inr(show.prices[s.cat])}</small></div><div class="meter" aria-label="View score ${v.score} of 100"><i style="width:${v.score}%"></i></div>
      ${stateOf(s) === 'available' ? `<button class="btn btn-primary btn-sm" data-take="${s.id}">Select</button>` : ''}</div>`;
  }
  // 360°: where you're standing, a compass pointing back at the screen, auto-rotate toggle
  let spinning = true;
  function badge360(s){
    const st = s && stateOf(s), here = sel.includes(s) ? `your seat ${s.id}` : s ? `seat ${s.id}` : 'the best seat';
    $('#vbadge', main).innerHTML = `<div class="view-badge v360" role="status">
      <div class="compass" aria-hidden="true"><i id="needle"></i><span>SCREEN</span></div>
      <div><b>360° from ${here}</b><small>${ptr === 'mouse' ? 'Drag or use arrow keys to look around · scroll to zoom' : 'Drag to look around · pinch to zoom'}</small></div>
      <button class="tool-btn" data-spin aria-pressed="${spinning}" title="Auto-rotate">${I.reset}<span>${spinning ? 'Pause' : 'Rotate'}</span></button>
      ${st === 'available' ? `<button class="btn btn-primary btn-sm" data-take="${s.id}">Select ${s.id}</button>` : ''}</div>`;
  }
  $('#vbadge', main).addEventListener('click', e => {
    const b = e.target.closest('[data-take]'); if (b) clickSeat(L.seats.find(x => x.id === b.dataset.take));
    if (e.target.closest('[data-spin]')){ spinning = theatre.setSpin360(!spinning); badge(lastViewed); }
  });
  // stop showing "Pause" once the user grabs the view
  $('#stage', main).addEventListener('pointerdown', e => { if (mode === '360' && spinning && e.target.id === 'th'){ spinning = false; badge(lastViewed); } });
  async function viewSeat(s){ if (!theatre || !s) return; lastViewed = s; tip.hidden = true; await theatre.viewFromSeat(s); }
  function setView3d(on){
    view3d = on; $('#v3d', main).setAttribute('aria-pressed', String(on)); $('#v2d', main).setAttribute('aria-pressed', String(!on));
    mapEl.hidden = on; theatre?.setActive(on); tip.hidden = true;
    if (!on){ drawMap(); requestAnimationFrame(() => (mapEl.querySelector('.mseat.sel') || mapEl.querySelector('.mseat.av'))?.scrollIntoView({block:'center', inline:'center'})); }
    $('#resetBtn', main).hidden = !on || mode === 'overview';
    $('#btn360', main).hidden = !on;
    update();
  }
  $('#v3d', main).onclick = () => { if (!theatre){ toast('3D view isn\'t available on this device', I.info); return; } setView3d(true); };
  $('#v2d', main).onclick = () => setView3d(false);
  $('#bestBtn', main).onclick = bestAvailable;
  $('#seatViewBtn', main).onclick = () => viewSeat(sel[Math.floor((sel.length - 1)/2)]);
  $('#resetBtn', main).onclick = () => theatre?.overview();
  $('#btn360', main).onclick = () => { if (!theatre) return; tip.hidden = true; spinning = true; const s = sel.length ? sel[Math.floor((sel.length - 1)/2)] : null; lastViewed = s; theatre.view360(s); };

  (async () => {
    try {
      const mod = await import('../theatre.js');
      if (!alive) return;
      theatre = mod.createTheatre($('#th', main), {
        layout: L, screenImage: backdropCanvas(m, 1024, 576), palette: m.palette, format: show.format, stateOf,
        onHover(s, x, y){ hover = s; document.body.dataset.hover = s && stateOf(s) !== 'sold' ? '1' : '0'; if (ptr === 'mouse' && !anyModalOpen()) showTip(s, x, y); },
        onSeatClick: s => { clickSeat(s); if (ptr !== 'mouse'){ showTip(s, tapAt.x, tapAt.y); clearTimeout(tipT); tipT = setTimeout(() => tip.hidden = true, 1600); } },
        onViewChange(md, s){ mode = md; lastViewed = s || null; $('#resetBtn', main).hidden = md === 'overview'; $('#btn360', main).setAttribute('aria-pressed', String(md === '360')); badge(s); update(); },
        onHeading(rel){ const n = document.getElementById('needle'); if (n) n.style.transform = `rotate(${rel*180/Math.PI}deg)`; },
      });
      $('#ld', main).classList.add('done');
      theatre.refresh();
    } catch (err){
      console.warn('3D theatre unavailable, using the seat map', err);
      $('#ld', main).remove(); $('#th', main).remove(); $('#v3d', main).disabled = true;
      setView3d(false);
    }
  })();

  /* ---------------------------------------------------------- proceed */
  $('#goBtn', main).onclick = () => {
    const gap = gapProblem();
    if (gap){ toast(`Please don't leave seat ${gap.id} empty on its own — pick it or move your selection`, I.info, 3800); if (!view3d) mapEl.querySelector(`[data-seat="${gap.id}"]`)?.focus(); return; }
    S.pending = { ...carry, showId: show.id, seats: sel.map(s => s.id) };
    location.hash = '#/checkout';
  };
  const onKey = e => {
    if (anyModalOpen() || e.target.matches('input, textarea')) return;
    if (e.key === 'Escape' && mode !== 'overview' && theatre){ e.preventDefault(); theatre.overview(); }
    if (mode === '360' && theatre && e.key.startsWith('Arrow')){
      e.preventDefault(); spinning = false;
      theatre.nudge360({ArrowLeft:.22, ArrowRight:-.22}[e.key] || 0, {ArrowUp:.14, ArrowDown:-.14}[e.key] || 0);
    }
    if (mode === '360' && theatre && (e.key === '+' || e.key === '=' || e.key === '-')){ e.preventDefault(); theatre.zoom360(e.key === '-' ? 6 : -6); }
    if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey) setView3d(!view3d && !!theatre);
  };
  addEventListener('keydown', onKey);
  const onVis = () => theatre?.setActive(!document.hidden && view3d);
  document.addEventListener('visibilitychange', onVis);

  update();
  S.pending = null;

  return () => {
    alive = false; theatre?.dispose(); theatre = null; tip.remove();
    removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
    document.body.classList.remove('on-seats'); delete document.body.dataset.hover;
  };
}
