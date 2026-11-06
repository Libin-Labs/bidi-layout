import {
  logicalSides,
  logicalToPhysical,
  physicalToLogical,
  scanDirectionalControls,
  type Direction,
  type WritingMode,
  type PhysicalSide,
  type Layout,
  type LogicalPoint,
  type PhysicalPoint,
  type LogicalSides,
  type DirectionalReport,
  type DirectionalControl,
  type DirectionalDiagnostic,
} from '@lp-labs/bidi-layout';
const direction: Direction = 'rtl';
const writingMode: WritingMode = 'vertical-rl';
const layout: Layout = { width: 10, height: 10, direction, writingMode };
const point: PhysicalPoint = logicalToPhysical({ inline: 1, block: 2 }, layout);
const logical: LogicalPoint = physicalToLogical(point, layout);
const sides: LogicalSides = logicalSides(direction, writingMode);
const side: PhysicalSide = sides.inlineStart;
const report: DirectionalReport = scanDirectionalControls('\u202a');
const control: DirectionalControl | undefined = report.controls[0];
const diagnostic: DirectionalDiagnostic | undefined = report.diagnostics[0];
// @ts-expect-error implicit auto direction is unsupported
logicalSides('auto');
void [logical, side, control, diagnostic];
