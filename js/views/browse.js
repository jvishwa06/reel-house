// Home, movie details, showtimes, cinemas list and single-cinema pages.
import { MOVIES, movieById, LANGS, GENRES, FORMATS, cinemasFor, cinemaById, cityById, showsFor, availability, isPast,
         todayISO, addDays, iso, parseISO, fmtTime, fmtDur, fmtDay, inr, releaseDate, REVIEWS, AMENITIES, catName, LAYOUTS } from '../data.js';
import { posterURL, backdropURL } from '../posters.js';
import { S, $, $$, esc, I, AMEN_ICON, toast, openModal, toggleInterest, toggleFav, avatarStyle, initials, setNav, qs, bookedSeats } from '../core.js';

const nowShowing = () => MOVIES.filter(m => m.status === 'now');
const votes = n => n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
const langLine = m => m.langs.slice(0, 3).join(', ') + (m.langs.length > 3 ? ` +${m.langs.length - 3}` : '');
function posterCard(m){
  return `<a class="mcard" href="#/movie/${m.id}">
    <div class="ph"><img src="${posterURL(m)}" alt="${esc(m.title)} poster" loading="lazy">
      ${m.status === 'now' ? `<span class="rt">${I.star}${m.rating.toFixed(1)}<small>/10 · ${votes(m.votes)}</small></span>` : ''}</div>
    <h3>${esc(m.title)}</h3><p>${m.cert} · ${langLine(m)}</p></a>`;
}
const footer = () => `<footer class="foot"><div class="wrap"><span>© ${new Date().getFullYear()} Reelhouse · A demo booking experience. All films and cinemas are fictional.</span><span>Prices include GST where applicable.</span></div></footer>`;

/* ================================================================== HOME */
const homeFilters = { langs:new Set(), genres:new Set(), formats:new Set(), sort:'popular' };
export function renderHome(main){
  setNav('home');
  const city = cityById(S.city);
  const featured = [...nowShowing()].sort((a, b) => b.popularity - a.popularity).slice(0, 5);
  main.innerHTML = `<div class="view">
    <section class="hero" aria-roledescription="carousel" aria-label="Featured films">
      ${featured.map((m, i) => `<div class="hero-slide${i === 0 ? ' on' : ''}" aria-hidden="${i !== 0}">
        <div class="hero-bg" style="background-image:url(${backdropURL(m)})"></div>
        <div class="wrap" style="height:100%"><div class="hero-c">
          <div class="hero-meta"><span class="tag gold">In cinemas</span><span class="tag cert">${m.cert}</span>${m.genres.join(' · ')}<span class="dot-sep"></span>${fmtDur(m.mins)}</div>
          <h1>${esc(m.title)}</h1>
          <p class="tl">${esc(m.tagline)} <span style="color:var(--ink-3)">${langLine(m)}</span></p>
          <div class="hero-cta"><a class="btn btn-primary" href="#/movie/${m.id}?book=1">${I.ticket}Book tickets</a><a class="btn btn-ghost" href="#/movie/${m.id}">${I.play}Details</a></div>
        </div></div></div>`).join('')}
      <div class="hero-dots">${featured.map((m, i) => `<button aria-label="Show ${esc(m.title)}" aria-current="${i === 0}"></button>`).join('')}</div>
    </section>
    <div class="wrap">
      <section class="sec" aria-labelledby="nsH">
        <div class="sec-h"><div><h2 id="nsH">Now showing in ${esc(city.name)}</h2><p>${nowShowing().length} films · tap one to see showtimes</p></div></div>
        <div class="filters" id="filters"></div>
        <div class="grid" id="grid"></div>
      </section>
      <section class="sec" aria-labelledby="csH">
        <div class="sec-h"><div><h2 id="csH">Coming soon</h2><p>Mark interest to get a reminder when bookings open</p></div></div>
        <div class="soon-row">${MOVIES.filter(m => m.status === 'soon').map(m => `<article class="scard">
          <a href="#/movie/${m.id}" class="bd" style="display:block;background-image:url(${backdropURL(m, 640)})"><span class="tag">${fmtDay(releaseDate(m), {day:'numeric', month:'short'})}</span></a>
          <div class="bdy"><a href="#/movie/${m.id}"><h3>${esc(m.title)}</h3><p>${m.genres.join(', ')} · ${m.langs[0]}</p></a>
          <button class="int-btn" data-int="${m.id}" aria-pressed="${S.interest.has(m.id)}">${I.bell}<span>${S.interest.has(m.id) ? 'Interested' : 'Notify me'}</span></button></div></article>`).join('')}</div>
      </section>
      <section class="sec" aria-labelledby="cnH">
        <div class="sec-h"><div><h2 id="cnH">Cinemas near you</h2><p>${cinemasFor(S.city).length} cinemas in ${esc(city.name)}</p></div><a class="link" href="#/cinemas">See all${I.chev}</a></div>
        <div class="cin-grid">${cinemasFor(S.city).slice(0, 4).map(cinemaCard).join('')}</div>
      </section>
    </div>${footer()}</div>`;

  // carousel
  const slides = $$('.hero-slide', main), dots = $$('.hero-dots button', main), hero = $('.hero', main); let cur = 0, timer = 0;
  const show = i => { cur = (i + slides.length) % slides.length; slides.forEach((s, k) => { s.classList.toggle('on', k === cur); s.setAttribute('aria-hidden', String(k !== cur)); $$('a', s).forEach(a => a.tabIndex = k === cur ? 0 : -1); });
    dots.forEach((d, k) => d.setAttribute('aria-current', String(k === cur))); arm(); };
  const arm = () => { clearTimeout(timer); if (!hero.classList.contains('paused')) timer = setTimeout(() => show(cur + 1), 6000); };
  dots.forEach((d, k) => d.onclick = () => show(k));
  hero.addEventListener('mouseenter', () => { hero.classList.add('paused'); clearTimeout(timer); });
  hero.addEventListener('mouseleave', () => { hero.classList.remove('paused'); arm(); });
  hero.addEventListener('focusin', () => { hero.classList.add('paused'); clearTimeout(timer); });
  let tx = null; hero.addEventListener('touchstart', e => tx = e.touches[0].clientX, {passive:true});
  hero.addEventListener('touchend', e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); tx = null; });
  show(0);

  // filters + grid
  const F = homeFilters, fEl = $('#filters', main), gEl = $('#grid', main);
  const langsAvail = LANGS.filter(l => nowShowing().some(m => m.langs.includes(l)));
  const drawFilters = () => {
    fEl.innerHTML = `<div class="scroll-x" role="group" aria-label="Language">${langsAvail.map(l => `<button class="chip" data-f="langs" data-v="${l}" aria-pressed="${F.langs.has(l)}">${l}</button>`).join('')}</div>
      <span class="sep"></span>
      <div class="scroll-x" role="group" aria-label="Genre">${GENRES.filter(g => nowShowing().some(m => m.genres.includes(g))).map(g => `<button class="chip" data-f="genres" data-v="${g}" aria-pressed="${F.genres.has(g)}">${g}</button>`).join('')}</div>
      <span class="sep"></span>
      <div class="scroll-x" role="group" aria-label="Format">${FORMATS.map(f => `<button class="chip" data-f="formats" data-v="${f}" aria-pressed="${F.formats.has(f)}">${f}</button>`).join('')}</div>
      <span class="sep"></span>
      <div class="scroll-x" role="group" aria-label="Sort">${[['popular','Popular'],['rating','Top rated'],['new','Newest']].map(([k, l]) => `<button class="chip" data-sort="${k}" aria-pressed="${F.sort === k}">${l}</button>`).join('')}
      ${F.langs.size + F.genres.size + F.formats.size ? `<button class="chip" data-clear style="color:var(--accent)">${I.x}Clear</button>` : ''}</div>`;
  };
  const drawGrid = () => {
    let list = nowShowing().filter(m => (!F.langs.size || m.langs.some(l => F.langs.has(l))) && (!F.genres.size || m.genres.some(g => F.genres.has(g))) && (!F.formats.size || m.formats.some(f => F.formats.has(f))));
    list.sort(F.sort === 'rating' ? (a, b) => b.rating - a.rating : F.sort === 'new' ? (a, b) => b.release - a.release : (a, b) => b.popularity - a.popularity);
    gEl.innerHTML = list.length ? list.map(posterCard).join('') : `<div class="empty" style="grid-column:1/-1"><b>Nothing matches those filters</b>Try removing a language or format.</div>`;
  };
  fEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.clear != null){ F.langs.clear(); F.genres.clear(); F.formats.clear(); }
    else if (b.dataset.sort) F.sort = b.dataset.sort;
    else { const set = F[b.dataset.f]; set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v); }
    drawFilters(); drawGrid();
  });
  drawFilters(); drawGrid();
  main.addEventListener('click', e => { const b = e.target.closest('[data-int]'); if (b) interestToggle(b); });
  return () => clearTimeout(timer);
}
function interestToggle(b){
  const on = toggleInterest(b.dataset.int); b.setAttribute('aria-pressed', String(on));
  const sp = $('span', b); if (sp) sp.textContent = on ? 'Interested' : 'Notify me';
  toast(on ? 'We\'ll let you know when bookings open' : 'Removed from your list', I.bell);
}
function cinemaCard(c){
  return `<a class="ccard" href="#/cinema/${c.id}"><h3>${esc(c.name)}</h3><p>${I.pin.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${c.km} km · ${esc(c.address)}</p>
    <div class="amen">${c.amenities.slice(0, 4).map(a => `<span>${AMEN_ICON[a]}${AMENITIES[a]}</span>`).join('')}</div></a>`;
}

/* ================================================================== MOVIE */
export function renderMovie(main, id){
  setNav('home');
  const m = movieById(id); if (!m) return notFound(main);
  const now = m.status === 'now';
  const similar = MOVIES.filter(x => x.id !== m.id && x.status === 'now' && x.genres.some(g => m.genres.includes(g))).slice(0, 6);
  main.innerHTML = `<div class="view">
    <section class="mhero"><div class="mhero-bg" style="background-image:url(${backdropURL(m)})"></div>
      <div class="wrap">
        <div class="poster"><img src="${posterURL(m)}" alt="${esc(m.title)} poster"></div>
        <div>
          <div class="meta"><span class="tag ${now ? 'gold' : ''}">${now ? 'In cinemas' : 'Releasing ' + fmtDay(releaseDate(m), {day:'numeric', month:'long'})}</span><span class="tag cert">${m.cert}</span></div>
          <h1>${esc(m.title)}</h1>
          <div class="meta">${fmtDur(m.mins)}<span class="dot-sep"></span>${m.genres.join(', ')}<span class="dot-sep"></span>${now ? 'Released ' : ''}${fmtDay(releaseDate(m), {day:'numeric', month:'short', year:'numeric'})}</div>
          ${now ? `<div class="rbox"><b>${I.star}${m.rating.toFixed(1)}/10</b><div><small>${m.votes.toLocaleString('en-IN')} ratings</small><small>${Math.round(m.rating*10 + 3)}% liked it</small></div></div>`
                : `<div class="rbox"><b>${I.bell}${(S.interest.has(m.id) ? 1 : 0) + Math.round(m.popularity*24000).toLocaleString('en-IN')}</b><div><small>people are interested</small></div></div>`}
          <div class="fmt-row">${m.formats.map(f => `<span class="tag">${f}</span>`).join('')}${m.langs.map(l => `<span class="tag">${l}</span>`).join('')}</div>
          <div class="cta-row">${now ? `<button class="btn btn-primary" id="bookBtn">${I.ticket}Book tickets</button>` : `<button class="btn btn-primary" data-int="${m.id}" aria-pressed="${S.interest.has(m.id)}">${I.bell}<span>${S.interest.has(m.id) ? 'Interested' : 'Notify me'}</span></button>`}</div>
        </div>
      </div></section>
    <div class="wrap">
      <section class="sec about">
        <div><div class="sec-h"><h2>About the film</h2></div><p>${esc(m.synopsis)}</p></div>
        <div><div class="sec-h"><h2>Cast & crew</h2></div>
          <div class="people">${[...m.cast.map(n => [n, n.startsWith('Voice') ? 'Voice cast' : 'Actor']), [m.director, 'Director']].map(([n, r]) => `<div class="person"><div class="av" style="${avatarStyle(n)}">${initials(n)}</div>${esc(n.replace('Voice: ', ''))}<small>${r}</small></div>`).join('')}</div></div>
      </section>
      ${now ? `<section class="sec"><div class="sec-h"><div><h2>Top reviews</h2><p>From people who booked on Reelhouse</p></div></div>
        <div class="reviews">${REVIEWS.slice(0, 4).map(([n, r, t], i) => `<article class="review"><header><span>${n}</span><span class="rating">${I.star}${Math.min(10, Math.max(6, Math.round(r + (m.rating - 8.2) + (i % 2 ? -.5 : .4))))}/10</span></header><p>${esc(t)}</p></article>`).join('')}</div></section>` : ''}
      ${similar.length ? `<section class="sec"><div class="sec-h"><h2>You might also like</h2></div><div class="grid">${similar.map(posterCard).join('')}</div></section>` : ''}
    </div>${footer()}</div>`;
  $('#bookBtn', main)?.addEventListener('click', () => pickLangFormat(m));
  main.addEventListener('click', e => { const b = e.target.closest('[data-int]'); if (b) interestToggle(b); });
  if (qs().get('book') && now) pickLangFormat(m);
}

// District/BMS-style: choose language + format before showtimes
function pickLangFormat(m){
  const combos = m.langs.flatMap(l => m.formats.map(f => [l, f]));
  if (combos.length === 1){ location.hash = `#/movie/${m.id}/tickets?lang=${encodeURIComponent(combos[0][0])}&fmt=${encodeURIComponent(combos[0][1])}`; return; }
  // count upcoming shows per language/format this week so empty combinations are greyed out
  const count = {};
  for (let i = 0; i < 7; i++){ const d = iso(addDays(new Date(), i)); for (const c of cinemasFor(S.city)) for (const s of showsFor(m, c, d)) if (!isPast(s)) count[s.lang + '|' + s.format] = (count[s.lang + '|' + s.format] || 0) + 1; }
  const body = `<div class="opt-list">${m.langs.map(l => `<div class="opt-group"><h3>${l}</h3><div class="chips">${m.formats.map(f => { const n = count[l + '|' + f] || 0;
    return n ? `<a class="chip" href="#/movie/${m.id}/tickets?lang=${encodeURIComponent(l)}&fmt=${encodeURIComponent(f)}">${f}<small style="opacity:.55">${n} shows</small></a>` : `<span class="chip" aria-disabled="true" style="opacity:.35;cursor:not-allowed" title="No ${l} ${f} shows this week">${f}</span>`; }).join('')}</div></div>`).join('')}
    <a class="chip" style="justify-self:start" href="#/movie/${m.id}/tickets">All languages & formats</a></div>`;
  const md = openModal({ title:`${esc(m.title)} · Select language & format`, body });
  md.body.addEventListener('click', e => { if (e.target.closest('a')) md.close(); });
}

/* ================================================================== SHOWTIMES */
const DAYS = 7;
const dateStrip = (sel, href) => Array.from({length:DAYS}, (_, i) => { const d = iso(addDays(new Date(), i)), dt = parseISO(d);
  return `<a class="date" href="${href(d)}" aria-pressed="${d === sel}"><small>${i === 0 ? 'Today' : i === 1 ? 'Tmrw' : dt.toLocaleDateString('en-IN', {weekday:'short'})}</small><b>${dt.getDate()}</b><span>${dt.toLocaleDateString('en-IN', {month:'short'})}</span></a>`; }).join('');
const TOD = [['morning','Morning','<12'], ['afternoon','Afternoon','12–4'], ['evening','Evening','4–8'], ['night','Night','8+']];
const todOf = t => { const h = +t.slice(0, 2); return h < 12 ? 'morning' : h < 16 ? 'afternoon' : h < 20 ? 'evening' : 'night'; };
const PRICE = [['p1','Under ₹250', 0, 250], ['p2','₹250–₹450', 250, 450], ['p3','₹450+', 450, 1e9]];
const stF = { tod:new Set(), price:new Set(), recliner:false };

function timePill(s, m){
  const past = isPast(s), av = availability(s, bookedSeats(s.id));
  const prices = Object.values(s.prices), lo = Math.min(...prices), hi = Math.max(...prices);
  const dis = past || av.level === 'soldout';
  return `<button class="time ${av.level}" data-show="${s.id}" ${dis ? 'disabled' : ''} aria-label="${fmtTime(s.time)}, ${s.format}, ${s.lang}, ${s.screenLabel}, ${dis ? (past ? 'booking closed' : 'sold out') : `${av.free} seats left, ${inr(lo)} to ${inr(hi)}`}">
    <b>${fmtTime(s.time)}</b><small>${s.format} · ${s.lang.slice(0, 3)}</small>
    <span class="tip"><b>${s.screenLabel}</b>${Object.entries(s.prices).map(([c, p]) => `${catName(c)} ${inr(p)}`).join(' · ')}<br>${dis ? (past ? 'Booking closed' : 'Sold out') : `${av.free} of ${av.total} seats left`}</span></button>`;
}
function showPasses(s){
  if (stF.tod.size && !stF.tod.has(todOf(s.time))) return false;
  if (stF.price.size){ const ps = Object.values(s.prices); if (![...stF.price].some(k => { const [, , a, b] = PRICE.find(p => p[0] === k); return ps.some(p => p >= a && p < b); })) return false; }
  if (stF.recliner && !LAYOUTS[s.layoutId].cats.includes('recliner')) return false;
  return true;
}
function filterBar(){
  return `<div class="scroll-x" id="stFilters">${TOD.map(([k, l, r]) => `<button class="chip" data-tod="${k}" aria-pressed="${stF.tod.has(k)}">${l} <small style="opacity:.6">${r}</small></button>`).join('')}
    <span class="sep" style="width:1px;background:var(--line-2);flex:none"></span>
    ${PRICE.map(([k, l]) => `<button class="chip" data-price="${k}" aria-pressed="${stF.price.has(k)}">${l}</button>`).join('')}
    <button class="chip" data-recl aria-pressed="${stF.recliner}">${I.sofa}Recliners</button></div>`;
}
function bindFilters(root, redraw){
  root.addEventListener('click', e => {
    const b = e.target.closest('#stFilters button'); if (!b) return;
    if (b.dataset.tod){ stF.tod.has(b.dataset.tod) ? stF.tod.delete(b.dataset.tod) : stF.tod.add(b.dataset.tod); }
    else if (b.dataset.price){ stF.price.has(b.dataset.price) ? stF.price.delete(b.dataset.price) : stF.price.add(b.dataset.price); }
    else if (b.dataset.recl != null) stF.recliner = !stF.recliner;
    $('#stFilters', root).outerHTML = filterBar(); redraw();
  });
}
function bindShowClicks(root){
  root.addEventListener('click', e => { const b = e.target.closest('[data-show]'); if (b && !b.disabled) location.hash = `#/seats/${encodeURIComponent(b.dataset.show)}`; });
  root.addEventListener('click', e => { const b = e.target.closest('[data-fav]'); if (!b) return; e.preventDefault(); const on = toggleFav(b.dataset.fav); b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? I.heartF : I.heart; toast(on ? 'Added to favourite cinemas' : 'Removed from favourites', I.heart); });
}
const legend = `<div class="legend"><span><i style="background:var(--green)"></i>Available</span><span><i style="background:var(--amber)"></i>Filling fast</span><span><i style="background:var(--rose)"></i>Almost full</span><span class="hover-only" style="margin-left:auto">${I.info.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} Hover a time for prices</span></div>`;

export function renderShowtimes(main, id){
  setNav('home');
  const m = movieById(id); if (!m || m.status !== 'now') return notFound(main);
  const p = qs(), lang = p.get('lang'), fmt = p.get('fmt');
  let date = p.get('date'); if (!date || date < todayISO()) date = todayISO();
  const href = d => `#/movie/${m.id}/tickets?${new URLSearchParams({...(lang ? {lang} : {}), ...(fmt ? {fmt} : {}), date: d})}`;
  main.innerHTML = `<div class="view">
    <div class="st-head"><div class="wrap">
      <div class="st-title"><a class="x-btn" href="#/movie/${m.id}" aria-label="Back to ${esc(m.title)}">${I.back}</a><h1>${esc(m.title)}</h1><span class="tag cert">${m.cert}</span>
        ${lang || fmt ? `<span class="tag gold">${[lang, fmt].filter(Boolean).join(' · ')}</span><a class="link" href="#/movie/${m.id}/tickets?date=${date}">Clear</a>` : `<span style="color:var(--ink-3);font-size:13.5px">${m.genres.join(', ')} · ${fmtDur(m.mins)}</span>`}</div>
      <nav class="dates" aria-label="Choose date">${dateStrip(date, href)}</nav>
      ${filterBar()}
    </div></div>
    <div class="wrap"><div style="margin-top:18px">${legend}</div><div class="cin-list" id="cinList"></div></div>${footer()}</div>`;
  const draw = () => {
    const all = cinemasFor(S.city).flatMap(c => showsFor(m, c, date).filter(s => (!lang || s.lang === lang) && (!fmt || s.format === fmt)));
    const rows = cinemasFor(S.city).map(c => ({ c, shows: showsFor(m, c, date).filter(s => !isPast(s) && (!lang || s.lang === lang) && (!fmt || s.format === fmt) && showPasses(s)) })).filter(r => r.shows.length);
    rows.sort((a, b) => (S.favs.has(b.c.id) - S.favs.has(a.c.id)) || a.c.km - b.c.km);
    $('#cinList', main).innerHTML = rows.length ? rows.map(({c, shows}, i) => `<article class="crow" style="animation-delay:${Math.min(i, 8)*40}ms">
      <div><h3><a href="#/cinema/${c.id}?date=${date}">${esc(c.name)}</a><button class="fav" data-fav="${c.id}" aria-pressed="${S.favs.has(c.id)}" aria-label="Favourite ${esc(c.name)}">${S.favs.has(c.id) ? I.heartF : I.heart}</button></h3>
        <p class="sub">${c.km} km away · ${esc(c.area)}</p>
        <div class="amen">${c.cancellable ? `<span style="color:var(--green)">${I.check}Cancellation available</span>` : `<span>Non-cancellable</span>`}${c.amenities.slice(0, 3).map(a => `<span>${AMEN_ICON[a]}${AMENITIES[a]}</span>`).join('')}</div></div>
      <div class="times">${shows.map(s => timePill(s, m)).join('')}</div></article>`).join('')
      : all.length && all.every(isPast) ? noMoreToday(href)
      : `<div class="empty card"><b>No shows match</b>Try another date${stF.tod.size || stF.price.size || stF.recliner ? ' or clear the filters' : ''}${lang || fmt ? ', or pick a different language/format' : ''}.</div>`;
  };
  bindFilters(main, draw); bindShowClicks(main); draw();
}
const noMoreToday = href => `<div class="empty card"><b>That's a wrap for today</b>All of today's shows have started.<br><br><a class="btn btn-primary" href="${href(iso(addDays(new Date(), 1)))}">See tomorrow's shows</a></div>`;

/* ================================================================== CINEMAS */
export function renderCinemas(main){
  setNav('cinemas');
  const city = cityById(S.city), list = cinemasFor(S.city);
  main.innerHTML = `<div class="view"><div class="wrap">
    <div class="page-h"><h1>Cinemas in ${esc(city.name)}</h1><p>${list.length} cinemas · sorted by distance</p></div>
    <div class="filters" style="margin-top:20px"><input class="input" id="cq" placeholder="Search by name or area" style="max-width:360px" aria-label="Search cinemas"></div>
    <div class="cin-grid" id="cg"></div></div>${footer()}</div>`;
  const draw = () => { const q = $('#cq', main).value.trim().toLowerCase();
    const l = list.filter(c => !q || c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q)).sort((a, b) => (S.favs.has(b.id) - S.favs.has(a.id)) || a.km - b.km);
    $('#cg', main).innerHTML = l.length ? l.map(cinemaCard).join('') : `<div class="empty" style="grid-column:1/-1"><b>No cinemas found</b>Try another area.</div>`; };
  $('#cq', main).addEventListener('input', draw); draw();
}
export function renderCinema(main, id){
  setNav('cinemas');
  const c = cinemaById(id); if (!c) return notFound(main);
  let date = qs().get('date'); if (!date || date < todayISO()) date = todayISO();
  main.innerHTML = `<div class="view">
    <div class="st-head"><div class="wrap">
      <div class="st-title"><a class="x-btn" href="#/cinemas" aria-label="All cinemas">${I.back}</a><h1>${esc(c.name)}</h1>
        <button class="fav" data-fav="${c.id}" aria-pressed="${S.favs.has(c.id)}" aria-label="Favourite this cinema" style="margin-left:0">${S.favs.has(c.id) ? I.heartF : I.heart}</button></div>
      <p style="margin:-6px 0 0;color:var(--ink-3);font-size:13.5px">${esc(c.address)} · ${c.km} km · ${c.screens.length} screens</p>
      <nav class="dates" aria-label="Choose date">${dateStrip(date, d => `#/cinema/${c.id}?date=${d}`)}</nav>
      ${filterBar()}
    </div></div>
    <div class="wrap"><div class="amen" style="margin-top:18px">${c.amenities.map(a => `<span>${AMEN_ICON[a]}${AMENITIES[a]}</span>`).join('')}</div>
      <div style="margin-top:14px">${legend}</div><div class="cin-list" id="mvList"></div></div>${footer()}</div>`;
  const draw = () => {
    const all = nowShowing().flatMap(m => showsFor(m, c, date));
    const rows = nowShowing().map(m => ({ m, shows: showsFor(m, c, date).filter(s => !isPast(s) && showPasses(s)) })).filter(r => r.shows.length);
    $('#mvList', main).innerHTML = rows.length ? rows.map(({m, shows}, i) => `<article class="crow" style="animation-delay:${Math.min(i, 8)*40}ms;grid-template-columns:minmax(220px,300px) 1fr">
      <a href="#/movie/${m.id}" style="display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:center"><img src="${posterURL(m, 160)}" alt="" style="border-radius:10px;aspect-ratio:2/3;object-fit:cover">
        <span><h3>${esc(m.title)}</h3><span class="sub" style="display:block;color:var(--ink-3);font-size:13px">${m.cert} · ${m.genres.join(', ')} · ${fmtDur(m.mins)}</span></span></a>
      <div class="times">${shows.map(s => timePill(s, m)).join('')}</div></article>`).join('')
      : all.length && all.every(isPast) ? noMoreToday(d => `#/cinema/${c.id}?date=${d}`)
      : `<div class="empty card"><b>No shows on this day</b>Try another date or clear the filters.</div>`;
  };
  bindFilters(main, draw); bindShowClicks(main); draw();
}

export function notFound(main, msg = 'That page doesn\'t exist.'){
  main.innerHTML = `<div class="view wrap"><div class="empty" style="padding:120px 20px"><b>Lost in the dark</b>${esc(msg)}<br><br><a class="btn btn-primary" href="#/">Back to movies</a></div></div>`;
}
