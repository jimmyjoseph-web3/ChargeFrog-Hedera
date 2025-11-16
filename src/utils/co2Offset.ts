// utils/co2Offset.ts

/**
 * Convert EV charge in kWh to CO2 offset in **grams**.
 * @param kwh - Total charge in kWh
 * @returns CO2 offset in grams
 */
export function convertKwhToCo2Offset(kwh: number): number {
  const CO2_PER_KWH_KG = 0.5; // 1 kWh = 0.5 kg offset
  const grams = CO2_PER_KWH_KG * 1000; // convert kg to grams
  return kwh * grams;
}
