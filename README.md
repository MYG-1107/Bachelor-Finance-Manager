# Bachelor Finance Manager

A local-first expense sharing and settlement application for roommates, students and shared flats.

**Live app:** https://myg-1107.github.io/Bachelor-Finance-Manager/

**Engineering and architecture:** https://myg-1107.github.io/Bachelor-Finance-Manager/developer.html

## Product boundary

The current release is a static browser-only application published with GitHub Pages. It has no application backend, API, database, login, cloud synchronization or live multi-user collaboration. Workspace data is stored in the browser's localStorage on the device/profile where it was created.

## Features

- Multiple named workspaces stored locally in one browser profile
- Add and manage roommates
- Record expenses by date, category and payer
- Choose the exact participants for each expense
- Integer-paise arithmetic and deterministic remainder allocation
- Suggested settlement transfers
- Search, month and category filters
- Filter-aware KPIs, category totals, payer contributions and balances
- Printable reports / Save as PDF
- CSV export of the current filtered expense list
- JSON backup and restore for the complete active workspace
- Responsive interface and keyboard-friendly controls
- Local-first privacy model

## Technology

- HTML5 and CSS3
- Native browser JavaScript ES modules
- Browser localStorage and file/download/print APIs
- Node.js built-in test runner (development only)
- GitHub Actions quality workflow
- GitHub Pages static hosting

There are no runtime npm dependencies.

## Run locally

Because the app uses ES modules, serve the repository through a small local web server rather than opening index.html directly with file://.

Using Python:

    python -m http.server 8000

Then open:

    http://localhost:8000/

Or use Node:

    npx serve .

## Quality checks

Requires Node.js 20+.

    npm install
    npm run check

The check command runs JavaScript syntax checks and all Node tests. Current automated tests focus on the settlement domain and CSV serialization. They are not full browser end-to-end tests.

## Repository map

    .
    ├── index.html
    ├── app.js
    ├── settlement.js                 # Backward-compatible domain entry point
    ├── src/
    │   ├── domain/settlement.js       # Pure integer-paise settlement engine
    │   └── infrastructure/csv.js      # Safe CSV serialization
    ├── architecture/
    │   ├── README.md
    │   └── diagrams/                  # System context and data-flow diagrams
    ├── styles.css
    ├── developer.html                 # Public engineering and architecture guide
    ├── privacy.html
    ├── tests/
    ├── docs/
    │   ├── architecture.md
    │   ├── data-model.md
    │   └── settlement-algorithm.md
    ├── package.json
    └── .github/workflows/quality.yml

## Important calculation and export semantics

- The dashboard computes balances and transfers from the currently filtered expenses, not always from the entire workspace.
- CSV follows the same filtered expense set.
- JSON backup exports one complete active workspace; it does not export all saved workspaces.
- Suggested transfers are calculated recommendations. The app does not execute payments.

## Privacy and data protection

Workspace records are stored in browser localStorage. Browser storage is not encrypted secure storage and may be cleared by browser settings or device loss. No server-side backup exists; users should export JSON backups for important records. See the Engineering page and privacy.html for exact scope and limitations.

## Future roadmap

Potential future work includes editing expenses, unequal splits, recurring expenses, stronger browser UI automation and optional cloud synchronization. These are not part of the current implementation.

## Contributors

- Mallarapu Yaswanth
- Puppireddy Vishwateja

## License

MIT. See LICENSE.