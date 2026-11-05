# Reelhouse

A movie-ticket booking web app with a 3D auditorium for seat selection. It's plain HTML, CSS and ES modules, with no build step.

All films, cinemas, showtimes and prices are fictional and generated in code. The posters are painted procedurally, and payment is a mock.

## Run it

Serve the folder over HTTP. ES modules don't load from `file://`.

```sh
python3 -m http.server 8780
# open http://localhost:8780/
```

You need an internet connection for fonts (Google Fonts), three.js (jsDelivr) and the QR code library (cdnjs).

## Features

- **Browse:** city picker, a featured-films carousel, filters for language, genre and format, sorting, coming-soon titles with "Notify me", cinemas near you, and search (press `/`).
- **Movie page:** details, cast and crew, reviews and similar films. A language and format picker greys out combinations with no shows that week.
- **Showtimes:** a 7-day date strip, time-of-day, price and recliner filters, and favourite cinemas. Each time shows how full the show is and gives a price tooltip.
- **3D seat selection** (three.js):
  - A stepped, curved auditorium. The film's art plays on screen and lights the room, and sold seats have audience silhouettes in them.
  - Standard, IMAX, LUXE and 4DX layouts, with seat models for standard seats, recliners, motion seats and wheelchair spaces.
  - Tap seats to select them (up to 10), or use **Best available**.
  - **View from seat** flies the camera into a seat and rates the view.
  - **360° view** lets you look all around (drag, arrow keys, scroll or pinch to zoom), with auto-rotate and a compass pointing back at the screen.
  - A synchronised 2D seat map that works with the keyboard, and is used automatically if WebGL isn't available.
  - A rule that stops you leaving a single empty seat stranded in a row.
- **Checkout:**
  - An 8-minute seat hold.
  - Food and drinks.
  - Promo codes: `FIRSTSHOW`, `WEEKDAY50` and `COMBO100`.
  - Contact details with validation.
  - UPI, card or wallet payment (mock).
- **E-ticket:** a QR code, add to calendar (`.ics`), share, and cancellation with a refund. **My tickets** lists upcoming and past bookings.

Bookings, the chosen city, favourites and "interested" flags are stored in `localStorage`.

## Layout

Everything is in a single `index.html`:

- **`<style>`:** the theme and all styles.
- **`<script type="text/plain" id="rh-theatre">`:** the 3D auditorium (three.js). It's imported lazily as a module the first time the seat page opens.
- **`<script type="module">`:** the app, one scoped block per part, in this order:
  - `data`: movies, cities, cinemas, seat layouts, showtimes, pricing and occupancy.
  - `posters`: procedural poster and backdrop art.
  - `core`: state, storage, icons, toasts, modals, the city picker and search.
  - `browse`: the home, movie, showtimes and cinema pages.
  - `seats`: the seat selection page.
  - `checkout`: checkout, the ticket and My tickets.
  - `app`: startup and the hash router.

## Prompt to replicate this site

Paste the prompt below into an AI coding assistant to rebuild the site from scratch.

```text
Build "Reelhouse": a movie-ticket booking web app with a 3D auditorium for
seat selection. Put everything in a single index.html using plain HTML, CSS
and ES modules. Don't use a build step or a framework. Load three.js from
jsDelivr, fonts from Google Fonts, and a QR code library from cdnjs. It must
run when the folder is served with `python3 -m http.server`.

STRUCTURE (all in index.html)
- One <style> block that holds the theme as CSS custom properties and all the
  styles. Use a dark, cinematic look with a single accent colour. It must be
  responsive down to phone width.
- A <script type="text/plain" id="rh-theatre"> block that holds the three.js
  auditorium module. Import it lazily (turn the text into a Blob URL and
  import() it) the first time the seat page opens.
- One <script type="module"> holding the app, with one scoped block per part
  in this order:
  - data: movies, cities, cinemas, seat layouts, showtimes, pricing and
    occupancy.
  - posters: procedural poster and backdrop art.
  - core: state, storage, icons, toasts, modals, the city picker and search.
  - browse: the home, movie, showtimes and cinema pages.
  - seats: the seat selection page.
  - checkout: checkout, the ticket and My tickets.
  - app: startup and a hash router.

DATA
- Every film, cinema, showtime and price is fictional and generated in code
  from a seeded PRNG, so the same day always gives the same data.
- Films have a title, languages, genres, formats (2D, 3D, IMAX, 4DX), a
  certificate, runtime, rating, synopsis, cast and crew, reviews, and a palette
  for their poster. Include some coming-soon titles.
- Generate cities, each with cinemas and distances. Generate showtimes for the
  next 7 days per cinema, with a format, language, screen type and occupancy
  per show.
- Price by seat category and format.
- Draw posters and backdrops procedurally on a canvas (gradients, shapes and
  title typography from the film's palette). Don't use image files.

FEATURES
- Browse:
  - A city picker, a featured-films carousel, and filters for language, genre
    and format.
  - Sorting, coming-soon titles with a "Notify me" button, and cinemas near
    you.
  - Search that opens when you press "/".
- Movie page:
  - Details, cast and crew, reviews and similar films.
  - A language and format picker that greys out combinations with no shows
    that week.
- Showtimes:
  - A 7-day date strip, filters for time of day, price and recliners, and
    favourite cinemas.
  - Each showtime shows how full the show is and has a price tooltip.
- 3D seat selection (three.js):
  - A stepped, curved auditorium. The film's poster art plays on the screen and
    its colour lights the room. Sold seats have audience silhouettes in them.
  - Standard, IMAX, LUXE and 4DX layouts, with separate seat models for
    standard seats, recliners, motion seats and wheelchair spaces.
  - Tap seats to select up to 10, or press "Best available".
  - "View from seat" flies the camera into the chosen seat and rates the view.
  - A "360° view" mode lets you look all around by dragging, using the arrow
    keys, or scrolling or pinching to zoom. It has auto-rotate and a compass
    that points back at the screen.
  - A 2D seat map stays in sync with the 3D view and works fully with the
    keyboard. Use it automatically if WebGL isn't available.
  - Enforce a rule that stops you leaving a single empty seat stranded in a
    row.
- Checkout:
  - An 8-minute seat hold with a visible countdown.
  - Food and drinks add-ons.
  - Promo codes FIRSTSHOW, WEEKDAY50 and COMBO100.
  - Contact details with validation.
  - Mock UPI, card or wallet payment.
- E-ticket:
  - A QR code, add to calendar (generate an .ics file), share (Web Share API
    with a fallback), and cancellation with a refund.
  - A "My tickets" page that lists upcoming and past bookings.
- Persistence: save bookings, the chosen city, favourites and "interested"
  flags in localStorage.

QUALITY BAR
- Make it accessible: focus-visible styles, aria labels, a keyboard-operable
  seat map, and modals that trap focus and close with Escape.
- Respect prefers-reduced-motion.
- Use instanced meshes for seats and keep draw calls low. Dispose of the 3D
  scene when you leave the seat page.
- Use a hash router so the back and forward buttons work and every page can be
  deep-linked.
```
