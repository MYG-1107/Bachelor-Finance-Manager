# Architecture

Bachelor Finance Manager is a static, local-first web application.

```text
┌───────────────────────────────┐
│ Browser                       │
│                               │
│  index.html                   │
│       │                       │
│       ▼                       │
│  styles.css                   │
│       │                       │
│       ▼                       │
│  app.js                       │
│   │        │                  │
│   │        └──────────────┐   │
│   ▼                       ▼   │
│ settlement.js       localStorage
│                               │
└───────────────────────────────┘
```

## Responsibilities

### `index.html`
Semantic page structure, forms, tables, navigation, metadata and structured data.

### `styles.css`
Responsive design system, accessibility states, responsive tables and print styles.

### `app.js`
Application state, workspace lifecycle, event handling, persistence, rendering, export/import and filtering.

### `settlement.js`
Pure functions for money calculations and transfer generation. This file is isolated so it can be tested outside the browser.

## Storage boundary

There is intentionally no backend in this version. Each workspace is stored beneath a versioned localStorage record. Exported JSON is the portability boundary for backups and moving data to another device.

## Design principles

- Keep money calculations deterministic.
- Keep the finance engine framework-independent.
- Escape user-generated strings before injecting them into HTML.
- Avoid external runtime dependencies.
- Make data loss risks explicit to users.
- Make the UI usable on mobile and in print.
