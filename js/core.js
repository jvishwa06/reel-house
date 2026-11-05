// Shared app state, storage, icons and UI primitives (toast, modal, city picker, search palette).
import { CITIES, cityById, MOVIES, cinemasFor, LAYOUTS, showById, todayISO } from './data.js';
import { posterURL } from './posters.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- storage (every access guarded) */
const store = {
  get(k, d){ try { const v = localStorage.getItem('rh-' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('rh-' + k, JSON.stringify(v)); } catch {} },
};
export const S = {
  city: store.get('city', null),
  bookings: store.get('bookings', []),
  interest: new Set(store.get('interest', [])),
  favs: new Set(store.get('favs', [])),
  contact: store.get('contact', {name:'', email:'', phone:''}),
  pending: null,           // { showId, seats:[ids], food, offer… } handed from the seat page to checkout
};
export function setCity(id){ S.city = id; store.set('city', id); $('#cityName').textContent = cityById(id).name; }
export function saveBookings(){ store.set('bookings', S.bookings); updateTicketBadge(); }
export function toggleInterest(id){ S.interest.has(id) ? S.interest.delete(id) : S.interest.add(id); store.set('interest', [...S.interest]); return S.interest.has(id); }
export function toggleFav(id){ S.favs.has(id) ? S.favs.delete(id) : S.favs.add(id); store.set('favs', [...S.favs]); return S.favs.has(id); }
export function saveContact(c){ S.contact = c; store.set('contact', c); }
export const bookedSeats = showId => S.bookings.filter(b => b.showId === showId && b.status === 'confirmed').flatMap(b => b.seats);
export function updateTicketBadge(){
  const n = S.bookings.filter(b => b.status === 'confirmed' && b.date >= todayISO()).length, el = $('#tkCount');
  if (el){ el.hidden = !n; el.textContent = n; }
}

/* ------------------------------------------------------------- icons */
const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const I = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
  chev: sv('<path d="M9 6l6 6-6 6"/>'), chevD: sv('<path d="M6 9l6 6 6-6"/>'), back: sv('<path d="M15 6l-6 6 6 6"/>'),
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>'), check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  pin: sv('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  clock: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  heart: sv('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>'),
  heartF: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/></svg>',
  bell: sv('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  ticket: sv('<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/>'),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  film: sv('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor"/>'),
  building: sv('<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>'),
  seat: sv('<path d="M6 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><rect x="4" y="11" width="16" height="5" rx="2"/><path d="M6 16v4M18 16v4"/>'),
  sofa: sv('<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 17v2M19 17v2"/>'),
  food: sv('<path d="M6 8h12l-1.5 12h-9z"/><path d="M8 8a2 2 0 0 1 2-3 2 2 0 0 1 4 0 2 2 0 0 1 2 3"/><path d="M10 12v5M14 12v5"/>'),
  car: sv('<path d="M5 16V12l2-5h10l2 5v4z"/><circle cx="8" cy="16.5" r="1.6"/><circle cx="16" cy="16.5" r="1.6"/>'),
  wheel: sv('<circle cx="10" cy="5" r="1.6"/><path d="M10 8v6h5l2 5"/><path d="M6.5 11.5A5 5 0 1 0 13 18"/>'),
  phone: sv('<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>'),
  sound: sv('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  eye: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  orbit: sv('<ellipse cx="12" cy="12" rx="9" ry="3.6"/><path d="M12 3a9 9 0 0 1 0 18" stroke-dasharray="2 2.4"/><path d="M18.5 6.8l2.3 1.8-2.6 1.1"/>'),
  cube: sv('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  grid: sv('<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>'),
  spark: sv('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
  reset: sv('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>'),
  edit: sv('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  tag: sv('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>'),
  card: sv('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>'),
  upi: sv('<path d="M7 4l-3 16M14 4l-3 16"/><path d="M15 8l5 4-5 4"/>'),
  wallet: sv('<path d="M4 7a2 2 0 0 1 2-2h11v4"/><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M15 13h2"/>'),
  cal: sv('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  info: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>',
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
};
export const AMEN_ICON = { recliner:I.sofa, food:I.food, parking:I.car, wheelchair:I.wheel, mticket:I.phone, atmos:I.sound };

/* ------------------------------------------------------------- toast */
export function toast(msg, icon = I.info, ms = 2600){
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `${icon}<span>${msg}</span>`;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}

/* ------------------------------------------------------------- modal (focus-trapped, Esc closes) */
let modalStack = [];
export function openModal({title, body, cls = '', onClose, labelledBy}){
  const prev = document.activeElement;
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const id = 'm' + Math.random().toString(36).slice(2, 7);
  scrim.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="${labelledBy || id}">
    ${title ? `<div class="modal-h"><h2 id="${id}">${title}</h2><button class="x-btn" data-close aria-label="Close">${I.x}</button></div>` : ''}
    <div class="modal-b"></div></div>`;
  const b = $('.modal-b', scrim); if (typeof body === 'string') b.innerHTML = body; else b.append(body);
  document.body.append(scrim);
  const close = () => {
    if (!scrim.isConnected) return;
    scrim.remove(); modalStack = modalStack.filter(m => m !== api); document.removeEventListener('keydown', onKey, true);
    onClose?.(); prev?.focus?.();
  };
  const onKey = e => {
    if (modalStack.at(-1) !== api) return;
    if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key === 'Tab'){
      const f = $$('button:not(:disabled),a[href],input:not(:disabled),select,[tabindex="0"]', scrim).filter(x => x.offsetParent !== null);
      if (!f.length) return; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0){ e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-close]')) close(); });
  const api = { el:scrim, body:b, close }; modalStack.push(api);
  requestAnimationFrame(() => ($('[autofocus]', scrim) || $('.modal-b button, .modal-b input', scrim) || $('.x-btn', scrim))?.focus());
  return api;
}
export const anyModalOpen = () => modalStack.length > 0;

/* ------------------------------------------------------------- city picker */
export function openCityPicker(first = false){
  const body = document.createElement('div');
  body.innerHTML = `${first ? '<p style="margin:0 0 16px;color:var(--ink-2)">Pick your city to see what\'s playing near you.</p>' : ''}
    <div class="city-grid">${CITIES.map(c => `<button class="city" data-city="${c.id}" aria-pressed="${c.id === S.city}">${cityGlyph(c.id)}<span>${c.name}</span></button>`).join('')}</div>`;
  const m = openModal({ title: first ? 'Welcome to Reelhouse' : 'Choose your city', body, onClose: () => { if (first) setCity(S.city); } });   // dismissing the welcome picker keeps the default city
  body.addEventListener('click', e => { const b = e.target.closest('[data-city]'); if (!b) return; setCity(b.dataset.city); m.close(); window.dispatchEvent(new Event('hashchange')); });
}
function cityGlyph(id){
  const g = { mumbai:'<path d="M3 20h18M5 20v-6l3-2v8M10 20V8l4-3v15M16 20v-9l3 2v7"/>', delhi:'<path d="M4 20h16M6 20v-7h12v7M8 13V9a4 4 0 0 1 8 0v4M12 5V3"/>',
    bengaluru:'<path d="M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5"/>', hyderabad:'<path d="M4 20h16M6 20V9M18 20V9M6 9h12M9 9V6M15 9V6M12 20v-6a2 2 0 0 0-2-2"/>',
    chennai:'<path d="M4 20h16M7 20L9 6h6l2 14M10 10h4M9.5 14h5"/>', pune:'<path d="M4 20h16M5 20v-8l7-5 7 5v8M9 20v-4h6v4"/>', kolkata:'<path d="M2 16h20M5 16l3-7h8l3 7M8 16v4M16 16v4M12 9V5"/>' };
  return sv(g[id] || g.pune, 'stroke-width="1.6"');
}

/* ------------------------------------------------------------- search palette */
export function openSearch(){
  const body = document.createElement('div');
  body.innerHTML = `<div class="search-in">${I.search}<input type="search" placeholder="Search movies, cinemas, genres…" aria-label="Search" autofocus autocomplete="off"></div><div class="sres" role="listbox" aria-label="Results"></div>`;
  const m = openModal({ body, cls:'search', labelledBy:'srch' });
  m.body.style.padding = '0';
  const inp = $('input', body), res = $('.sres', body); let items = [], cur = 0;
  const go = href => { m.close(); location.hash = href; };
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    const movies = MOVIES.filter(x => !q || x.title.toLowerCase().includes(q) || x.genres.some(g => g.toLowerCase().includes(q)) || x.langs.some(l => l.toLowerCase().includes(q)) || x.cast.some(c => c.toLowerCase().includes(q))).slice(0, 7);
    const cins = cinemasFor(S.city || 'mumbai').filter(c => q && (c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q))).slice(0, 5);
    items = [...movies.map(x => ({href:`#/movie/${x.id}`})), ...cins.map(c => ({href:`#/cinema/${c.id}`}))]; cur = 0;
    res.innerHTML = (movies.length ? `<h4>Movies</h4>` + movies.map((x, i) => `<button class="sitem" role="option" data-i="${i}" aria-selected="${i === 0}"><img src="${posterURL(x, 120)}" alt=""><span><b>${esc(x.title)}</b><small>${x.status === 'soon' ? 'Coming soon' : `★ ${x.rating.toFixed(1)}`} · ${x.genres.join(', ')} · ${x.langs.slice(0, 2).join(', ')}</small></span></button>`).join('') : '')
      + (cins.length ? `<h4>Cinemas</h4>` + cins.map((c, j) => `<button class="sitem" role="option" data-i="${movies.length + j}" aria-selected="false"><span class="ic">${I.building}</span><span><b>${esc(c.name)}</b><small>${c.km} km · ${esc(c.address)}</small></span></button>`).join('') : '')
      || `<div class="empty"><b>No matches</b>Try a title, genre, language or cinema.</div>`;
  };
  const mark = () => $$('.sitem', res).forEach((b, i) => { b.setAttribute('aria-selected', String(i === cur)); if (i === cur) b.scrollIntoView({block:'nearest'}); });
  inp.addEventListener('input', draw);
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); cur = Math.min(cur + 1, items.length - 1); mark(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); cur = Math.max(cur - 1, 0); mark(); }
    else if (e.key === 'Enter' && items[cur]){ e.preventDefault(); go(items[cur].href); }
  });
  res.addEventListener('click', e => { const b = e.target.closest('.sitem'); if (b) go(items[+b.dataset.i].href); });
  draw();
}

/* ------------------------------------------------------------- misc helpers */
export function avatarStyle(name){ let h = 0; for (const ch of name) h = (h*31 + ch.charCodeAt(0)) % 360; return `background:linear-gradient(140deg,hsl(${h} 45% 42%),hsl(${(h + 40) % 360} 50% 24%))`; }
export const initials = n => n.replace('Voice: ', '').split(' ').map(w => w[0]).slice(0, 2).join('');
export function setNav(key){ $$('[data-nav]').forEach(a => { if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
export function seatLabelList(show, ids){
  const L = LAYOUTS[show.layoutId]; return ids.map(id => L.seats.find(s => s.id === id)).filter(Boolean);
}
export function qs(){ const i = location.hash.indexOf('?'); return new URLSearchParams(i < 0 ? '' : location.hash.slice(i + 1)); }
export function showOrNull(id){ try { return showById(id); } catch { return null; } }
