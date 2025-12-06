// Haversine formula untuk jarak meter antara dua koordinat
export function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GeoFence = {
  name: string;
  lat: number;
  lng: number;
  radiusM: number; // meter
};

/**
 * Cek apakah (lat,lng) berada di dalam salah satu geofence.
 * Return {ok, nearestName, nearestDistance}
 */
export function checkGeofence(
  lat: number,
  lng: number,
  fences: GeoFence[]
): { ok: boolean; nearestName?: string; nearestDistance?: number } {
  if (fences.length === 0) return { ok: true };
  let min = Number.POSITIVE_INFINITY;
  let nearest: GeoFence | undefined;
  for (const f of fences) {
    const d = distanceInMeters(lat, lng, f.lat, f.lng);
    if (d < min) {
      min = d;
      nearest = f;
    }
    if (d <= f.radiusM) {
      return { ok: true, nearestName: f.name, nearestDistance: d };
    }
  }
  return { ok: false, nearestName: nearest?.name, nearestDistance: min };
}
