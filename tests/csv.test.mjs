import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, serializeCsv } from '../src/infrastructure/csv.js';

test('quotes cells containing commas, quotes and line breaks', () => {
  assert.equal(csvCell('Room, kitchen'), '"Room, kitchen"');
  assert.equal(csvCell('He said "hello"'), '"He said ""hello"""');
  assert.equal(csvCell('line 1\nline 2'), '"line 1\nline 2"');
});

test('neutralizes spreadsheet formula prefixes', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-10+20', '@SUM(A1:A2)', '  =1+1']) {
    assert.equal(csvCell(value).startsWith("'"), true);
  }
});

test('serializes rows with CRLF separators', () => {
  assert.equal(serializeCsv([['Name', 'Amount'], ['A', '10.00']]), 'Name,Amount\r\nA,10.00');
});

test('rejects malformed row collections', () => {
  assert.throws(() => serializeCsv('not rows'), TypeError);
  assert.throws(() => serializeCsv([null]), TypeError);
});
