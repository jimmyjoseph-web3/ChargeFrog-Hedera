// --- Discount helper ---
export const applyDiscount = (val: number, percent: number) =>
  +(val - val * (percent / 100)).toFixed(2);
