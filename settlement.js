/**
 * Bachelor Finance Manager - deterministic settlement engine.
 * Money is represented in integer paise (minor units).
 */

export function computeSettlement(expenses, members) {
  const safeMembers = Array.isArray(members) ? [...new Set(members)] : [];
  const paid = Object.fromEntries(safeMembers.map(member => [member, 0]));
  const owed = Object.fromEntries(safeMembers.map(member => [member, 0]));

  let total = 0;

  for (const expense of Array.isArray(expenses) ? expenses : []) {
    const amount = Number(expense.amountMinor);
    if (!Number.isInteger(amount) || amount <= 0) continue;

    total += amount;

    if (Object.prototype.hasOwnProperty.call(paid, expense.payer)) {
      paid[expense.payer] += amount;
    }

    const participants = [...new Set(Array.isArray(expense.participants) ? expense.participants : [])]
      .filter(member => Object.prototype.hasOwnProperty.call(owed, member));

    if (participants.length === 0) continue;

    const base = Math.floor(amount / participants.length);
    const remainder = amount % participants.length;

    participants.forEach((member, index) => {
      owed[member] += base + (index < remainder ? 1 : 0);
    });
  }

  const net = Object.fromEntries(
    safeMembers.map(member => [member, paid[member] - owed[member]])
  );

  const debtors = safeMembers
    .filter(member => net[member] < 0)
    .map(member => ({ name: member, amount: Math.abs(net[member]) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

  const creditors = safeMembers
    .filter(member => net[member] > 0)
    .map(member => ({ name: member, amount: net[member] }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    if (amount > 0) {
      transfers.push({
        from: debtors[debtorIndex].name,
        to: creditors[creditorIndex].name,
        amountMinor: amount
      });
    }

    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;

    if (debtors[debtorIndex].amount === 0) debtorIndex += 1;
    if (creditors[creditorIndex].amount === 0) creditorIndex += 1;
  }

  return {
    totalMinor: total,
    averageShareMinor: safeMembers.length ? Math.round(total / safeMembers.length) : 0,
    paid,
    owed,
    net,
    transfers
  };
}

export function validateSettlement(result) {
  const netSum = Object.values(result.net).reduce((sum, value) => sum + value, 0);
  const transferOut = result.transfers.reduce((sum, transfer) => sum + transfer.amountMinor, 0);
  return netSum === 0 && transferOut === Math.max(0, Object.values(result.net).filter(v => v > 0).reduce((sum, v) => sum + v, 0));
}
