# Architecture overview

Bachelor Finance Manager is a local-first shared-living expense application. It helps a household record shared bills, define the participants for each expense, understand member balances, and produce a minimal settlement transfer plan.

## Current architecture

The project is intentionally dependency-light and deployed as static files through GitHub Pages.

```text
Browser
  ├── index.html / styles.css             Presentation
  ├── app.js                              Application orchestration and UI state
  ├── src/domain/settlement.js            Pure finance and settlement rules
  ├── src/infrastructure/csv.js           Safe CSV serialization
  └── localStorage                       Versioned local workspace persistence

Tests
  ├── tests/settlement.test.mjs           Domain invariants and edge cases
  └── tests/csv.test.mjs                  Export safety and formatting
```

## Boundaries

- **Presentation:** HTML and CSS own semantic structure, responsive layout, and accessible controls.
- **Application:** `app.js` coordinates forms, events, filters, rendering, imports, exports, and workspace lifecycle.
- **Domain:** `src/domain/settlement.js` is a pure module. It has no DOM, storage, or network dependency.
- **Infrastructure:** `src/infrastructure/csv.js` owns CSV encoding and spreadsheet formula neutralization. Browser persistence remains behind the application boundary in this static release.
- **Persistence:** workspace records remain in browser `localStorage`. There is no server, account system, or cross-device sync.

## Financial invariants

1. All monetary values are integer paise, never floating-point rupees.
2. Every valid expense must have at least one participant from its workspace.
3. Participant shares must add up exactly to the expense amount, including remainder paise.
4. A member's net position is paid minus owed.
5. The sum of all member net positions must be zero.
6. Generated transfers must settle every debtor and creditor exactly.

## Data protection

This release is a local-first utility, not a bank or regulated accounting product. Browser storage is not encrypted secure storage. Users should export JSON backups before clearing browser data or changing devices. Imported values are normalized before being added to a workspace.

## Future evolution

A backend, authentication, shared multi-device workspaces, recurring bills, and role-based access are intentionally not implied by the current product. If introduced later, add them as separate application and infrastructure adapters; do not put network or persistence concerns into the settlement domain.
