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

```
index.html          shell, import map, header and tab bar
css/app.css         theme and all styles
js/app.js           boot and hash router
js/core.js          state, storage, icons, toast, modal, city picker, search
js/data.js          movies, cities, cinemas, seat layouts, showtimes, pricing, occupancy
js/posters.js       procedural poster and backdrop art
js/theatre.js       3D auditorium (three.js)
js/views/browse.js  home, movie, showtimes, cinemas
js/views/seats.js   seat selection page
js/views/checkout.js checkout, ticket, my tickets
```
