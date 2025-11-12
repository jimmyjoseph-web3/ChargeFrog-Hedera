/** Calculate energy produced per second (kW -> kWh per second) */
export function getKWhPerSecond(kW: number): number {
  return +(kW / 3600).toFixed(2);
}