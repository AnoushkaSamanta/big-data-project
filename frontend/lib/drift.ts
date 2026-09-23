/**
 * Dead-Reckoning Maritime Search Cone & Drift Utility.
 *
 * Computes forward projected positions and uncertainty search zones
 * for vessels that have gone dark (deliberately ceased broadcasting AIS).
 */

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180.0;
}

function toDegrees(radians: number): number {
  return (radians * 180.0) / Math.PI;
}

/**
 * Calculates destination point given starting coordinates, bearing, and distance.
 */
export function projectPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): [number, number] {
  const phi1 = toRadians(lat);
  const lambda1 = toRadians(lon);
  const theta = toRadians(bearingDeg);
  const delta = distanceKm / EARTH_RADIUS_KM;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  const resLat = toDegrees(phi2);
  const resLon = ((toDegrees(lambda2) + 540) % 360) - 180;
  return [Number(resLon.toFixed(5)), Number(resLat.toFixed(5))]; // [lon, lat] for GeoJSON
}

export interface DriftConeProperties {
  mmsi: number;
  origin_lat: number;
  origin_lon: number;
  projected_lat: number;
  projected_lon: number;
  distance_km: number;
  elapsed_hours: number;
  sog_knots: number;
  cog_degrees: number;
}

export interface DriftConeFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
  properties: DriftConeProperties;
}

/**
 * Computes a GeoJSON Polygon representing the tactical search cone / uncertainty zone.
 */
export function computeDriftCone(
  mmsi: number,
  lastLat: number,
  lastLon: number,
  sogKnots: number | null,
  cogDegrees: number | null,
  lastSeenIso: string,
  courseSpreadDeg: number = 30.0,
  steps: number = 20
): DriftConeFeature {
  const lastSeenMs = new Date(lastSeenIso).getTime();
  const elapsedHours = Math.max(0.05, (Date.now() - lastSeenMs) / 3600000);
  const speed = Math.max(0.5, sogKnots !== null && sogKnots !== undefined ? Number(sogKnots) : 0.5);
  const cog = cogDegrees !== null && cogDegrees !== undefined ? Number(cogDegrees) : 0;
  const distKm = Math.max(1.0, speed * 1.852 * elapsedHours);

  const ring: [number, number][] = [];

  if (speed <= 1.0 || cogDegrees === null || cogDegrees === undefined) {
    // Drifting or anchored vessel: full 360° expanding circular uncertainty zone
    const radiusKm = Math.max(2.0, distKm);
    for (let i = 0; i <= steps; i++) {
      const angle = (360.0 / steps) * i;
      ring.push(projectPoint(lastLat, lastLon, angle, radiusKm));
    }
  } else {
    // Underway vessel: directional search sector / cone radiating from last position
    ring.push([Number(lastLon.toFixed(5)), Number(lastLat.toFixed(5))]);
    const startBearing = cog - courseSpreadDeg;
    const endBearing = cog + courseSpreadDeg;

    for (let i = 0; i <= steps; i++) {
      const bearing = startBearing + ((endBearing - startBearing) / steps) * i;
      ring.push(projectPoint(lastLat, lastLon, bearing, distKm));
    }
    ring.push([Number(lastLon.toFixed(5)), Number(lastLat.toFixed(5))]);
  }

  const [projLon, projLat] = projectPoint(lastLat, lastLon, cog, distKm);

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
    properties: {
      mmsi,
      origin_lat: Number(lastLat.toFixed(5)),
      origin_lon: Number(lastLon.toFixed(5)),
      projected_lat: projLat,
      projected_lon: projLon,
      distance_km: Number(distKm.toFixed(2)),
      elapsed_hours: Number(elapsedHours.toFixed(2)),
      sog_knots: Number(speed.toFixed(1)),
      cog_degrees: Number(cog.toFixed(1)),
    },
  };
}
