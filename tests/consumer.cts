import {
  logicalToPhysical,
  scanDirectionalControls,
  type PhysicalPoint,
} from '@lp-labs/bidi-layout';
const point: PhysicalPoint = logicalToPhysical(
  { inline: 1, block: 1 },
  {
    width: 10,
    height: 10,
    direction: 'ltr',
    writingMode: 'horizontal-tb',
  },
);
void [point, scanDirectionalControls('x')];
