export type GeoFence = {
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
};

// Haversine distance (meter)
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ambil jarak (meter) ke geofence terdekat.
 * Return null kalau geofences kosong.
 */
export function getDistanceM(
  lat: number,
  lng: number,
  geofences: GeoFence[]
): number | null {
  if (!geofences || geofences.length === 0) return null;

  let best: number | null = null;
  for (const g of geofences) {
    const d = haversineM(lat, lng, g.lat, g.lng);
    if (best == null || d < best) best = d;
  }
  return best;
}

/**
 * True kalau posisi berada di dalam salah satu geofence.
 */
export function isInsideAnyFence(
  lat: number,
  lng: number,
  geofences: GeoFence[]
): boolean {
  if (!geofences || geofences.length === 0) return false;

  for (const g of geofences) {
    const d = haversineM(lat, lng, g.lat, g.lng);
    if (d <= g.radiusM) return true;
  }
  return false;
}
