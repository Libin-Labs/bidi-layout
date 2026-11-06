# @lp-labs/bidi-layout

Original logical-coordinate helpers and explicit directional-control diagnostics.
Independent and dependency-free. **This is not the Unicode Bidirectional Algorithm (UBA).**
It does not reorder text, determine embedding levels, shape glyphs or implement browser layout.

## Install

```bash
npm install @lp-labs/bidi-layout
```

Node >=18, ES2022 ESM/CommonJS and strict TypeScript declarations.
CommonJS: `const { logicalSides } = require('@lp-labs/bidi-layout')`.

## Quickstart

```js
import {
  logicalSides,
  logicalToPhysical,
  physicalToLogical,
  scanDirectionalControls,
} from '@lp-labs/bidi-layout';

const layout = { width: 100, height: 60, direction: 'rtl', writingMode: 'vertical-rl' };
const point = logicalToPhysical({ inline: 10, block: 20 }, layout);
if (point.x !== 80 || point.y !== 50) throw new Error('Coordinate conversion failed');
const logical = physicalToLogical(point, layout);
if (logical.inline !== 10 || logical.block !== 20) throw new Error('Inverse failed');
if (logicalSides('rtl', 'vertical-rl').inlineStart !== 'bottom') throw new Error('Side failed');
const report = scanDirectionalControls('😀\u2067x\u2069');
if (report.controls[0].offset !== 2 || report.controls[0].pairOffset !== 4) {
  throw new Error('UTF-16 control pairing failed');
}
```

## Full API and types

All four functions above are runtime exports:

- `logicalSides(direction: Direction, mode: WritingMode = 'horizontal-tb'): LogicalSides`.
- `logicalToPhysical(point: LogicalPoint, layout: Layout): PhysicalPoint`.
- `physicalToLogical(point: PhysicalPoint, layout: Layout): LogicalPoint`.
- `scanDirectionalControls(text: string): DirectionalReport`.

All types below are exported, with no runtime class or enum:

```ts
type Direction = 'ltr' | 'rtl';
type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';
type PhysicalSide = 'left' | 'right' | 'top' | 'bottom';
interface Layout {
  width: number;
  height: number;
  direction: Direction;
  writingMode: WritingMode;
}
interface LogicalPoint {
  inline: number;
  block: number;
}
interface PhysicalPoint {
  x: number;
  y: number;
}
interface LogicalSides {
  inlineStart: PhysicalSide;
  inlineEnd: PhysicalSide;
  blockStart: PhysicalSide;
  blockEnd: PhysicalSide;
}
interface DirectionalControl {
  offset: number;
  codePoint: number;
  name: string;
  kind: 'embedding' | 'isolate' | 'close' | 'mark' | 'deprecated';
  pairOffset: number | null;
}
interface DirectionalDiagnostic {
  offset: number;
  code: 'unclosed' | 'unmatched' | 'deprecated';
}
interface DirectionalReport {
  controls: DirectionalControl[];
  diagnostics: DirectionalDiagnostic[];
}
```

### Coordinate contract and customization

You explicitly choose direction, writing mode, dimensions and a consistent coordinate unit.
Physical origin is the top-left, positive x rightward and positive y downward.
Coordinates are **continuous edge distances**, not integer pixel indexes: a reversed axis
uses `size - coordinate`, never `size - 1 - coordinate`.

- Horizontal: inline uses x, block uses y from the top; RTL reverses x.
- Vertical: inline uses y; RTL reverses y. `vertical-rl` block measures from the right,
  while `vertical-lr` block measures from the left.
- Dimensions are finite nonnegative numbers, including zero. Points must lie in the
  closed rectangle, including upper edges. Fractional distances are accepted.

Coordinate functions return fresh objects without changing input objects. They do not infer
direction from text, apply transforms, scroll offsets, padding, margins or CSS inheritance.
Side mappings are the same explicit logical-axis contract, not text run visual ordering.

### Directional diagnostics

The scanner reports UTF-16 offsets, numeric Unicode code points and conventional names:
ALM, LRM, RLM; LRE, RLE, LRO, RLO, PDF; LRI, RLI, FSI, PDI;
and deprecated ISS, ASS, IAFS, AAFS, NADS, NODS (U+206A..U+206F).
Ordinary characters, including Arabic/Hebrew letters and unpaired surrogates, are preserved
conceptually and are not classified or reordered.

Pairing is a **strict lexical stack**: PDF closes only a top embedding; PDI closes only a top
isolate. A wrong-kind/empty-stack closer is `unmatched` and leaves the stack unchanged.
Remaining openers are `unclosed`; deprecated controls produce `deprecated`.
Marks do not change the stack. Paired controls point to each other's offsets; all others
have `pairOffset: null`. Controls and diagnostics are sorted by source offset.

```js
import { scanDirectionalControls } from '@lp-labs/bidi-layout';

const report = scanDirectionalControls('\u2067\u202e\u2069');
if (report.diagnostics.map((entry) => entry.code).join(',') !== 'unclosed,unclosed,unmatched') {
  throw new Error('Strict lexical diagnostic semantics changed');
}
```

This deliberately does **not** implement UBA implicit resolution, first-strong direction,
overflow levels, paragraph resets, bracket mirroring or UBA isolate recovery (where a PDI
may unwind embedded scopes). Use a full UBA implementation for display ordering.
Diagnostics are informational, not a sanitizer or a security verdict.

## Errors and bounds

Wrong types, invalid enum values and nonfinite dimensions/coordinates throw `TypeError`.
Negative dimensions or points outside layout bounds throw `RangeError`. No clamping/coercion.
Coordinate functions use O(1) time and space with ordinary JavaScript floating-point precision.

Scanner text must be a string with <=1,000,000 UTF-16 units and <=10,000 recognized controls;
overflows throw `RangeError`, wrong input type throws `TypeError`.
Scanning is O(N), diagnostic sorting O(C log C), and storage O(C), with stack <=10,000.
There is no configurable unbounded mode.

## Development

`npm ci --offline`, `npm run build`, `npm run typecheck`, `npm test`,
`npm run format`, `npm run format:check`. Offline install needs cached dev packages.
TypeScript ^5.9.3 and Prettier ^3.6.2 are dev-only; no runtime/peer dependencies.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
