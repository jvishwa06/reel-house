// Boot + hash router. Each view renders into <main> and may return a cleanup function.
import { cityById } from './data.js';
import { S, $, setCity, openCityPicker, openSearch, anyModalOpen, updateTicketBadge } from './core.js';
import { renderHome, renderMovie, renderShowtimes, renderCinemas, renderCinema, notFound } from './views/browse.js';
import { renderSeats } from './views/seats.js';
import { renderCheckout, renderTicket, renderBookings } from './views/checkout.js';

const main = $('#main');
const ROUTES = [
  [/^\/?$/, () => renderHome(main)],
  [/^\/movie\/([^/]+)$/, id => renderMovie(main, id)],
  [/^\/movie\/([^/]+)\/tickets$/, id => renderShowtimes(main, id)],
  [/^\/cinemas$/, () => renderCinemas(main)],
  [/^\/cinema\/([^/]+)$/, id => renderCinema(main, id)],
  [/^\/seats\/(.+)$/, id => renderSeats(main, decodeURIComponent(id))],
  [/^\/checkout$/, () => renderCheckout(main)],
  [/^\/ticket\/([^/]+)$/, id => renderTicket(main, id)],
  [/^\/bookings$/, () => renderBookings(main)],
];
let cleanup = null, lastPath = null;
function route(){
  const raw = location.hash.replace(/^#/, '') || '/', path = raw.split('?')[0];
  try { cleanup?.(); } catch (e){ console.error(e); } cleanup = null;
  const hit = ROUTES.find(([re]) => re.test(path));
  try { cleanup = hit ? hit[1](...path.match(hit[0]).slice(1)) || null : (notFound(main), null); }
  catch (e){ console.error(e); notFound(main, 'Something went wrong loading this page.'); }
  if (path !== lastPath){ window.scrollTo({top:0, behavior:'instant'}); main.focus({preventScroll:true}); }
  lastPath = path;
}

(async function boot(){
  document.body.classList.add('has-tabbar');
  // posters draw with the web fonts, so wait for them (bounded)
  try { await Promise.race([Promise.all(['800 40px "Bricolage Grotesque"','500 14px "Geist"','600 12px "Geist"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch {}
  $('#cityName').textContent = cityById(S.city || 'mumbai').name;
  $('#cityBtn').onclick = () => openCityPicker(false);
  $('#searchBtn').onclick = openSearch;
  addEventListener('keydown', e => {
    if (e.key === '/' && !anyModalOpen() && !e.target.matches('input, textarea, select') && !document.body.classList.contains('on-seats')){ e.preventDefault(); openSearch(); }
  });
  addEventListener('hashchange', route);
  updateTicketBadge();
  const first = !S.city;
  if (first) S.city = 'mumbai';           // show Mumbai behind the welcome picker
  route();
  if (first) openCityPicker(true);
})();
