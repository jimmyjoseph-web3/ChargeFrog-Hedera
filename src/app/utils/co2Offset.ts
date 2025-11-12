// utils/co2Offset.ts

/**
 * Convert EV charge in kWh to CO2 offset in kg.
 * @param kwh - Total charge in kWh
 * @returns CO2 offset in kg
 */
export function convertKwhToCo2Offset(kwh: number): number {
  const CO2_PER_KWH_KG = 0.5; // 1 kWh = 0.5 kg CO2 offset
  return kwh * CO2_PER_KWH_KG;
}
