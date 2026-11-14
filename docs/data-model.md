# Data model and persistence

## 1. Storage location

The app persists all workspaces for one site origin and browser profile in a single localStorage item:

- Key: BFM_DATA_SESSION_V5
- Schema version: 5
- Legacy key checked when the current key is absent: BFM_DATA_SESSION_V3

This is browser-local persistence. It does not synchronize between browsers, devices or people. The active filters are transient UI state and are not stored in the workspace data.

## 2. Root state

    {
      "version": 5,
      "activeWorkspaceId": "ws_example",
      "workspaces": {
        "ws_example": { "...": "workspace object" }
      }
    }

The workspaces property is a map keyed by workspace ID. activeWorkspaceId may be null when the landing screen is active or when no saved workspace is selected.

## 3. Workspace entity

    {
      "id": "ws_example",
      "name": "Green Valley Flat 4B",
      "owner": "Yaswanth",
      "createdAt": "2026-09-23T08:00:00.000Z",
      "updatedAt": "2026-09-23T08:05:00.000Z",
      "members": ["Yaswanth", "Teja", "Ravi"],
      "expenses": []
    }

Fields:
- id: generated workspace identifier.
- name: human-readable workspace name; creation/opening uses a trimmed, case-insensitive name lookup.
- owner: workspace owner label. This is not an authenticated user account or access-control role.
- createdAt / updatedAt: ISO timestamps.
- members: ordered list of unique, normalized member names. Names act as member identifiers; there is no separate member ID entity.
- expenses: ordered records belonging to this workspace.

The owner is ensured to be present in members. The owner cannot be removed through the roommate-removal action.

## 4. Expense entity

    {
      "id": "exp_example",
      "date": "2026-09-23",
      "payer": "Yaswanth",
      "category": "Electricity",
      "description": "Power bill",
      "amountMinor": 76000,
      "participants": ["Yaswanth", "Teja", "Ravi"],
      "createdAt": "2026-09-23T08:05:00.000Z"
    }

Fields:
- id: generated expense identifier.
- date: calendar date in YYYY-MM-DD form, interpreted as a local calendar date for display and filtering.
- payer: member name who paid the full expense.
- category: normalized text category. The UI offers common categories, but the data model stores the category as text.
- description: normalized expense label.
- amountMinor: positive integer number of paise. 76000 represents ₹760.00.
- participants: unique member names who share this expense. It is valid for different expenses to have different participant sets.
- createdAt: ISO timestamp used with date for stable display ordering.

There are no separate category, payment, transfer, attachment, recurring-bill or audit-log entities. Suggested transfers are calculated results, not persisted payment records.

## 5. Identity and relationships

- Workspace 1 → many members (member names).
- Workspace 1 → many expenses.
- Expense 1 → exactly one payer name.
- Expense 1 → one or more participant names.
- Payer and participant names must resolve to members of the same workspace before settlement calculation.
- A member may be the payer, a participant, both, or neither for a given expense.
- Member names are normalized for whitespace and duplicate detection. This release does not assign immutable member IDs, so renaming a member is not currently supported.

The UI blocks removal of a non-owner member while that name is referenced by any saved expense. The owner is retained when the workspace is cleared.

## 6. Money representation

All persisted money used by settlement is integer paise, not floating-point rupees. The expense form accepts rupees and converts the value to paise once. Currency display converts the integer back to INR formatting for presentation.

The settlement calculation does not use floating-point rupees. CSV export formats the integer paise as a two-decimal INR amount. JSON backup preserves amountMinor as an integer.

## 7. Read, normalize and migrate

On startup, the application reads BFM_DATA_SESSION_V5 and normalizes each workspace. If the current key is missing, it checks BFM_DATA_SESSION_V3 and converts the legacy single-workspace record.

For the legacy shape:
- the legacy room name and lead name become workspace name and owner;
- the legacy member list becomes workspace members;
- the legacy expense item becomes description;
- historical expenses receive the legacy member list as participants because the older format did not record participant-specific splits;
- DD/MM/YYYY dates are converted to YYYY-MM-DD;
- the normalized state is saved under the current V5 key.

Imported workspaces are normalized in the browser. The import path accepts the exported wrapper containing a workspace or a workspace-shaped object. It generates a fresh workspace ID and avoids overwriting an existing workspace; duplicate names are given an Imported suffix. The JSON importer is a convenience normalizer, not a signed backup verifier or a hostile-file sandbox.

## 8. Backup semantics

- JSON backup exports the complete active workspace plus a type marker, schema version and export timestamp.
- JSON backup does not export the entire root state or every saved workspace.
- JSON import adds a new workspace and makes it active; it does not merge into or replace the current workspace.
- CSV export contains the currently filtered expenses for the active workspace, not the complete set when filters are applied.
- CSV includes date, payer, category, description, rupee amount and participant names.
- Filters are not embedded in the JSON backup.

Exported files may contain names and household spending information. Users should store them securely.

## 9. Operational constraints

Browser localStorage is not encrypted secure storage and may be cleared by the user, browser settings, private-browsing lifecycle or device loss. No server-side backup or recovery service exists. If localStorage is unavailable or full, writes can fail and the app displays a warning; users should export a JSON backup regularly.

The workspace owner field is descriptive only. Anyone with access to the same unlocked browser profile can potentially access the workspace.