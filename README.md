# Boston Drumming Co. — booking site

Live site: https://hihiimheres.github.io/Chicago-drumline-prep/ (GitHub Pages, served from `main`).

## What's here

| Path | What it is |
|---|---|
| `index.html` | The whole site: layout, booking form and its script |
| `assets/site.css` | Tailwind styles built from `index.html` (don't edit by hand) |
| `src/tailwind.css`, `tailwind.config.js`, `package.json` | Tailwind build setup |
| `brand/` | Logo files, social media images and videos |
| `og-image.png` | Link-preview image |
| `assets/fonts/` | The site's fonts, served from this site (SIL Open Font License, licenses included) |
| `404.html` | "Page not found" page GitHub Pages shows for missing addresses |
| `site.webmanifest` | Name and icons for "Add to Home Screen" |
| `sitemap.xml` | Submit in Google Search Console to get indexed faster |
| `version.txt` | Current site version, read by open pages to know when to refresh |
| `google-sheet/` | Script + setup guide that saves bookings to a Google Sheet, adds confirmed lessons to Google Calendar and emails students |

## Settings (in `index.html`)

- `CONFIG.formEndpoint`: Formspree form that receives bookings
- `CONFIG.sheetEndpoint`: Google Sheet web address (see `google-sheet/SETUP.md`); empty = off
- `CONFIG.paymentLinks`: one Stripe Payment Link per lesson and weekly plan
- `CONFIG.travelFeeLinks`: Stripe links for an in-person lesson plus a $1–$5 travel fee
- `formats`: lesson lengths and prices shown on the site (keep in step with the Stripe links)
- `TRAVEL`: in-person distance rules (start point, free miles, $ per mile, max miles: now 15)
- `HOURS`: lesson hours on weekdays and weekends
- `REVIEWS`: approved student reviews shown on the site

The booking Sheet's own settings (emails, signature, reminders, calendar colours) are described in `google-sheet/SETUP.md`.

## After changing classes in `index.html`

Rebuild the stylesheet so new Tailwind classes are included:

```sh
npm install        # first time only
npm run build:css  # writes assets/site.css
```

Commit `assets/site.css` together with `index.html`.

## Publishing an update

Change the `site-version` meta tag (and the matching `?v=` on the stylesheet link) in `index.html`
on every update, and put the same value in `version.txt`. Pages that visitors already have open compare it with the published copy and
refresh themselves (or show a Refresh button if someone is mid-booking).
