import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSettlement, validateSettlement } from '../settlement.js';

const members = ['A', 'B', 'C', 'D'];

function totalTransferred(result) {
  return result.transfers.reduce((sum, item) => sum + item.amountMinor, 0);
}

test('equal paid contributions produce no transfer', () => {
  const result = computeSettlement([
    { payer: 'A', amountMinor: 10000, participants: members },
    { payer: 'B', amountMinor: 10000, participants: members },
    { payer: 'C', amountMinor: 10000, participants: members },
    { payer: 'D', amountMinor: 10000, participants: members }
  ], members);
  assert.equal(result.totalMinor, 40000);
  assert.equal(result.averageShareMinor, 10000);
  assert.deepEqual(result.transfers, []);
});

test('one payer for four people creates three transfers', () => {
  const result = computeSettlement([
    { payer: 'A', amountMinor: 40000, participants: members }
  ], members);
  assert.equal(result.net.A, 30000);
  assert.equal(result.net.B, -10000);
  assert.equal(result.net.C, -10000);
  assert.equal(result.net.D, -10000);
  assert.equal(totalTransferred(result), 30000);
  assert.equal(validateSettlement(result), true);
});

test('expense can have a subset of participants', () => {
  const result = computeSettlement([
    { payer: 'A', amountMinor: 30000, participants: ['A', 'B', 'C'] }
  ], members);
  assert.equal(result.owed.A, 10000);
  assert.equal(result.owed.B, 10000);
  assert.equal(result.owed.C, 10000);
  assert.equal(result.owed.D, 0);
  assert.equal(result.net.A, 20000);
  assert.equal(result.net.B, -10000);
  assert.equal(result.net.C, -10000);
  assert.equal(result.net.D, 0);
  assert.equal(totalTransferred(result), 20000);
});

test('paise remainder is distributed deterministically', () => {
  const result = computeSettlement([
    { payer: 'A', amountMinor: 100, participants: ['A', 'B', 'C'] }
  ], ['A', 'B', 'C']);
  assert.deepEqual(result.owed, { A: 34, B: 33, C: 33 });
  assert.equal(result.net.A, 66);
  assert.equal(result.net.B, -33);
  assert.equal(result.net.C, -33);
});

test('multiple expenses net together correctly', () => {
  const result = computeSettlement([
    { payer: 'A', amountMinor: 180000, participants: members },
    { payer: 'B', amountMinor: 42500, participants: members },
    { payer: 'C', amountMinor: 7600, participants: members }
  ], members);
  assert.equal(result.totalMinor, 230100);
  assert.equal(result.averageShareMinor, 57525);
  assert.equal(validateSettlement(result), true);
  assert.equal(totalTransferred(result), Math.max(...Object.values(result.net)));
});
