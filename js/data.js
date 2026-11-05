// Reelhouse data model — everything is fictional and generated deterministically from seeds,
// so the same city/date/show always produces the same showtimes and seat occupancy.

/* ------------------------------------------------------------------ utils */
export function rng(seed){ let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash(str){ let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
export const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseISO = s => new Date(s + 'T00:00');
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const todayISO = () => iso(new Date());
export const fmtTime = hhmm => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const fmtDur = m => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
export const fmtDay = (s, opts = {weekday:'short', day:'numeric', month:'short'}) => parseISO(s).toLocaleDateString('en-IN', opts);

/* ------------------------------------------------------------------ movies */
// palette: [deep, mid, light, accent]; motif drives the procedural poster art (posters.js)
export const MOVIES = [
  { id:'monsoon-protocol', title:'Monsoon Protocol', tagline:'The storm is the only alibi.', status:'now',
    genres:['Action','Thriller'], langs:['Hindi','Tamil','Telugu'], formats:['2D','IMAX 2D','4DX'], mins:148, cert:'UA16+', rating:8.6, votes:48210, release:-9,
    palette:['#06121f','#0f3b57','#7fc4d9','#ffb547'], motif:'rain',
    synopsis:'When a cyber-heist drains the flood-defence fund of a coastal megacity on the eve of the monsoon, a disgraced disaster-response officer has seventy-two hours to trace the money before the sea walls fail.',
    director:'Ishaan Varde', cast:['Kabir Rathod','Naina Sethi','Dev Anand Iyer','Mehr Kapadia','Rohan Bakshi'], popularity:.92 },
  { id:'orbit-nine', title:'Orbit Nine', tagline:'Nine minutes of light. One way home.', status:'now',
    genres:['Sci-Fi','Adventure'], langs:['English','Hindi'], formats:['2D','3D','IMAX 3D'], mins:161, cert:'UA13+', rating:8.8, votes:61540, release:-16,
    palette:['#07051a','#2a1660','#8fd7ff','#c9a2ff'], motif:'planet',
    synopsis:'A salvage crew orbiting a dying gas giant discovers a signal repeating every nine minutes — from a ship that left Earth a century after their own.',
    director:'Mara Oyelaran', cast:['Theo Lindqvist','Aanya Rao','Ruth Okafor','Samir Haddad','Lena Brandt'], popularity:.95 },
  { id:'kesari-raat', title:'Kesari Raat', tagline:'Some nights are written in saffron.', status:'now',
    genres:['Romance','Musical'], langs:['Hindi'], formats:['2D'], mins:155, cert:'U', rating:7.9, votes:22950, release:-5,
    palette:['#2a0614','#8c1d40','#ffb25b','#ffd27a'], motif:'lanterns',
    synopsis:'Over one wedding night in old Jaipur, a sitar player and a lighting designer race to save a doomed concert — and maybe each other.',
    director:'Saba Qureshi', cast:['Arnav Khanna','Tara Deshmukh','Zoya Mirza','Kunal Bhat'], popularity:.74 },
  { id:'vettai', title:'Vettai', tagline:'Every hunt has two hunters.', status:'now',
    genres:['Action','Crime'], langs:['Tamil','Telugu','Hindi'], formats:['2D','4DX'], mins:154, cert:'A', rating:8.3, votes:39870, release:-2,
    palette:['#100406','#5c0b12','#ff5a4a','#f2d0b4'], motif:'blade',
    synopsis:'A retired tracker is pulled back into the forests of the Western Ghats to find a poacher who seems to know every move he will make.',
    director:'K. Selvaraghavan Nair', cast:['Vikram Senthil','Meenakshi Raj','Prakash Varma','Anjali Krish'], popularity:.88 },
  { id:'last-lighthouse', title:'The Last Lighthouse', tagline:'It never stopped turning.', status:'now',
    genres:['Drama','Mystery'], langs:['English'], formats:['2D','Dolby Atmos'], mins:125, cert:'UA13+', rating:8.1, votes:15420, release:-23,
    palette:['#040a14','#12324a','#f6e3a8','#ffcf6e'], motif:'lighthouse',
    synopsis:'A cartographer arrives on a Hebridean island to decommission its lighthouse and finds the keeper\'s logbooks predicting the weather — and her arrival — decades in advance.',
    director:'Fiona MacAllister', cast:['Isla Kerr','Tomasz Wren','Hamish Doyle','Nell Achterberg'], popularity:.66 },
  { id:'paper-boats', title:'Paper Boats', tagline:'Small boats. Big summer.', status:'now',
    genres:['Family','Comedy'], langs:['Hindi','English'], formats:['2D','3D'], mins:118, cert:'U', rating:7.6, votes:9810, release:-12,
    palette:['#0b2a4a','#2f7fc1','#ffe08a','#ff8f5a'], motif:'boats',
    synopsis:'Three cousins stuck at their grandmother\'s house during a flooded summer holiday enter a paper-boat race that spirals into a neighbourhood war.',
    director:'Rhea Pinto', cast:['Aarav Joshi','Mira Saldanha','Neeraj Kulkarni','Pooja Hegde Rao'], popularity:.58 },
  { id:'neelakasham', title:'Neelakasham', tagline:'Under the same blue sky.', status:'now',
    genres:['Drama'], langs:['Malayalam'], formats:['2D'], mins:132, cert:'U', rating:8.9, votes:12760, release:-30,
    palette:['#05161a','#1c5b5e','#bfe6d6','#f4c97a'], motif:'hills',
    synopsis:'A bus conductor in the Idukki hills and the schoolteacher who rides his route every morning share one silent year — until the road is scheduled to close.',
    director:'Anil Mathew Kurian', cast:['Fahad Ummer','Parvathi Menon','Jojo Thomas','Lissy George'], popularity:.62 },
  { id:'hollow-pines', title:'The Hollow Pines', tagline:'The forest remembers who left.', status:'now',
    genres:['Horror'], langs:['English','Hindi'], formats:['2D','Dolby Atmos'], mins:109, cert:'A', rating:7.2, votes:18330, release:-7,
    palette:['#040805','#18321f','#a6e3a1','#d4ff6a'], motif:'pines',
    synopsis:'Five friends return to the summer camp where one of them vanished twenty years ago, and the counsellors\' cabins are exactly as they left them.',
    director:'Wes Calloway', cast:['Jordan Pike','Riya Sen Gupta','Marcus Bell','Dana Hollis','Owen Price'], popularity:.6 },
  { id:'simha-garjana', title:'Simha Garjana', tagline:'When the lion roars, the kingdom listens.', status:'now',
    genres:['Action','Drama'], langs:['Telugu','Hindi','Tamil','Kannada'], formats:['2D','IMAX 2D'], mins:170, cert:'UA16+', rating:8.0, votes:52300, release:-4,
    palette:['#140a02','#6a3a0a','#ffc65c','#ff8a3d'], motif:'sun',
    synopsis:'A village wrestler who has never left his district takes on the land mafia that burned his father\'s farm — in front of the entire state.',
    director:'Sreenu Vaitla Reddy', cast:['Ram Teja','Keerthi Varma','Jagapathi Rao','Sunil Kotla'], popularity:.9 },
  { id:'little-comet', title:'Little Comet', tagline:'Lost in space. Found in friendship.', status:'now',
    genres:['Animation','Family'], langs:['English','Hindi'], formats:['2D','3D'], mins:96, cert:'U', rating:8.2, votes:8740, release:-19,
    palette:['#0c0a2a','#4b2a8a','#ff9ad1','#7ff0e0'], motif:'comet',
    synopsis:'A tiny comet who is afraid of the dark has to cross the whole solar system to get home before the eclipse.',
    director:'Hana Morita', cast:['Voice: Ellie Marsh','Voice: Kiran Dutt','Voice: Paolo Ricci'], popularity:.55 },
  // coming soon
  { id:'desert-echoes', title:'Desert Echoes', tagline:'The dunes keep every secret.', status:'soon',
    genres:['Thriller','Drama'], langs:['Hindi'], formats:['2D','IMAX 2D'], mins:140, cert:'UA16+', rating:0, votes:0, release:9,
    palette:['#1a0d05','#8a4b1c','#ffd59a','#ff9f4a'], motif:'dunes',
    synopsis:'A radio operator at a remote border outpost starts receiving transmissions in her late brother\'s voice.',
    director:'Ishaan Varde', cast:['Mehr Kapadia','Rohan Bakshi','Sana Iqbal'], popularity:.8 },
  { id:'zero-g-heist', title:'Zero-G Heist', tagline:'No gravity. No witnesses.', status:'soon',
    genres:['Action','Sci-Fi'], langs:['English','Hindi'], formats:['2D','3D','IMAX 3D','4DX'], mins:132, cert:'UA13+', rating:0, votes:0, release:16,
    palette:['#05040f','#1b2a6b','#9be7ff','#ff6ad5'], motif:'planet',
    synopsis:'A crew of retired astronauts plans to rob the first casino in low-Earth orbit.',
    director:'Mara Oyelaran', cast:['Theo Lindqvist','Ruth Okafor','Ivan Petrov'], popularity:.85 },
  { id:'kaadu', title:'Kaadu', tagline:'The forest has a voice.', status:'soon',
    genres:['Drama','Thriller'], langs:['Kannada','Hindi'], formats:['2D'], mins:138, cert:'UA13+', rating:0, votes:0, release:23,
    palette:['#03100a','#1f4a2a','#c8f0a0','#f7d36a'], motif:'pines',
    synopsis:'A forest ranger investigates a series of fires that only start on new-moon nights.',
    director:'Rakshith Gowda', cast:['Yash Shetty','Rashmi Aithal','Darshan Kumar'], popularity:.65 },
  { id:'second-innings', title:'Second Innings', tagline:'Forty is just a score.', status:'soon',
    genres:['Sports','Drama'], langs:['Hindi'], formats:['2D'], mins:146, cert:'U', rating:0, votes:0, release:30,
    palette:['#06140c','#1d5c35','#f2f0d0','#ffcc4d'], motif:'stadium',
    synopsis:'A forgotten fast bowler gets one last shot at the national team — as a net bowler for the player who replaced him.',
    director:'Saba Qureshi', cast:['Kabir Rathod','Tara Deshmukh','Arjun Puri'], popularity:.7 },
];
export const movieById = id => MOVIES.find(m => m.id === id);
export const releaseDate = m => iso(addDays(new Date(), m.release));
export const LANGS = ['Hindi','English','Tamil','Telugu','Malayalam','Kannada'];
export const GENRES = [...new Set(MOVIES.flatMap(m => m.genres))];
export const FORMATS = ['2D','3D','IMAX 2D','IMAX 3D','4DX','Dolby Atmos'];

export const REVIEWS = [
  ['Ananya S.', 9, 'Gorgeous on the big screen. Go for the best format you can get.'],
  ['Rahul M.', 8, 'Second half drags a little but the finale makes up for it completely.'],
  ['Priya K.', 10, 'Watched it twice already. The background score is unreal.'],
  ['Arjun T.', 7, 'Solid performances, predictable in places. Still worth it in a theatre.'],
  ['Fatima R.', 9, 'Took my parents, everyone loved it. Interval block was a highlight.'],
  ['Sameer D.', 8, 'Visually stunning. Sound design in Atmos was worth the extra.'],
];

/* ------------------------------------------------------------------ cities + cinemas */
export const CITIES = [
  { id:'mumbai', name:'Mumbai', areas:['Lower Parel','Andheri West','Bandra','Powai','Thane West','Malad','Vashi'] },
  { id:'delhi', name:'Delhi NCR', areas:['Saket','Connaught Place','Vasant Kunj','Gurugram Sec 29','Noida Sec 18','Dwarka'] },
  { id:'bengaluru', name:'Bengaluru', areas:['Koramangala','Indiranagar','Whitefield','MG Road','HSR Layout','Malleshwaram'] },
  { id:'hyderabad', name:'Hyderabad', areas:['Banjara Hills','HITEC City','Kukatpally','Gachibowli','Ameerpet'] },
  { id:'chennai', name:'Chennai', areas:['T. Nagar','Velachery','Anna Nagar','OMR','Vadapalani'] },
  { id:'pune', name:'Pune', areas:['Kalyani Nagar','Baner','Viman Nagar','Kothrud','Hinjewadi'] },
  { id:'kolkata', name:'Kolkata', areas:['Park Street','Salt Lake','South City','Rajarhat','Ballygunge'] },
];
export const cityById = id => CITIES.find(c => c.id === id) || CITIES[0];

// fictional cinema brands; tier scales ticket prices
const BRANDS = [
  { name:'Reelhouse Signature', tier:1.35, short:'RH Signature' },
  { name:'Starlight Cinemas', tier:1.0, short:'Starlight' },
  { name:'Cineverse', tier:1.12, short:'Cineverse' },
  { name:'Galaxy Talkies', tier:.85, short:'Galaxy' },
  { name:'Aurora Screens', tier:1.05, short:'Aurora' },
];
export const AMENITIES = { recliner:'Recliners', food:'Food & beverages', parking:'Parking', wheelchair:'Wheelchair access', mticket:'M-ticket', atmos:'Dolby Atmos' };

// screen types → layout + supported formats
export const SCREEN_TYPES = {
  standard: { label:'Standard', layout:'standard', formats:['2D','3D'] },
  atmos:    { label:'Dolby Atmos', layout:'standard', formats:['2D','3D','Dolby Atmos'] },
  imax:     { label:'IMAX', layout:'imax', formats:['IMAX 2D','IMAX 3D'] },
  luxe:     { label:'LUXE', layout:'luxe', formats:['2D','3D'] },
  '4dx':    { label:'4DX', layout:'4dx', formats:['4DX'] },
};

const cinemaCache = new Map();
export function cinemasFor(cityId){
  if (cinemaCache.has(cityId)) return cinemaCache.get(cityId);
  const city = cityById(cityId), r = rng(hash('cinemas|' + cityId)), list = [];
  city.areas.forEach((area, i) => {
    const brand = BRANDS[(i + Math.floor(r()*BRANDS.length)) % BRANDS.length];
    const screens = [{ n:1, type:'standard' }, { n:2, type:'atmos' }];
    if (brand.tier >= 1.05 || r() < .35) screens.push({ n:screens.length + 1, type:'imax' });
    if (brand.tier >= 1.1 || r() < .5) screens.push({ n:screens.length + 1, type:'luxe' });
    if (r() < .45) screens.push({ n:screens.length + 1, type:'4dx' });
    if (r() < .6) screens.push({ n:screens.length + 1, type:'standard' });
    const am = ['food','mticket','wheelchair'];
    if (screens.some(s => s.type === 'luxe')) am.unshift('recliner');
    if (screens.some(s => s.type === 'atmos')) am.push('atmos');
    if (r() < .7) am.push('parking');
    list.push({ id:`${cityId}-${i}`, cityId, brand:brand.name, short:brand.short, tier:brand.tier, area,
      name:`${brand.short}: ${area}`, address:`${['Phoenix','Infinity','Orion','Nexus','Central'][i % 5]} Mall, ${area}, ${city.name}`,
      km: +(1.2 + r()*14).toFixed(1), screens, amenities:am, cancellable: r() < .6 });
  });
  list.sort((a, b) => a.km - b.km);
  cinemaCache.set(cityId, list); return list;
}
export const cinemaById = id => { const [city] = id.split('-'); return cinemasFor(city).find(c => c.id === id); };

/* ------------------------------------------------------------------ seat layouts
   Each seat: { id:'F12', row:'F', ri (row index from screen), num, x (centre, in seat-widths from the
   auditorium centreline), w (width in seat-widths), cat, kind:'std'|'recliner'|'wheelchair'|'motion' }.
   rows: [{ label, ri, cat, seats:[...] }]. Row A is nearest the screen. */
const CAT = {
  classic:  { name:'Classic',  base:180 },
  prime:    { name:'Prime',    base:270 },
  recliner: { name:'Recliner', base:560 },
  motion:   { name:'4DX Motion', base:690 },
};
function buildLayout(id, spec){
  const rows = []; let ri = 0;
  for (const band of spec.bands){
    for (let k = 0; k < band.rows; k++, ri++){
      const label = String.fromCharCode(65 + ri), seats = []; let num = 0;
      const blocks = band.blocks, w = band.w || 1, gap = band.gap ?? 1.2;
      const total = blocks.reduce((a, b) => a + b*w, 0) + gap*(blocks.length - 1);
      let x = -total/2;
      blocks.forEach((count, bi) => {
        for (let j = 0; j < count; j++){
          num++;
          let kind = band.kind || 'std';
          if (band.wheelchair && k === 0 && bi === 0 && j < 2) kind = 'wheelchair';
          seats.push({ id:`${label}${num}`, row:label, ri, num, x: x + w/2, w, cat:band.cat, kind });
          x += w;
        }
        x += gap;
      });
      // number seats right-to-left like most Indian cinemas (seat 1 at the screen-left aisle end)
      rows.push({ label, ri, cat:band.cat, seats });
    }
  }
  return { id, name:spec.name, rows, seats: rows.flatMap(r => r.seats), curve:spec.curve, rise:spec.rise, pitch:spec.pitch,
           screenW:spec.screenW, screenDist:spec.screenDist, cats:[...new Set(spec.bands.map(b => b.cat))].reverse() };
}
export const LAYOUTS = {
  standard: buildLayout('standard', { name:'Standard', curve:.012, rise:.32, pitch:1.0, screenW:13, screenDist:6.2, bands:[
    { cat:'classic', rows:4, blocks:[4, 12, 4] },
    { cat:'prime', rows:7, blocks:[4, 12, 4], wheelchair:true },
    { cat:'recliner', rows:2, blocks:[3, 7, 3], w:1.45, kind:'recliner' },
  ]}),
  imax: buildLayout('imax', { name:'IMAX', curve:.018, rise:.42, pitch:1.0, screenW:19, screenDist:7.2, bands:[
    { cat:'classic', rows:5, blocks:[6, 16, 6] },
    { cat:'prime', rows:10, blocks:[6, 16, 6], wheelchair:true },
    { cat:'recliner', rows:2, blocks:[4, 10, 4], w:1.45, kind:'recliner' },
  ]}),
  luxe: buildLayout('luxe', { name:'LUXE', curve:.01, rise:.42, pitch:1.55, screenW:11, screenDist:5.6, bands:[
    { cat:'prime', rows:1, blocks:[3, 6, 3], w:1.5, kind:'recliner', gap:1.4 },
    { cat:'recliner', rows:6, blocks:[3, 6, 3], w:1.5, kind:'recliner', gap:1.4, wheelchair:true },
  ]}),
  '4dx': buildLayout('4dx', { name:'4DX', curve:.008, rise:.36, pitch:1.25, screenW:12, screenDist:6, bands:[
    { cat:'motion', rows:9, blocks:[4, 4, 4, 4], gap:1.0, kind:'motion' },
  ]}),
};
export const catName = c => CAT[c].name;

/* ------------------------------------------------------------------ showtimes */
const SLOTS = ['09:15','10:30','11:45','13:05','14:20','15:40','17:00','18:30','19:45','21:10','22:30','23:45'];
const isWeekend = dateISO => { const d = parseISO(dateISO).getDay(); return d === 0 || d === 5 || d === 6; };

export function priceFor(cinema, type, cat, dateISO, time){
  let p = CAT[cat].base*cinema.tier;
  if (type === 'imax') p *= 1.45; if (type === 'luxe') p *= 1.25; if (type === 'atmos') p *= 1.08;
  if (isWeekend(dateISO)) p *= 1.15;
  const h = +time.slice(0, 2);
  if (h < 12) p *= .82; else if (h >= 18 && h < 22) p *= 1.08;
  return Math.round(p/10)*10;
}

// all shows for one movie at one cinema on one date
export function showsFor(movie, cinema, dateISO){
  if (movie.status !== 'now') return [];
  const r = rng(hash(`${movie.id}|${cinema.id}|${dateISO}`));
  if (r() > .45 + movie.popularity*.5) return [];                 // not every cinema plays every film
  const out = [];
  for (const scr of cinema.screens){
    const st = SCREEN_TYPES[scr.type];
    const fmts = movie.formats.filter(f => st.formats.includes(f));
    if (!fmts.length) continue;
    if (r() > (scr.type === 'standard' ? .85 : .6)) continue;
    // 2–5 shows spread across the day on this screen (distinct slots, at least ~2.5 h apart)
    const n = 2 + Math.floor(r()*(scr.type === 'standard' ? 4 : 3)), picks = [];
    for (let tries = 0; picks.length < n && tries < 40; tries++){
      const i = Math.floor(r()*SLOTS.length);
      if (picks.every(j => Math.abs(j - i) >= 2)) picks.push(i);
    }
    for (const i of picks.sort((a, b) => a - b)){
      const time = SLOTS[i];
      const lang = r() < .5 ? movie.langs[0] : movie.langs[Math.floor(r()*movie.langs.length)];   // original language most often, dubs too
      const format = fmts[Math.floor(r()*fmts.length)];
      const layout = LAYOUTS[st.layout];
      const prices = Object.fromEntries(layout.cats.map(c => [c, priceFor(cinema, scr.type, c, dateISO, time)]));
      out.push({ id:`${movie.id}~${cinema.id}~${dateISO}~${scr.n}~${time.replace(':', '')}`, movieId:movie.id, cinemaId:cinema.id,
        date:dateISO, time, screen:scr.n, screenType:scr.type, screenLabel:`Screen ${scr.n}${scr.type !== 'standard' ? ' · ' + st.label : ''}`,
        format, lang, layoutId:st.layout, prices });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
export function showById(id){
  const [movieId, cinemaId, date, screen, t] = id.split('~');
  const m = movieById(movieId), c = m && cinemaById(cinemaId); if (!c) return null;
  return showsFor(m, c, date).find(s => s.screen === +screen && s.time.replace(':', '') === t) || null;
}
export function isPast(show){
  if (show.date !== todayISO()) return show.date < todayISO();
  const [h, m] = show.time.split(':').map(Number), now = new Date();
  return h*60 + m < now.getHours()*60 + now.getMinutes() + 15;      // booking closes 15 minutes before start
}

/* ------------------------------------------------------------------ occupancy
   Sold seats cluster in groups of 2–4 and favour the centre and the back two-thirds, like real shows. */
export function soldSeats(show, extra = []){
  const L = LAYOUTS[show.layoutId], m = movieById(show.movieId), r = rng(hash('sold|' + show.id));
  const h = +show.time.slice(0, 2), daysOut = Math.round((parseISO(show.date) - parseISO(todayISO()))/864e5);
  let fill = .18 + m.popularity*.45 + (h >= 18 && h < 22 ? .18 : h < 12 ? -.12 : 0) + (isWeekend(show.date) ? .1 : 0) - daysOut*.05;
  fill = Math.max(.04, Math.min(.86, fill + (r() - .5)*.2));
  const sold = new Set(), seats = L.seats, maxRi = L.rows.length - 1;
  const want = Math.round(seats.length*fill);
  const score = s => { const cx = Math.abs(s.x)/12, rr = s.ri/maxRi; return 1 - cx*.7 - Math.abs(rr - .68)*.6; };
  let guard = 0;
  while (sold.size < want && guard++ < 4000){
    const s = seats[Math.floor(r()*seats.length)];
    if (sold.has(s.id) || r() > score(s) + .35) continue;
    const row = L.rows[s.ri].seats, i = row.indexOf(s), g = 1 + Math.floor(r()*3.5);
    for (let k = 0; k < g && i + k < row.length; k++) sold.add(row[i + k].id);
  }
  for (const id of extra) sold.add(id);
  return sold;
}
export function availability(show, booked = []){
  const L = LAYOUTS[show.layoutId], sold = soldSeats(show, booked);
  const free = L.seats.length - sold.size, ratio = free/L.seats.length;
  return { free, total:L.seats.length, ratio, level: ratio <= 0 ? 'soldout' : ratio < .12 ? 'almost' : ratio < .35 ? 'fast' : 'open' };
}

/* ------------------------------------------------------------------ food & offers */
export const FOOD = [
  { id:'pop-salt', name:'Classic Salted Popcorn', size:'Large · 90 g', price:290, icon:'popcorn', veg:true },
  { id:'pop-caramel', name:'Caramel Popcorn', size:'Large · 110 g', price:340, icon:'popcorn', veg:true, tint:'#d99a3b' },
  { id:'nachos', name:'Cheese Nachos', size:'Regular · jalapeño dip', price:260, icon:'nachos', veg:true },
  { id:'cola', name:'Cola', size:'Large · 750 ml', price:210, icon:'cup', veg:true },
  { id:'coffee', name:'Cold Coffee', size:'Regular · 350 ml', price:230, icon:'cup', veg:true, tint:'#b07a4f' },
  { id:'combo-duo', name:'Duo Combo', size:'1 large popcorn + 2 colas', price:620, icon:'combo', veg:true, tag:'Save ₹90' },
  { id:'combo-fam', name:'Family Combo', size:'2 large popcorn + nachos + 4 colas', price:1290, icon:'combo', veg:true, tag:'Save ₹210' },
  { id:'samosa', name:'Paneer Puff', size:'2 pcs', price:180, icon:'puff', veg:true },
];
export const OFFERS = [
  { code:'FIRSTSHOW', title:'20% off your first booking', detail:'Up to ₹150 off tickets', test:() => true, value:(t) => Math.min(150, Math.round(t.tickets*.2)) },
  { code:'WEEKDAY50', title:'Flat ₹50 off on weekdays', detail:'Mon–Thu shows, 2+ tickets', test:(t) => !isWeekend(t.date) && t.count >= 2, value:() => 50 },
  { code:'COMBO100', title:'₹100 off food', detail:'When you add a combo', test:(t) => t.hasCombo, value:() => 100 },
];
export const CONVENIENCE = 30;   // per ticket, + 18% GST on the fee
export const HOLD_SECONDS = 8*60;
