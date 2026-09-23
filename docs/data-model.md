# Data model

The application stores one root object:

```json
{
  "version": 5,
  "activeWorkspaceId": "ws_...",
  "workspaces": {}
}
```

A workspace looks like:

```json
{
  "id": "ws_123",
  "name": "Green Valley Flat 4B",
  "owner": "Yaswanth",
  "createdAt": "2026-09-23T08:00:00.000Z",
  "updatedAt": "2026-09-23T08:05:00.000Z",
  "members": ["Yaswanth", "Teja", "Ravi"],
  "expenses": []
}
```

An expense looks like:

```json
{
  "id": "exp_123",
  "date": "2026-09-23",
  "payer": "Yaswanth",
  "category": "Electricity",
  "description": "Power bill",
  "amountMinor": 76000,
  "participants": ["Yaswanth", "Teja", "Ravi"]
}
```

## Why `amountMinor`?

`76000` means ₹760.00. Storing money as an integer removes binary floating-point concerns from settlement arithmetic.

## Participant semantics

The `participants` array defines who shares a particular expense. The payer is not automatically the only participant or automatically the full participant set; this keeps the model explicit.
