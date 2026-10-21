import descriptors from './bnccLabels.json';
// Generated from the hash-verified official source by scripts/build-bncc-labels.mts.
// A curricular reference does not certify the alignment of an authored lesson.
export function bnccLabel(code: keyof typeof descriptors): string {
  return `${code}: ${descriptors[code]}`;
}
export function bnccDescription(code:keyof typeof descriptors):string{return descriptors[code];}
