// Checkout (hold timer, food, offers, contact, payment), e-ticket (QR, calendar, cancel) and My tickets.
import { LAYOUTS, movieById, cinemaById, showById, FOOD, OFFERS, CONVENIENCE, HOLD_SECONDS, catName, inr, fmtTime, fmtDay, fmtDur, todayISO, soldSeats, iso } from '../data.js';
import { posterURL, backdropURL } from '../posters.js';
import { S, $, $$, esc, I, toast, openModal, saveBookings, saveContact, bookedSeats, setNav, qs, REDUCED } from '../core.js';
import { notFound } from './browse.js';

/* ------------------------------------------------------------- food art */
const FOOD_ART = {
  popcorn: (tint = '#f4e3b5') => `<svg viewBox="0 0 48 48"><g>${[[14,13],[20,9],[27,10],[33,13],[17,17],[24,15],[31,17]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${tint}"/>`).join('')}</g><path d="M11 18h26l-3 24H14z" fill="#f6f1e7"/><path d="M15 18l2 24M22 18l.5 24M29 18l-.5 24M35 18l-2.5 24" stroke="#d6283d" stroke-width="3"/></svg>`,
  cup: (tint = '#2a1a12') => `<svg viewBox="0 0 48 48"><path d="M27 4l-3 10" stroke="#ffcb5c" stroke-width="2.5" stroke-linecap="round"/><path d="M13 14h22l-2.5 28h-17z" fill="#d6283d"/><rect x="12" y="11" width="24" height="5" rx="2" fill="#f6f1e7"/><path d="M16 24h16" stroke="${tint}" stroke-width="7" opacity=".35"/><circle cx="24" cy="30" r="4" fill="#f6f1e7" opacity=".9"/></svg>`,
  nachos: () => `<svg viewBox="0 0 48 48"><path d="M8 34h32l-3 8H11z" fill="#3b2f2a"/>${[[10,32,18,14,24,30],[18,30,26,10,33,31],[26,32,34,16,40,33]].map(([a,b,c,d,e,f]) => `<path d="M${a} ${b}L${c} ${d}L${e} ${f}z" fill="#f2b33d" stroke="#d7922b"/>`).join('')}<ellipse cx="24" cy="31" rx="9" ry="3" fill="#ffd34d"/></svg>`,
  combo: () => `<svg viewBox="0 0 48 48"><g transform="translate(-6 4) scale(.8)">${[[14,13],[20,9],[27,10],[33,13],[24,15]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#f4e3b5"/>`).join('')}<path d="M11 18h26l-3 24H14z" fill="#f6f1e7"/><path d="M15 18l2 24M22 18l.5 24M29 18l-.5 24M35 18l-2.5 24" stroke="#d6283d" stroke-width="3"/></g><g transform="translate(20 8) scale(.68)"><path d="M27 4l-3 10" stroke="#ffcb5c" stroke-width="3" stroke-linecap="round"/><path d="M13 14h22l-2.5 28h-17z" fill="#2f6f86"/><rect x="12" y="11" width="24" height="5" rx="2" fill="#f6f1e7"/></g></svg>`,
  puff: () => `<svg viewBox="0 0 48 48"><path d="M8 32c2-12 10-18 16-18s14 6 16 18z" fill="#e2a24c"/><path d="M12 31c3-8 8-12 12-12" stroke="#f7d18c" stroke-width="2" fill="none"/><path d="M8 32h32" stroke="#b97a2c" stroke-width="2"/><path d="M10 38c4-2 24-2 28 0" stroke="#3b2f2a" stroke-width="3" stroke-linecap="round"/></svg>`,
};
const foodArt = f => FOOD_ART[f.icon](f.tint);

/* ------------------------------------------------------------- pricing */
function amounts(show, seats, food, offerCode){
  const tickets = seats.reduce((t, s) => t + show.prices[s.cat], 0), n = seats.length;
  const fee = CONVENIENCE*n, gst = Math.round(fee*.18);
  const foodTotal = Object.entries(food).reduce((t, [id, q]) => t + (FOOD.find(f => f.id === id)?.price || 0)*q, 0);
  const ctx = { tickets, count:n, date:show.date, hasCombo: Object.entries(food).some(([id, q]) => q > 0 && id.startsWith('combo')) };
  const offer = OFFERS.find(o => o.code === offerCode && o.test(ctx));
  const discount = offer ? offer.value(ctx) : 0;
  return { tickets, fee, gst, food:foodTotal, discount, offer, ctx, total: Math.max(0, tickets + fee + gst + foodTotal - discount) };
}

/* ================================================================== CHECKOUT */
export function renderCheckout(main){
  setNav('');
  const P = S.pending, show = P && showById(P.showId);
  if (!show || !P.seats.length){ main.innerHTML = ''; toast('Pick your seats first', I.seat); location.replace('#/'); return; }
  const m = movieById(show.movieId), c = cinemaById(show.cinemaId), L = LAYOUTS[show.layoutId];
  const seats = P.seats.map(id => L.seats.find(s => s.id === id));
  // seats could have been taken in another tab
  const taken = soldSeats(show, bookedSeats(show.id));
  if (seats.some(s => taken.has(s.id))){ toast('Some of those seats were just booked — please pick again', I.info, 3500); location.replace(`#/seats/${encodeURIComponent(show.id)}`); return; }
  P.food ||= {}; P.holdUntil ||= Date.now() + HOLD_SECONDS*1000; P.pay ||= 'upi';
  const contact = {...S.contact};

  main.innerHTML = `<div class="view"><div class="wrap">
    <div class="co-h"><button class="x-btn" id="coBack" aria-label="Back to seats">${I.back}</button><h1>Review & pay</h1>
      <span class="timer" id="timer" role="timer" aria-live="off">${I.clock}<span>--:--</span></span></div>
    <div class="co">
      <div>
        <section class="panel" aria-labelledby="fH"><h2 id="fH"><span class="n">1</span>Grab a bite</h2><p>Pre-order and skip the queue — collect at the counter with your booking ID.</p>
          <div class="food" id="food"></div></section>
        <section class="panel" aria-labelledby="oH"><h2 id="oH"><span class="n">2</span>Offers</h2><p>One offer per booking.</p>
          <div class="code-row"><input class="input" id="code" placeholder="Enter promo code" aria-label="Promo code" autocomplete="off" style="text-transform:uppercase"><button class="btn btn-ghost" id="codeBtn">Apply</button></div>
          <div class="offers" id="offers"></div></section>
        <section class="panel" aria-labelledby="cH"><h2 id="cH"><span class="n">3</span>Contact details</h2><p>Your tickets will be sent here.</p>
          <div class="form-grid">
            <div class="field"><label for="cn">Full name</label><input class="input" id="cn" autocomplete="name" value="${esc(contact.name)}"><p class="err" hidden></p></div>
            <div class="field"><label for="cp">Mobile number</label><input class="input" id="cp" inputmode="numeric" autocomplete="tel-national" placeholder="10-digit number" maxlength="10" value="${esc(contact.phone)}"><p class="err" hidden></p></div>
            <div class="field" style="grid-column:1/-1"><label for="ce">Email</label><input class="input" id="ce" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(contact.email)}"><p class="err" hidden></p></div>
          </div></section>
        <section class="panel" aria-labelledby="pH"><h2 id="pH"><span class="n">4</span>Payment</h2><p>This is a demo — no real payment is taken.</p>
          <div class="pay-tabs" role="group" aria-label="Payment method">
            <button class="pay-tab" data-pay="upi" aria-pressed="${P.pay === 'upi'}">${I.upi}UPI</button>
            <button class="pay-tab" data-pay="card" aria-pressed="${P.pay === 'card'}">${I.card}Card</button>
            <button class="pay-tab" data-pay="wallet" aria-pressed="${P.pay === 'wallet'}">${I.wallet}Wallet</button></div>
          <div id="payForm"></div>
          <button class="btn btn-primary" id="payBtn" style="width:100%;margin-top:18px;height:52px;font-size:16px"></button>
          <p style="margin:10px 0 0;text-align:center;color:var(--ink-3);font-size:12.5px">${c.cancellable ? 'Cancellation available up to 2 hours before the show.' : 'Tickets for this cinema are non-cancellable.'}</p></section>
      </div>
      <aside class="summary" aria-label="Order summary"><div class="sum-card" id="sum"></div></aside>
    </div></div></div>`;

  /* -------- food */
  const drawFood = () => $('#food', main).innerHTML = FOOD.map(f => { const q = P.food[f.id] || 0; return `<div class="fitem${q ? ' on' : ''}">
    <div class="art">${foodArt(f)}</div><div><h3><span class="veg" aria-label="Vegetarian"></span>${esc(f.name)}</h3><p>${esc(f.size)}${f.tag ? ` · <span style="color:var(--green)">${f.tag}</span>` : ''}</p>
    <div class="row"><span class="pr">${inr(f.price)}</span>${q ? `<span class="step"><button data-dec="${f.id}" aria-label="Remove one ${esc(f.name)}">−</button><span aria-live="polite">${q}</span><button data-inc="${f.id}" aria-label="Add one more ${esc(f.name)}">+</button></span>` : `<button class="add-btn" data-inc="${f.id}">Add</button>`}</div></div></div>`; }).join('');
  $('#food', main).addEventListener('click', e => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'); if (!inc && !dec) return;
    const id = (inc || dec).dataset.inc || (inc || dec).dataset.dec;
    P.food[id] = Math.max(0, Math.min(10, (P.food[id] || 0) + (inc ? 1 : -1))); if (!P.food[id]) delete P.food[id];
    drawFood(); refresh(); $(`#food [data-${inc ? 'inc' : 'dec'}="${id}"]`, main)?.focus() || $(`#food [data-inc="${id}"]`, main)?.focus();
  });

  /* -------- offers */
  const drawOffers = () => { const a = amounts(show, seats, P.food, P.offer);
    $('#offers', main).innerHTML = OFFERS.map(o => { const ok = o.test(a.ctx), on = P.offer === o.code && ok;
      return `<div class="offer${on ? ' applied' : ''}${ok ? '' : ' na'}"><span class="ic">${I.tag}</span><div><b>${o.title}<code>${o.code}</code></b><small>${o.detail}${ok ? '' : ' · not applicable'}</small></div>
      ${on ? `<button class="btn btn-sm btn-ghost" data-rmoffer>Remove</button>` : `<button class="btn btn-sm btn-ghost" data-offer="${o.code}" ${ok ? '' : 'disabled'}>Apply</button>`}</div>`; }).join(''); };
  const applyCode = code => {
    code = code.trim().toUpperCase(); const o = OFFERS.find(x => x.code === code), a = amounts(show, seats, P.food, null);
    if (!o){ toast('That code isn\'t valid', I.x); return; }
    if (!o.test(a.ctx)){ toast(`${code} doesn't apply to this booking`, I.info); return; }
    P.offer = code; toast(`${code} applied · you save ${inr(o.value(a.ctx))}`, I.check); refresh();
  };
  $('#offers', main).addEventListener('click', e => { const b = e.target.closest('[data-offer]'); if (b) applyCode(b.dataset.offer); if (e.target.closest('[data-rmoffer]')){ P.offer = null; refresh(); } });
  $('#codeBtn', main).onclick = () => applyCode($('#code', main).value);
  $('#code', main).addEventListener('keydown', e => { if (e.key === 'Enter') applyCode(e.target.value); });

  /* -------- summary */
  let detailsOpen = false;
  function refresh(){
    let a = amounts(show, seats, P.food, P.offer);
    if (P.offer && !a.offer){ toast(`${P.offer} no longer applies and was removed`, I.info); P.offer = null; a = amounts(show, seats, P.food, null); }
    drawOffers();
    const byCat = {}; seats.forEach(s => (byCat[s.cat] ||= []).push(s));
    $('#sum', main).innerHTML = `<div class="sum-top" style="--bd:url(${backdropURL(m, 640)})"><img src="${posterURL(m, 200)}" alt=""><div><h3>${esc(m.title)}</h3><p>${m.cert} · ${show.lang} · ${show.format}</p><p>${esc(c.name)}</p><p style="color:var(--ink)">${fmtDay(show.date, {weekday:'short', day:'numeric', month:'short'})} · ${fmtTime(show.time)}</p></div></div>
      <div class="sum-sec"><div class="k">${show.screenLabel} · ${seats.length} seat${seats.length > 1 ? 's' : ''}</div><div class="seat-chips">${seats.map(s => `<span>${s.id}</span>`).join('')}</div></div>
      <div class="sum-sec">
        ${Object.entries(byCat).map(([k, ss]) => `<div class="sum-line"><span>${catName(k)} × ${ss.length}</span><span>${inr(show.prices[k]*ss.length)}</span></div>`).join('')}
        <div class="sum-line"><span>Convenience fee <button class="details-btn" id="dBtn" aria-expanded="${detailsOpen}">details${I.chevD}</button></span><span>${inr(a.fee + a.gst)}</span></div>
        ${detailsOpen ? `<div class="sum-line sub"><span>Base fee · ${seats.length} × ${inr(CONVENIENCE)}</span><span>${inr(a.fee)}</span></div><div class="sum-line sub"><span>GST @ 18%</span><span>${inr(a.gst)}</span></div>` : ''}
        ${Object.entries(P.food).map(([id, q]) => { const f = FOOD.find(x => x.id === id); return `<div class="sum-line"><span>${esc(f.name)} × ${q}</span><span>${inr(f.price*q)}</span></div>`; }).join('')}
        ${a.discount ? `<div class="sum-line disc"><span>${a.offer.code}</span><span>−${inr(a.discount)}</span></div>` : ''}
      </div>
      <div class="sum-total"><span>Amount payable</span><b>${inr(a.total)}</b></div>`;
    $('#dBtn', main).onclick = () => { detailsOpen = !detailsOpen; refresh(); $('#dBtn', main).focus(); };
    $('#payBtn', main).innerHTML = `${I.check}Pay ${inr(a.total)}`;
    return a;
  }

  /* -------- payment forms */
  const WALLETS = ['Paytm','PhonePe','Amazon Pay','MobiKwik'];
  const drawPay = () => {
    $$('.pay-tab', main).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pay === P.pay)));
    const f = $('#payForm', main);
    if (P.pay === 'upi') f.innerHTML = `<div class="upi-apps">${['GPay','PhonePe','Paytm','BHIM'].map(a => `<button class="chip" data-upi="${a}" aria-pressed="${P.upiApp === a}">${a}</button>`).join('')}</div>
      <div class="field"><label for="upi">UPI ID</label><input class="input" id="upi" placeholder="name@bank" autocomplete="off" value="${esc(P.upi || '')}"><p class="err" hidden></p></div>`;
    else if (P.pay === 'card') f.innerHTML = `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label for="cc">Card number</label><input class="input mono" id="cc" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="19"><p class="err" hidden></p></div>
      <div class="field"><label for="ex">Expiry</label><input class="input mono" id="ex" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5"><p class="err" hidden></p></div>
      <div class="field"><label for="cv">CVV</label><input class="input mono" id="cv" inputmode="numeric" autocomplete="cc-csc" placeholder="•••" maxlength="4" type="password"><p class="err" hidden></p></div></div>`;
    else f.innerHTML = `<div class="chips" role="group" aria-label="Wallet">${WALLETS.map(w => `<button class="chip" data-wallet="${w}" aria-pressed="${P.wallet === w}">${w}</button>`).join('')}</div><p class="err" id="wErr" hidden style="margin-top:8px">Choose a wallet</p>`;
    $('#cc', f)?.addEventListener('input', e => { const d = e.target.value.replace(/\D/g, '').slice(0, 16); e.target.value = d.replace(/(.{4})/g, '$1 ').trim(); });
    $('#ex', f)?.addEventListener('input', e => { let d = e.target.value.replace(/\D/g, '').slice(0, 4); if (d.length > 2) d = d.slice(0, 2) + '/' + d.slice(2); e.target.value = d; });
    $('#upi', f)?.addEventListener('input', e => P.upi = e.target.value);
  };
  main.addEventListener('click', e => {
    const t = e.target.closest('[data-pay]'); if (t){ P.pay = t.dataset.pay; drawPay(); return; }
    const u = e.target.closest('[data-upi]'); if (u){ P.upiApp = u.dataset.upi; drawPay(); if (!$('#upi', main).value){ $('#upi', main).value = P.upi = `${(contact.name || 'you').toLowerCase().replace(/[^a-z]/g, '') || 'you'}@ok${u.dataset.upi.toLowerCase()}`; } return; }
    const w = e.target.closest('[data-wallet]'); if (w){ P.wallet = w.dataset.wallet; drawPay(); }
  });

  /* -------- validation + pay */
  const fieldErr = (inp, msg) => { const er = inp.parentElement.querySelector('.err'); inp.setAttribute('aria-invalid', String(!!msg)); if (er){ er.hidden = !msg; er.textContent = msg || ''; } return !msg; };
  ['cn','cp','ce'].forEach(id => $('#' + id, main).addEventListener('input', e => fieldErr(e.target, '')));
  function validate(){
    const n = $('#cn', main), p = $('#cp', main), em = $('#ce', main); let ok = true, first = null;
    const chk = (inp, msg) => { if (!fieldErr(inp, msg)){ ok = false; first ||= inp; } };
    chk(n, n.value.trim().length < 2 ? 'Enter your name' : '');
    chk(p, /^[6-9]\d{9}$/.test(p.value) ? '' : 'Enter a valid 10-digit mobile number');
    chk(em, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim()) ? '' : 'Enter a valid email');
    if (P.pay === 'upi'){ const u = $('#upi', main); chk(u, /^[\w.\-]{2,}@[a-z]{2,}$/i.test(u.value.trim()) ? '' : 'Enter a valid UPI ID, like name@bank'); }
    if (P.pay === 'card'){
      const cc = $('#cc', main), ex = $('#ex', main), cv = $('#cv', main);
      chk(cc, cc.value.replace(/\s/g, '').length === 16 ? '' : 'Enter the 16-digit card number');
      const [mm, yy] = ex.value.split('/').map(Number), now = new Date(), expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm, 0) >= new Date(now.getFullYear(), now.getMonth(), 1);
      chk(ex, expOk ? '' : 'Enter a valid future expiry');
      chk(cv, /^\d{3,4}$/.test(cv.value) ? '' : 'Enter the CVV');
    }
    if (P.pay === 'wallet' && !P.wallet){ ok = false; $('#wErr', main).hidden = false; first ||= $('[data-wallet]', main); }
    if (!ok){ first.focus(); first.scrollIntoView({block:'center', behavior: REDUCED ? 'auto' : 'smooth'}); }
    return ok;
  }
  $('#payBtn', main).onclick = async () => {
    if (!validate()) return;
    const a = refresh();
    saveContact({ name: $('#cn', main).value.trim(), phone: $('#cp', main).value, email: $('#ce', main).value.trim() });
    const ov = document.createElement('div'); ov.className = 'processing'; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-label', 'Processing payment');
    ov.innerHTML = `<div class="box"><div class="spin"></div><b>Processing ${inr(a.total)}</b><small>${P.pay === 'upi' ? 'Approve the request in your UPI app…' : P.pay === 'card' ? 'Securely contacting your bank…' : `Paying with ${P.wallet}…`}</small></div>`;
    document.body.append(ov); clearInterval(tick);
    await new Promise(r => setTimeout(r, REDUCED ? 400 : 1700));
    ov.innerHTML = `<div class="box"><div class="ok-ring">${I.check}</div><b>Payment successful</b><small>Booking your seats…</small></div>`;
    await new Promise(r => setTimeout(r, REDUCED ? 200 : 900));
    const id = 'RH' + Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
    S.bookings.unshift({ id, showId: show.id, movieId: m.id, cinemaId: c.id, date: show.date, time: show.time, seats: P.seats.slice(), food: {...P.food},
      amounts: { tickets:a.tickets, fee:a.fee, gst:a.gst, food:a.food, discount:a.discount, total:a.total }, offer: a.offer?.code || null,
      pay: P.pay === 'wallet' ? P.wallet : P.pay.toUpperCase(), contact: {...S.contact}, pickup: String(1000 + Math.floor(Math.random()*9000)),
      createdAt: Date.now(), status:'confirmed' });
    saveBookings(); S.pending = null; ov.remove();
    location.hash = `#/ticket/${id}?new=1`;
  };

  /* -------- hold timer */
  const tEl = $('#timer', main);
  const tick = setInterval(() => {
    const left = Math.max(0, Math.round((P.holdUntil - Date.now())/1000));
    $('span', tEl).textContent = `${String(Math.floor(left/60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    tEl.classList.toggle('low', left < 60); tEl.setAttribute('aria-label', `Seats held for ${Math.floor(left/60)} minutes ${left % 60} seconds`);
    if (left === 60) toast('1 minute left to complete your booking', I.clock);
    if (left <= 0){ clearInterval(tick); const md = openModal({ title:'Time\'s up', body:`<p style="margin:0 0 18px;color:var(--ink-2)">We released seats ${seats.map(s => s.id).join(', ')} so others can book them. You can pick seats again.</p><button class="btn btn-primary" data-close style="width:100%">Choose seats again</button>`, onClose: () => { S.pending = null; location.hash = `#/seats/${encodeURIComponent(show.id)}`; } }); }
  }, 250);
  $('#coBack', main).onclick = () => { delete P.holdUntil; S.pending = P; location.hash = `#/seats/${encodeURIComponent(show.id)}`; };

  drawFood(); drawPay(); refresh();
  return () => clearInterval(tick);
}

/* ================================================================== TICKET */
function qrSVG(text){
  try { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  catch { return `<svg viewBox="0 0 10 10"><text x="5" y="5.5" font-size="1.4" text-anchor="middle" fill="#17140f">QR unavailable</text></svg>`; }
}
function showStart(b){ const [h, mi] = b.time.split(':').map(Number), d = new Date(b.date + 'T00:00'); d.setHours(h, mi); return d; }
export function renderTicket(main, id){
  setNav('bookings');
  const b = S.bookings.find(x => x.id === id); if (!b) return notFound(main, 'We couldn\'t find that booking.');
  const show = showById(b.showId), m = movieById(b.movieId), c = cinemaById(b.cinemaId);
  const L = show ? LAYOUTS[show.layoutId] : null;
  const seats = b.seats.map(sid => L?.seats.find(s => s.id === sid)).filter(Boolean);
  const isNew = qs().get('new') === '1', cancelled = b.status === 'cancelled';
  const canCancel = !cancelled && c.cancellable && showStart(b) - Date.now() > 2*3600e3;
  const foodLines = Object.entries(b.food || {}).map(([fid, q]) => `${FOOD.find(f => f.id === fid)?.name} × ${q}`);
  main.innerHTML = `<div class="view"><div class="wrap"><div class="tk-wrap">
    <div class="tk-h">${isNew ? `<h1>You're all set!</h1><p>Booking confirmed — tickets sent to ${esc(b.contact.email)}</p>` : `<h1>Your ticket</h1><p>Show this at the entrance</p>`}</div>
    <article class="ticket" aria-label="E-ticket">
      <span class="tk-status ${cancelled ? 'cancelled' : ''}">${cancelled ? 'Cancelled' : 'Confirmed'}</span>
      <div class="tk-art" style="background-image:url(${backdropURL(m, 800)})"><div><h2>${esc(m.title)}</h2><p>${m.cert} · ${show?.lang || ''} · ${show?.format || ''} · ${fmtDur(m.mins)}</p></div></div>
      <div class="tk-body"><div class="tk-grid">
        <div class="big"><small>Date</small><b>${fmtDay(b.date, {day:'numeric', month:'short'})}</b></div>
        <div class="big"><small>Time</small><b>${fmtTime(b.time)}</b></div>
        <div class="full"><small>Cinema</small><b>${esc(c.name)}</b></div>
        <div><small>Screen</small><b>${show ? show.screenLabel : '—'}</b></div>
        <div><small>${seats.length > 1 ? 'Seats' : 'Seat'} · ${seats.length}</small><b>${b.seats.join(', ')}</b></div>
        <div><small>Class</small><b>${[...new Set(seats.map(s => catName(s.cat)))].join(', ')}</b></div>
        <div><small>Paid</small><b>${inr(b.amounts.total)} · ${esc(b.pay)}</b></div>
        ${foodLines.length ? `<div class="full"><small>Food pickup · code ${b.pickup}</small><b>${foodLines.map(esc).join(' · ')}</b></div>` : ''}
      </div></div>
      <div class="tk-perf"></div>
      <div class="tk-qr"><div class="qr" aria-label="QR code for booking ${b.id}">${qrSVG(`REELHOUSE|${b.id}|${b.showId}|${b.seats.join(',')}`)}</div>
        <div><small>Booking ID</small><div class="bid">${b.id}</div><p>${cancelled ? 'This booking was cancelled and refunded.' : 'Arrive 15 minutes early. Doors close 10 minutes after the show starts.'}</p></div></div>
    </article>
    <div class="tk-actions">
      ${!cancelled ? `<button class="btn btn-ghost" id="calBtn">${I.cal}Add to calendar</button><button class="btn btn-ghost" id="shareBtn">${I.ticket}Share</button>` : ''}
      ${canCancel ? `<button class="btn btn-ghost" id="cancelBtn" style="color:var(--rose)">${I.x}Cancel booking</button>` : ''}
      <a class="btn btn-primary" href="#/">Book another</a>
    </div>
  </div></div></div>`;
  $('#calBtn', main)?.addEventListener('click', () => {
    const st = showStart(b), en = new Date(st.getTime() + (m.mins + 20)*60e3);
    const f = d => `${iso(d).replace(/-/g, '')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Reelhouse//Tickets//EN','BEGIN:VEVENT',`UID:${b.id}@reelhouse`,`DTSTAMP:${f(new Date())}`,`DTSTART:${f(st)}`,`DTEND:${f(en)}`,
      `SUMMARY:${m.title} (${show?.format || ''})`,`LOCATION:${c.name}\\, ${c.address.replace(/,/g, '\\,')}`,`DESCRIPTION:Booking ${b.id} · Seats ${b.seats.join(' ')} · ${show?.screenLabel || ''}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], {type:'text/calendar'})); a.download = `${m.title.replace(/\W+/g, '-')}-${b.id}.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Calendar file downloaded', I.cal);
  });
  $('#shareBtn', main)?.addEventListener('click', async () => {
    const text = `${m.title} · ${fmtDay(b.date)} ${fmtTime(b.time)} · ${c.name} · Seats ${b.seats.join(', ')} · Booking ${b.id}`;
    try { if (navigator.share){ await navigator.share({ title:`${m.title} tickets`, text }); return; } await navigator.clipboard.writeText(text); toast('Ticket details copied', I.check); }
    catch { /* share sheet dismissed */ }
  });
  $('#cancelBtn', main)?.addEventListener('click', () => {
    const refund = b.amounts.tickets + b.amounts.food - b.amounts.discount;
    const md = openModal({ title:'Cancel this booking?', body:`<p style="margin:0 0 6px;color:var(--ink-2)">${b.seats.length} seat${b.seats.length > 1 ? 's' : ''} for ${esc(m.title)} on ${fmtDay(b.date)} at ${fmtTime(b.time)}.</p>
      <p style="margin:0 0 18px;color:var(--ink-2)">You'll get <b style="color:var(--ink)">${inr(Math.max(0, refund))}</b> back in 5–7 days. Convenience fees aren't refundable.</p>
      <div style="display:flex;gap:10px"><button class="btn btn-ghost" data-close style="flex:1">Keep it</button><button class="btn btn-primary" id="doCancel" style="flex:1;background:var(--rose);color:#2a0610">Cancel booking</button></div>` });
    $('#doCancel', md.el).onclick = () => { b.status = 'cancelled'; b.refund = Math.max(0, refund); saveBookings(); md.close(); toast('Booking cancelled · refund initiated', I.check); renderTicket(main, id); };
  });
  if (isNew && !REDUCED) confetti();
  if (isNew) history.replaceState(null, '', `#/ticket/${id}`);
}
function confetti(){
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const cols = ['#ffcb5c','#ff5d73','#46d48a','#8fd7ff','#f4f1ea','#c9a2ff'];
  for (let i = 0; i < 90; i++){ const p = document.createElement('i');
    p.style.cssText = `left:${Math.random()*100}%;background:${cols[i % cols.length]};--dx:${(Math.random() - .5)*240}px;--r:${Math.random()*900 - 450}deg;animation-duration:${1.8 + Math.random()*1.6}s;animation-delay:${Math.random()*.5}s;transform:rotate(${Math.random()*180}deg)`;
    box.append(p); }
  document.body.append(box); setTimeout(() => box.remove(), 4200);
}

/* ================================================================== MY TICKETS */
export function renderBookings(main){
  setNav('bookings');
  let tab = qs().get('tab') || 'upcoming';
  const now = Date.now();
  const upcoming = S.bookings.filter(b => b.status === 'confirmed' && showStart(b).getTime() + 3*3600e3 > now);
  const past = S.bookings.filter(b => !upcoming.includes(b));
  const draw = () => {
    const list = tab === 'upcoming' ? upcoming : past;
    main.innerHTML = `<div class="view"><div class="wrap">
      <div class="page-h"><h1>My tickets</h1><p>${S.bookings.length ? `${upcoming.length} upcoming · ${past.length} past or cancelled` : 'Your bookings will show up here'}</p></div>
      <div class="chips" style="margin:20px 0" role="tablist"><button class="chip" role="tab" data-tab="upcoming" aria-selected="${tab === 'upcoming'}" aria-pressed="${tab === 'upcoming'}">Upcoming (${upcoming.length})</button><button class="chip" role="tab" data-tab="past" aria-selected="${tab === 'past'}" aria-pressed="${tab === 'past'}">Past & cancelled (${past.length})</button></div>
      <div class="bk-list">${list.length ? list.map(b => { const m = movieById(b.movieId), c = cinemaById(b.cinemaId), st = b.status === 'cancelled' ? 'cancelled' : tab === 'past' ? 'past' : '';
        return `<a class="bk" href="#/ticket/${b.id}"><img src="${posterURL(m, 160)}" alt=""><div><h3>${esc(m.title)}</h3><p>${fmtDay(b.date)} · ${fmtTime(b.time)} · ${esc(c.name)}</p><p>Seats ${b.seats.join(', ')} · ${inr(b.amounts.total)}</p></div>
          <span class="st ${st}">${st === 'cancelled' ? 'Cancelled' : st === 'past' ? 'Watched' : 'Confirmed'}</span></a>`; }).join('')
        : `<div class="empty card"><b>${tab === 'upcoming' ? 'No upcoming shows' : 'Nothing here yet'}</b>${tab === 'upcoming' ? 'Find something to watch tonight.' : 'Past and cancelled bookings appear here.'}<br><br><a class="btn btn-primary" href="#/">Browse movies</a></div>`}</div>
    </div></div>`;
    $$('[data-tab]', main).forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); $(`[data-tab="${tab}"]`, main).focus(); });
  };
  draw();
}
