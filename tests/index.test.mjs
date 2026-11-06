import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  logicalSides,
  logicalToPhysical,
  physicalToLogical,
  scanDirectionalControls,
} from '../dist/esm/index.js';

const layout = (direction = 'ltr', writingMode = 'horizontal-tb') => ({
  width: 100,
  height: 60,
  direction,
  writingMode,
});
test('horizontal logical sides reflect only inline direction', () => {
  assert.deepEqual(logicalSides('ltr'), {
    inlineStart: 'left',
    inlineEnd: 'right',
    blockStart: 'top',
    blockEnd: 'bottom',
  });
  assert.deepEqual(logicalSides('rtl'), {
    inlineStart: 'right',
    inlineEnd: 'left',
    blockStart: 'top',
    blockEnd: 'bottom',
  });
});
test('vertical sides distinguish block flow and inline direction', () => {
  assert.deepEqual(logicalSides('rtl', 'vertical-rl'), {
    inlineStart: 'bottom',
    inlineEnd: 'top',
    blockStart: 'right',
    blockEnd: 'left',
  });
  assert.deepEqual(logicalSides('ltr', 'vertical-lr'), {
    inlineStart: 'top',
    inlineEnd: 'bottom',
    blockStart: 'left',
    blockEnd: 'right',
  });
});
test('horizontal coordinates have continuous edge origins', () => {
  assert.deepEqual(logicalToPhysical({ inline: 25, block: 12 }, layout()), { x: 25, y: 12 });
  assert.deepEqual(logicalToPhysical({ inline: 25, block: 12 }, layout('rtl')), { x: 75, y: 12 });
});
test('vertical coordinates map block to x and inline to y', () => {
  assert.deepEqual(logicalToPhysical({ inline: 25, block: 12 }, layout('ltr', 'vertical-rl')), {
    x: 88,
    y: 25,
  });
  assert.deepEqual(logicalToPhysical({ inline: 25, block: 12 }, layout('rtl', 'vertical-lr')), {
    x: 12,
    y: 35,
  });
});
test('six-mode corner oracle matches independently specified origins', () => {
  const cases = [
    ['ltr', 'horizontal-tb', 0, 0],
    ['rtl', 'horizontal-tb', 100, 0],
    ['ltr', 'vertical-rl', 100, 0],
    ['rtl', 'vertical-rl', 100, 60],
    ['ltr', 'vertical-lr', 0, 0],
    ['rtl', 'vertical-lr', 0, 60],
  ];
  for (const [direction, mode, x, y] of cases) {
    const l = layout(direction, mode);
    assert.deepEqual(logicalToPhysical({ inline: 0, block: 0 }, l), { x, y });
    assert.deepEqual(physicalToLogical({ x, y }, l), { inline: 0, block: 0 });
  }
});
test('integer grid roundtrip across every direction and writing mode', () => {
  for (const direction of ['ltr', 'rtl'])
    for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
      const l = layout(direction, mode);
      for (let x = 0; x <= 100; x += 5)
        for (let y = 0; y <= 60; y += 3) {
          assert.deepEqual(logicalToPhysical(physicalToLogical({ x, y }, l), l), { x, y });
        }
    }
});
test('zero dimensions and closed upper edges are allowed', () => {
  const l = { ...layout('rtl'), width: 0, height: 0 };
  assert.deepEqual(logicalToPhysical({ inline: 0, block: 0 }, l), { x: 0, y: 0 });
  assert.deepEqual(physicalToLogical({ x: 100, y: 60 }, layout('rtl')), { inline: 0, block: 60 });
});
test('nonfinite negative or malformed layouts fail', () => {
  for (const patch of [
    { width: -1 },
    { height: Infinity },
    { width: NaN },
    { height: '60' },
    { direction: 'auto' },
    { writingMode: 'sideways-rl' },
  ]) {
    assert.throws(() => physicalToLogical({ x: 0, y: 0 }, { ...layout(), ...patch }));
  }
  assert.throws(() => logicalToPhysical({ inline: 0, block: 0 }, null), TypeError);
});
test('invalid side directions and modes fail explicitly', () => {
  assert.throws(() => logicalSides('auto'), TypeError);
  assert.throws(() => logicalSides('rtl', null), TypeError);
});
test('points validate finite coordinates and closed bounds', () => {
  for (const point of [null, {}, { x: NaN, y: 0 }, { x: 101, y: 0 }, { x: 0, y: -1 }])
    assert.throws(() => physicalToLogical(point, layout()));
  for (const point of [null, {}, { inline: 61, block: 0 }, { inline: 0, block: 101 }])
    assert.throws(() => logicalToPhysical(point, layout('ltr', 'vertical-rl')));
});
test('ordinary Arabic Hebrew numbers emoji and malformed surrogates are not reordered', () => {
  assert.deepEqual(scanDirectionalControls('עברית العربية 123 😀 \ud800'), {
    controls: [],
    diagnostics: [],
  });
});
test('explicit embeddings and isolates pair with UTF16 offsets', () => {
  const report = scanDirectionalControls('😀\u202babc\u202c\u2066z\u2069');
  assert.deepEqual(
    report.controls.map((c) => [c.name, c.offset, c.pairOffset]),
    [
      ['RLE', 2, 6],
      ['PDF', 6, 2],
      ['LRI', 7, 9],
      ['PDI', 9, 7],
    ],
  );
  assert.deepEqual(report.diagnostics, []);
});
test('strict nested lexical scopes pair inner first', () => {
  const report = scanDirectionalControls('\u2067\u202eX\u202c\u2069');
  assert.deepEqual(
    report.controls.map((c) => c.pairOffset),
    [4, 3, 1, 0],
  );
  assert.deepEqual(report.diagnostics, []);
});
test('cross-kind closers are diagnosed without implementing UBA recovery', () => {
  const report = scanDirectionalControls('\u2067\u202e\u2069');
  assert.deepEqual(report.diagnostics, [
    { offset: 0, code: 'unclosed' },
    { offset: 1, code: 'unclosed' },
    { offset: 2, code: 'unmatched' },
  ]);
});
test('unmatched closers and unclosed openers are sorted by source offset', () => {
  assert.deepEqual(scanDirectionalControls('\u202c\u202a').diagnostics, [
    { offset: 0, code: 'unmatched' },
    { offset: 1, code: 'unclosed' },
  ]);
});
test('directional marks never open scopes', () => {
  const report = scanDirectionalControls('\u061c\u200e\u200f');
  assert.deepEqual(
    report.controls.map((c) => [c.name, c.kind, c.pairOffset]),
    [
      ['ALM', 'mark', null],
      ['LRM', 'mark', null],
      ['RLM', 'mark', null],
    ],
  );
  assert.deepEqual(report.diagnostics, []);
});
test('six deprecated directional controls are explicitly reported', () => {
  const report = scanDirectionalControls('\u206a\u206b\u206c\u206d\u206e\u206f');
  assert.equal(report.controls.length, 6);
  assert.ok(report.diagnostics.every((d) => d.code === 'deprecated'));
});
test('scanner rejects malformed container and exact capacity overflow', () => {
  assert.throws(() => scanDirectionalControls(123), TypeError);
  assert.throws(() => scanDirectionalControls('a'.repeat(1_000_001)), RangeError);
  assert.equal(scanDirectionalControls('a'.repeat(1_000_000)).controls.length, 0);
  assert.equal(scanDirectionalControls('\u200e'.repeat(10_000)).controls.length, 10_000);
  assert.throws(() => scanDirectionalControls('\u200e'.repeat(10_001)), RangeError);
});
test('detached side and diagnostic results cannot affect later calls', () => {
  const sides = logicalSides('ltr');
  sides.inlineStart = 'right';
  const report = scanDirectionalControls('\u202a\u202c');
  report.controls[0].name = 'changed';
  assert.equal(logicalSides('ltr').inlineStart, 'left');
  assert.equal(scanDirectionalControls('\u202a\u202c').controls[0].name, 'LRE');
});
test('CommonJS exports and coordinate semantics match ESM', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(
    Object.keys(cjs).sort(),
    ['logicalSides', 'logicalToPhysical', 'physicalToLogical', 'scanDirectionalControls'].sort(),
  );
  assert.deepEqual(cjs.physicalToLogical({ x: 80, y: 10 }, layout('rtl')), {
    inline: 20,
    block: 10,
  });
});
