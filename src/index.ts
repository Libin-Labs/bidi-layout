export type Direction = 'ltr' | 'rtl';
export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';
export type PhysicalSide = 'left' | 'right' | 'top' | 'bottom';
export interface Layout {
  width: number;
  height: number;
  direction: Direction;
  writingMode: WritingMode;
}
export interface LogicalPoint {
  inline: number;
  block: number;
}
export interface PhysicalPoint {
  x: number;
  y: number;
}
export interface LogicalSides {
  inlineStart: PhysicalSide;
  inlineEnd: PhysicalSide;
  blockStart: PhysicalSide;
  blockEnd: PhysicalSide;
}
export interface DirectionalControl {
  offset: number;
  codePoint: number;
  name: string;
  kind: 'embedding' | 'isolate' | 'close' | 'mark' | 'deprecated';
  pairOffset: number | null;
}
export interface DirectionalDiagnostic {
  offset: number;
  code: 'unclosed' | 'unmatched' | 'deprecated';
}
export interface DirectionalReport {
  controls: DirectionalControl[];
  diagnostics: DirectionalDiagnostic[];
}
function finite(value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError('Expected finite number.');
}
function config(layout: Layout): void {
  if (!layout || typeof layout !== 'object') throw new TypeError('Expected layout.');
  finite(layout.width);
  finite(layout.height);
  if (layout.width < 0 || layout.height < 0) throw new RangeError('Dimensions cannot be negative.');
  sides(layout.direction, layout.writingMode);
}
function sides(direction: Direction, mode: WritingMode): LogicalSides {
  if (direction !== 'ltr' && direction !== 'rtl') throw new TypeError('Unknown direction.');
  if (!['horizontal-tb', 'vertical-rl', 'vertical-lr'].includes(mode))
    throw new TypeError('Unknown writing mode.');
  const reverse = direction === 'rtl';
  return mode === 'horizontal-tb'
    ? {
        inlineStart: reverse ? 'right' : 'left',
        inlineEnd: reverse ? 'left' : 'right',
        blockStart: 'top',
        blockEnd: 'bottom',
      }
    : {
        inlineStart: reverse ? 'bottom' : 'top',
        inlineEnd: reverse ? 'top' : 'bottom',
        blockStart: mode === 'vertical-rl' ? 'right' : 'left',
        blockEnd: mode === 'vertical-rl' ? 'left' : 'right',
      };
}
export function logicalSides(
  direction: Direction,
  mode: WritingMode = 'horizontal-tb',
): LogicalSides {
  return sides(direction, mode);
}
export function logicalToPhysical(point: LogicalPoint, layout: Layout): PhysicalPoint {
  config(layout);
  if (!point || typeof point !== 'object') throw new TypeError('Expected point.');
  finite(point.inline);
  finite(point.block);
  const vertical = layout.writingMode !== 'horizontal-tb';
  const inlineSize = vertical ? layout.height : layout.width;
  const blockSize = vertical ? layout.width : layout.height;
  if (point.inline < 0 || point.inline > inlineSize || point.block < 0 || point.block > blockSize)
    throw new RangeError('Point outside closed layout bounds.');
  const inline = layout.direction === 'rtl' ? inlineSize - point.inline : point.inline;
  return vertical
    ? {
        x: layout.writingMode === 'vertical-rl' ? layout.width - point.block : point.block,
        y: inline,
      }
    : { x: inline, y: point.block };
}
export function physicalToLogical(point: PhysicalPoint, layout: Layout): LogicalPoint {
  config(layout);
  if (!point || typeof point !== 'object') throw new TypeError('Expected point.');
  finite(point.x);
  finite(point.y);
  if (point.x < 0 || point.x > layout.width || point.y < 0 || point.y > layout.height)
    throw new RangeError('Point outside closed layout bounds.');
  const vertical = layout.writingMode !== 'horizontal-tb';
  const inline = vertical ? point.y : point.x;
  return {
    inline:
      layout.direction === 'rtl' ? (vertical ? layout.height : layout.width) - inline : inline,
    block: vertical
      ? layout.writingMode === 'vertical-rl'
        ? layout.width - point.x
        : point.x
      : point.y,
  };
}
const controls = new Map<number, [string, DirectionalControl['kind']]>([
  [0x061c, ['ALM', 'mark']],
  [0x200e, ['LRM', 'mark']],
  [0x200f, ['RLM', 'mark']],
  [0x202a, ['LRE', 'embedding']],
  [0x202b, ['RLE', 'embedding']],
  [0x202c, ['PDF', 'close']],
  [0x202d, ['LRO', 'embedding']],
  [0x202e, ['RLO', 'embedding']],
  [0x2066, ['LRI', 'isolate']],
  [0x2067, ['RLI', 'isolate']],
  [0x2068, ['FSI', 'isolate']],
  [0x2069, ['PDI', 'close']],
  [0x206a, ['ISS', 'deprecated']],
  [0x206b, ['ASS', 'deprecated']],
  [0x206c, ['IAFS', 'deprecated']],
  [0x206d, ['AAFS', 'deprecated']],
  [0x206e, ['NADS', 'deprecated']],
  [0x206f, ['NODS', 'deprecated']],
]);
export function scanDirectionalControls(text: string): DirectionalReport {
  if (typeof text !== 'string') throw new TypeError('Expected text.');
  if (text.length > 1_000_000) throw new RangeError('Text exceeds 1000000 UTF-16 units.');
  const report: DirectionalReport = { controls: [], diagnostics: [] };
  const stack: DirectionalControl[] = [];
  let offset = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0)!;
    const definition = controls.get(codePoint);
    if (definition) {
      if (report.controls.length === 10_000) throw new RangeError('Control count exceeds 10000.');
      const [name, kind] = definition;
      const control: DirectionalControl = { offset, codePoint, name, kind, pairOffset: null };
      report.controls.push(control);
      if (kind === 'embedding' || kind === 'isolate') stack.push(control);
      else if (kind === 'deprecated') report.diagnostics.push({ offset, code: 'deprecated' });
      else if (kind === 'close') {
        const expected = name === 'PDF' ? 'embedding' : 'isolate';
        const top = stack[stack.length - 1];
        if (top?.kind === expected) {
          stack.pop();
          top.pairOffset = offset;
          control.pairOffset = top.offset;
        } else report.diagnostics.push({ offset, code: 'unmatched' });
      }
    }
    offset += char.length;
  }
  for (const control of stack)
    report.diagnostics.push({ offset: control.offset, code: 'unclosed' });
  report.diagnostics.sort((a, b) => a.offset - b.offset);
  return report;
}
