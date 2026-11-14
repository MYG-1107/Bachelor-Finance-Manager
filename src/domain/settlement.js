/**
 * Shared-expense settlement domain service.
 *
 * Pure deterministic calculations. Amounts are integer paise (INR minor units).
 * This module has no browser, storage, or UI dependencies.
 */

const isSafePositiveInteger = value => Number.isSafeInteger(value) && value > 0;

export function computeSettlement(expenses, members) {
  const safeMembers = Array.isArray(members)
    ? [...new Set(members.filter(member => typeof member === 'string' && member.trim()))]
    : [];
  const memberSet = new Set(safeMembers);
  const paid = Object.fromEntries(safeMembers.map(member => [member, 0]));
  const owed = Object.fromEntries(safeMembers.map(member => [member, 0]));
  let totalMinor = 0;

  for (const expense of Array.isArray(expenses) ? expenses : []) {
    const amountMinor = Number(expense?.amountMinor);
    if (!isSafePositiveInteger(amountMinor)) continue;

    totalMinor += amountMinor;
    if (!Number.isSafeInteger(totalMinor)) {
      throw new RangeError('Expense total exceeds the safe integer range.');
    }

    if (memberSet.has(expense.payer)) {
      paid[expense.payer] += amountMinor;
      if (!Number.isSafeInteger(paid[expense.payer])) {
        throw new RangeError('A member contribution exceeds the safe integer range.');
      }
    }

    const participants = [...new Set(
      (Array.isArray(expense.participants) ? expense.participants : [])
        .filter(member => memberSet.has(member))
    )];

    if (participants.length === 0) {
      throw new RangeError('Every valid expense must have at least one known participant.');
    }

    const baseShare = Math.floor(amountMinor / participants.length);
    const remainder = amountMinor % participants.length;

    participants.forEach((member, index) => {
      owed[member] += baseShare + (index < remainder ? 1 : 0);
      if (!Number.isSafeInteger(owed[member])) {
        throw new RangeError('A member obligation exceeds the safe integer range.');
      }
    });
  }

  const net = Object.fromEntries(
    safeMembers.map(member => [member, paid[member] - owed[member]])
  );
  const netTotal = Object.values(net).reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(netTotal) || netTotal !== 0) {
    throw new Error('Settlement invariant failed: member net balances must sum to zero.');
  }

  const debtors = safeMembers
    .filter(member => net[member] < 0)
    .map(name => ({ name, amount: Math.abs(net[name]) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

  const creditors = safeMembers
    .filter(member => net[member] > 0)
    .map(name => ({ name, amount: net[name] }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.amount, creditor.amount);

    if (!isSafePositiveInteger(amountMinor) || debtor.name === creditor.name) {
      throw new Error('Settlement invariant failed: invalid transfer generated.');
    }

    transfers.push({ from: debtor.name, to: creditor.name, amountMinor });
    debtor.amount -= amountMinor;
    creditor.amount -= amountMinor;

    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }

  return {
    totalMinor,
    averageShareMinor: safeMembers.length ? Math.round(totalMinor / safeMembers.length) : 0,
    paid,
    owed,
    net,
    transfers
  };
}

export function validateSettlement(result) {
  if (!result || typeof result !== 'object' || !result.net || !Array.isArray(result.transfers)) {
    return false;
  }

  const members = Object.keys(result.net);
  if (!members.every(member => Number.isSafeInteger(result.net[member]))) return false;

  const outgoing = Object.fromEntries(members.map(member => [member, 0]));
  const incoming = Object.fromEntries(members.map(member => [member, 0]));

  for (const transfer of result.transfers) {
    if (!transfer || !members.includes(transfer.from) || !members.includes(transfer.to)
      || transfer.from === transfer.to || !isSafePositiveInteger(transfer.amountMinor)) {
      return false;
    }
    outgoing[transfer.from] += transfer.amountMinor;
    incoming[transfer.to] += transfer.amountMinor;
  }

  const netTotal = members.reduce((sum, member) => sum + result.net[member], 0);
  if (!Number.isSafeInteger(netTotal) || netTotal !== 0) return false;

  return members.every(member =>
    Number.isSafeInteger(outgoing[member])
    && Number.isSafeInteger(incoming[member])
    && outgoing[member] - incoming[member] === -result.net[member]
  );
}
