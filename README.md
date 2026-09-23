# Bachelor Finance Manager

A local-first expense sharing and settlement application for roommates, students and shared flats.

**Live app:** https://myg-1107.github.io/Bachelor-Finance-Manager/

## Why this project?

Shared-flat spending becomes difficult when rent, groceries, power, WiFi and other bills are paid by different people. Bachelor Finance Manager turns those entries into a clear settlement plan without requiring an account or a backend.

## Features

- Workspace-based data isolation
- Add and manage roommates
- Record expenses by date, category and payer
- Choose the exact participants for each expense
- Integer paise arithmetic for deterministic money calculations
- Settlement transfer generation
- Search, month and category filters
- Spend-by-category insights
- Contribution insights
- Printable reports / Save as PDF
- CSV export
- JSON backup and restore
- Responsive and keyboard-friendly UI
- Local-first privacy model
- GitHub Actions quality checks

## Tech stack

- HTML5
- CSS3
- Modern browser JavaScript (ES modules)
- `localStorage`
- Node.js built-in test runner
- GitHub Pages
- GitHub Actions

## Run locally

Because the app uses ES modules, serve the repository through a small local web server rather than opening `index.html` directly with `file://`.

Using Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Using Node:

```bash
npx serve .
```

## Quality checks

Requires Node 20+.

```bash
npm install
npm run check
```

The project has no runtime npm dependencies.

## Repository map

```text
.
├── index.html
├── app.js
├── settlement.js
├── styles.css
├── developer.html
├── privacy.html
├── 404.html
├── favicon.svg
├── site.webmanifest
├── robots.txt
├── sitemap.xml
├── package.json
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   └── settlement-algorithm.md
├── tests/
│   └── settlement.test.mjs
└── .github/
    └── workflows/
        └── quality.yml
```

## Privacy model

The current version does not send workspace records to a backend. Data remains in browser storage on the user's device until the user exports or clears it.

This is a local-first application, not a secure accounting or banking system. Browser storage is not encrypted secure storage.

## Future roadmap

- Edit expenses
- Percentage / exact-value / share-based splits
- Recurring monthly expenses
- Optional encrypted cloud sync
- Multi-device synchronization
- PWA offline install enhancements
- Stronger automated UI tests

## Contributors

- Mallarapu Yaswanth
- Puppireddy Vishwateja

## License

MIT. See `LICENSE`.
