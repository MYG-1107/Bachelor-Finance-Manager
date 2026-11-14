# Settlement algorithm

## 1. Inputs and contract

The domain function receives:
- an array of normalized expenses for the period currently selected in the dashboard;
- the member-name list for the active workspace.

Each expense must contain a positive safe integer amountMinor, a payer who is a member of the workspace and a non-empty participant array whose names are all workspace members. Duplicate participant names are removed before calculation.

The function is pure: it does not read the DOM, localStorage, files, current time or network resources. It returns a result and does not mutate the input expenses or member list.

## 2. Paid contribution

For every expense, the payer receives credit for the full amount:

    paid[payer] += amountMinor

The payer may also be one of the participants. Paying and sharing are separate facts.

## 3. Participant obligation

For each expense, split the integer amount over the unique participants:

    baseShare = floor(amountMinor / participantCount)
    remainder = amountMinor mod participantCount

Each participant is assigned baseShare. The first remainder participants in the stored participant order receive one additional paise.

Example: ₹1.00 split between A, B and C is 100 paise. The allocation is A = 34 paise, B = 33 paise and C = 33 paise. The order makes the rounding rule deterministic, and the allocated shares sum to exactly 100 paise.

## 4. Net position

For each workspace member:

    net[member] = paid[member] - owed[member]

- net > 0: creditor; the member should receive money.
- net < 0: debtor; the member should pay money.
- net = 0: balanced for the selected expense set.

Because every expense is fully allocated to participants and fully credited to its payer, total paid equals total owed. Therefore all member net positions must sum to zero.

## 5. Transfer generation

The engine creates two sorted lists:
- debtors sorted by descending amount, then member name;
- creditors sorted by descending amount, then member name.

It repeatedly pairs the current debtor with the current creditor and transfers the smaller outstanding amount:

    transfer = min(debtorOutstanding, creditorOutstanding)

The matched amount is subtracted from both balances. When either reaches zero, that list advances. The loop ends when all debtor and creditor balances are exhausted.

This is deterministic and produces a compact valid settlement plan. It is one valid plan among potentially many equivalent plans; it does not model personal preferences, payment methods, bank transfers or whether a transfer was actually completed.

## 6. Result structure

The result contains:
- totalMinor: total amount in the calculation set;
- averageShareMinor: rounded total divided by the number of workspace members; this is a reference KPI only;
- paid: total amounts each member paid;
- owed: total allocated obligations per member;
- net: paid minus owed for each member;
- transfers: records with from, to and amountMinor.

The UI converts paise to INR-formatted text only when displaying values.

## 7. Invariants and validation

The implementation checks safe integer totals and member accumulators, rejects invalid expense amounts, unknown payers, missing participants and participants outside the workspace, checks that net balances sum to zero, and guards against invalid transfer records.

validateSettlement is a separate result validator. It checks that every transfer refers to distinct known members, uses a positive safe integer, and that incoming/outgoing totals exactly reconcile with the net positions. Automated tests use it to verify generated results and detect altered transfer lists.

## 8. Dashboard filter semantics

The dashboard runs the engine against filteredExpenses(), not the entire workspace expense list. Search examines description, payer, category and participant names. Month filtering matches the YYYY-MM prefix, and category filtering matches the selected category.

Consequently, total expenditure, paid/owed/net balances, charts and suggested transfers all refer to the current filter selection. The CSV export uses the same filtered expense list. JSON backup exports the complete active workspace instead.

## 9. Worked example

A pays ₹900 for A, B and C.

    Paid:
      A = ₹900
      B = ₹0
      C = ₹0

    Owed:
      A = ₹300
      B = ₹300
      C = ₹300

    Net:
      A = +₹600
      B = -₹300
      C = -₹300

    Transfers:
      B → A ₹300
      C → A ₹300

The sum of net positions is zero, and outgoing transfers from each debtor exactly match the absolute value of that debtor's net balance.