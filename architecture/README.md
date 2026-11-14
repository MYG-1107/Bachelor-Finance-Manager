# Bachelor Finance Manager — architecture

## 1. Product and system boundary

Bachelor Finance Manager is a local-first shared-household expense tracker. A user creates a workspace, adds roommates, records bills, selects the people who share each bill, reviews member balances, and uses the suggested transfers to settle the selected expenses.

The current product is a **static, browser-only application** published through GitHub Pages. GitHub Pages delivers HTML, CSS, JavaScript, SVG assets and documentation. Once loaded, the application logic runs in the user's browser.

There is no application server, REST API, database server, account service, authentication, authorization, live multi-user collaboration or cloud synchronization in this version. A workspace owner is a display/business label, not an authenticated administrator. Data is isolated by the browser profile and site origin where it was created.

## 2. Runtime architecture

The runtime has five clear responsibilities:

| Layer | Current implementation | Responsibility |
|---|---|---|
| Presentation | index.html, styles.css | Landing and dashboard screens, forms, accessible controls, tables, charts, responsive layout and print presentation |
| Application orchestration | app.js | In-memory application state, event handling, input checks, workspace lifecycle, filtering, rendering, browser persistence and import/export workflows |
| Domain | src/domain/settlement.js | Deterministic money allocation, paid/owed/net calculations, settlement transfers and settlement-result validation |
| Export serialization | src/infrastructure/csv.js | CSV cell escaping, row serialization and spreadsheet-formula prefix neutralization |
| Browser platform | localStorage, FileReader, Blob, URL, window.print, confirm | Local persistence, backup reading, file downloads, printing and destructive-action confirmation |

There is intentionally no separate storage adapter module in this release: localStorage access is owned by the application layer in app.js. The CSV module serializes data, while app.js uses browser download APIs to deliver the file. JSON serialization/import, printing and file reading also remain in app.js.

The system-context and expense-flow diagrams are maintained in architecture/diagrams.

## 3. Runtime startup and request flow

### Startup

1. The browser loads index.html and styles.css. The page loads app.js as an ES module.
2. On DOMContentLoaded, app.js loads the current localStorage record.
3. If the current storage key is absent, it checks the legacy V3 key and attempts to migrate the older single-workspace shape.
4. State is normalized into the current root/workspace structure.
5. Event handlers are registered, the expense date input is set to the user's local calendar date, and the landing/dashboard is rendered.
6. The active workspace, if any, is shown. Otherwise, the workspace creation and saved-workspace screen is shown.

### Record an expense

1. The UI collects payer, category, description, date, rupee amount and selected participants.
2. app.js trims and normalizes text, parses rupees into integer paise, checks the date, verifies the payer belongs to the active workspace, and requires at least one valid participant.
3. An expense record is appended to the active workspace and the versioned state is written to localStorage.
4. renderApp refreshes the UI. The currently selected filters are applied before dashboard calculations are run.

### Calculate and render the dashboard

1. Search, month and category filters select the expense subset for the active workspace.
2. That same filtered subset is passed to computeSettlement.
3. The result supplies total expenditure, member paid amounts, share obligations, net positions and suggested transfers.
4. The application renders the expense ledger, balances, transfer list, category totals and payer-contribution bars from the filtered subset.
5. Changing a filter recomputes the dashboard; filters are in-memory UI state and are not part of the saved workspace record.

This means the dashboard's balances and suggested transfers describe the **currently filtered expenses**, not necessarily every expense in the workspace. CSV export also exports that filtered expense set. The JSON backup is different: it exports the complete active workspace.

## 4. Domain and financial rules

The domain module is deliberately independent of the DOM, localStorage, files and network. It receives normalized expense records and the active workspace's member names.

For each expense:

1. The payer receives a contribution equal to the full expense amount.
2. The expense amount is divided equally among its unique participants.
3. The base share is the integer floor of amountMinor divided by participant count.
4. Remaining paise are assigned one each to the first participants in the stored participant order. The shares therefore add up exactly to the expense.
5. For each member, net position is paid minus owed. Positive means the member should receive money; negative means the member should pay.

The engine sorts debtors and creditors by descending balance, then by member name for deterministic tie-breaking. It repeatedly transfers the smaller outstanding amount between the current debtor and creditor until both sides are settled.

The core invariants are:

- Amounts are positive safe integers in paise.
- Every payer and every participant belongs to the current workspace.
- Each expense has at least one unique participant.
- Allocated participant shares equal the expense amount exactly.
- Each member net equals paid minus owed.
- All member net positions sum to zero.
- Transfers contain positive amounts, never transfer to the same member, and settle each member's net position.

The domain function enforces the amount, payer and participant input contract and checks safe-integer totals and the zero-sum balance invariant. validateSettlement is an additional result-checking utility used by tests; the browser rendering path currently calls computeSettlement directly.

The dashboard's “Average spend / member” is a reference KPI: total amount in the filtered expense set divided by the total number of members in the workspace, rounded to the nearest paise. It is not the per-expense participant share and is not used to calculate balances or transfers.

See docs/settlement-algorithm.md for the algorithm and a worked example.

## 5. Data model and persistence

The application stores one root state object under localStorage key BFM_DATA_SESSION_V5. The root contains schema version 5, the active workspace ID and a map of workspaces. A workspace contains its ID, name, owner label, timestamps, member-name array and expense array.

An expense contains an ID, ISO calendar date, payer name, category, description, positive amountMinor integer and participant-name array. There are no separate member, category, payment, transfer or audit-log tables. Member names are the current identity keys within a workspace.

All workspaces for this site/browser profile are serialized together in the root state. Filters are not persisted. A workspace is saved after mutations such as create/open, adding/removing a member, recording/deleting an expense, clearing or deleting a workspace, importing a backup, or switching the active workspace.

### Migration and normalization

- Current state is loaded from BFM_DATA_SESSION_V5.
- If that key is absent, the application checks BFM_DATA_SESSION_V3.
- Legacy single-workspace records are mapped into the current workspace structure. Legacy DD/MM/YYYY dates are converted to YYYY-MM-DD; historical expenses are assigned the legacy member list as participants because the old shape did not retain per-expense participant sets.
- Workspace normalization trims names, removes duplicate member names, ensures the owner is present, normalizes valid expense fields and adds referenced payers/participants to the workspace member list.
- Unreadable JSON or a storage exception is caught and shown as an application message; the current page falls back to an empty in-memory state. Users should retain an exported backup.

The version field is schema metadata, not a server-side migration service. There is no automatic recovery from browser-profile loss or device changes.

See docs/data-model.md for field-level examples and migration details.

## 6. Import, export and print

| Action | Current behavior |
|---|---|
| CSV export | Exports the filtered expense rows for the active workspace: date, payer, category, description, INR amount and participants |
| JSON backup | Exports one complete active workspace with backup type, schema version and export timestamp metadata; it does not export every saved workspace |
| JSON import | Reads a selected file in the browser, normalizes its workspace, assigns a new ID, and adds it as a new workspace; duplicate names receive an Imported suffix |
| Print report | Calls the browser print dialog; print-specific CSS hides controls that should not appear on paper |
| Clear workspace | After confirmation, removes all expenses and all non-owner members from the active workspace |
| Delete workspace | After confirmation, removes that workspace from this browser's saved state |

CSV serialization neutralizes cells beginning with spreadsheet formula characters (=, +, - or @), including leading whitespace, before quoting delimiters and quotes. This reduces formula-injection risk when the CSV is opened in spreadsheet software; it is not a guarantee that every spreadsheet application will interpret every file identically.

## 7. Security, privacy and reliability

- The app does not send workspace records to an application backend because no such backend exists.
- localStorage is browser-local storage, not encrypted secure storage. Other scripts executing with the same site origin may be able to access it.
- Anyone with access to the same unlocked browser profile can potentially view or alter the saved workspace.
- There is no user login, server-side authorization, audit history, remote backup or conflict-resolution mechanism.
- Browser storage may be cleared, unavailable, full or corrupted. The application handles read/write exceptions with user-facing messages, but it cannot recover unsaved data.
- JSON backups contain household and expense data. Store exported files carefully.
- User-controlled text inserted into dynamic HTML is escaped in app.js before rendering.
- CSV formula-prefix neutralization is applied before CSV quoting.
- Destructive workspace/member/expense operations use browser confirmation dialogs where implemented.

The app is a household expense-sharing aid, not a bank, payment processor, tax tool or regulated accounting system. Suggested transfers are calculations; the app does not move money.

## 8. Quality and deployment architecture

The repository has no runtime npm dependencies. Browser code uses native JavaScript ES modules and browser APIs. Node.js 20+ is used for automated tests and syntax checks.

The GitHub Actions workflow in .github/workflows/quality.yml runs on pushes to main and refactor branches, and on pull requests targeting main. It checks JavaScript syntax and runs the Node built-in test suite. The current automated suite focuses on settlement calculations and CSV serialization.

GitHub Pages serves the static website. There is no application build, bundle, server process, database migration or backend deployment step. The quality workflow is a separate development-time pipeline; it is not part of the visitor's browser runtime.

The automated suite is not a full browser end-to-end test. Manual verification is still needed for responsive layouts, browser storage behavior, file import/download, print output and the complete UI workflow.

## 9. Current capabilities and explicit non-goals

Implemented now:
- Multiple named workspaces stored in one browser profile.
- Workspace owner label and roommate management.
- Expense creation and deletion, with per-expense participants.
- Equal splitting with deterministic remainder-paise allocation.
- Search, month and category filtering.
- Filter-aware KPIs, balances, charts and suggested transfers.
- CSV export, JSON backup/restore, and print.
- Demo workspace, responsive UI, static Engineering and Privacy pages.

Not implemented in the current code:
- Editing an existing expense.
- Unequal, percentage, weight-based or custom-value splits.
- Recurring bills, reminders, settlement confirmation or payment processing.
- User accounts, role-based permissions or real-time shared access.
- Cloud database, synchronization, server APIs or remote backup.
- A service worker/offline cache or a complete installable PWA.
- Automated browser UI/e2e tests.

These items must be treated as future work, not as present architecture. If a backend is introduced later, it should be a separate application/infrastructure adapter with explicit authentication, authorization, synchronization, conflict handling and migration design. The pure settlement domain should remain independent of browser and server technologies.

## 10. Source map

| Concern | Source of truth |
|---|---|
| Landing and dashboard structure | index.html |
| Styling, responsiveness and print rules | styles.css |
| UI state, validation, persistence, events and rendering | app.js |
| Settlement calculations | src/domain/settlement.js |
| CSV encoding | src/infrastructure/csv.js |
| Browser storage schema and migration | app.js and docs/data-model.md |
| Financial algorithm | src/domain/settlement.js and docs/settlement-algorithm.md |
| Automated checks | tests/ and .github/workflows/quality.yml |
| Public engineering explanation | developer.html |

When implementation changes, update this architecture, the relevant detailed document and the Engineering page together.