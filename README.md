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

## Settings (in `index.html`)

- `CONFIG.formEndpoint`: Formspree form that receives bookings
- `CONFIG.paymentLinks`: one Stripe Payment Link per lesson
- `TRAVEL`: in-person distance rules (start point, free miles, $ per mile, max miles)
- `WEEKEND_TIMES` / `WEEKDAY_TIMES`: time-of-day choices

## After changing classes in `index.html`

Rebuild the stylesheet so new Tailwind classes are included:

```sh
npm install        # first time only
npm run build:css  # writes assets/site.css
```

Commit `assets/site.css` together with `index.html`.

## Publishing an update

Change the `site-version` meta tag (and the matching `?v=` on the stylesheet link) in `index.html`
on every update. Pages that visitors already have open compare it with the published copy and
refresh themselves (or show a Refresh button if someone is mid-booking).
