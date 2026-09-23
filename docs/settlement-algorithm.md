# Settlement algorithm

The engine works in three stages.

## 1. Calculate contribution

For every expense:

```text
payer contribution += expense amount
```

## 2. Calculate obligation

For the participant set of an expense:

```text
base share = floor(expense / participant count)
remainder = expense mod participant count
```

The first `remainder` participants receive one extra paise so the full expense is allocated exactly.

## 3. Calculate net position

```text
net = paid - owed
```

Positive values are creditors. Negative values are debtors.

The engine then greedily matches the largest debtor with the largest creditor, generating transfers until both sides are exhausted.

This is deterministic, uses integer arithmetic and produces a compact settlement plan.

## Example

```text
A pays ₹900 for A, B and C.

A paid:   ₹900
B paid:     ₹0
C paid:     ₹0

Each owes: ₹300

Net:
A +₹600
B -₹300
C -₹300

Transfers:
B → A ₹300
C → A ₹300
```
