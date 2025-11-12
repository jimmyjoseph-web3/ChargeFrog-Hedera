export const HBAR_TO_BOLT_RATE = 3;

export function convertHbarToBolt(hbarAmount: number): number {
  return hbarAmount * HBAR_TO_BOLT_RATE;
}
