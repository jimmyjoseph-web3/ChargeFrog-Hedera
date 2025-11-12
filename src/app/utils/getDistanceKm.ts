export const getDistanceKm = (
  coordString: string | undefined,
  userCoords: { lat: number; lng: number } | null
) => {
  if (!userCoords || !coordString) return null;
  const [latStr, lngStr] = coordString.split(",").map((s) => s.trim());
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;

  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat - userCoords.lat);
  const dLon = toRad(lng - userCoords.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(userCoords.lat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;
};
