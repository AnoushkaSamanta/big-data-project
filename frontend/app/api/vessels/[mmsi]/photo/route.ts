import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// In-memory cache for fast sub-millisecond retrieval
const photoCache = new Map<
  number,
  { mmsi: number; photo_url: string | null; vessel_name: string | null; is_real_photo: boolean }
>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mmsi: string }> }
) {
  const { mmsi } = await params;
  const mmsiNum = parseInt(mmsi, 10);

  if (!mmsiNum || isNaN(mmsiNum)) {
    return NextResponse.json({ error: "Invalid MMSI" }, { status: 400 });
  }

  // 1. Check in-memory cache
  if (photoCache.has(mmsiNum)) {
    return NextResponse.json(photoCache.get(mmsiNum));
  }

  try {
    // 2. Fetch live registry metadata from VesselFinder
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://www.vesselfinder.com/vessels?name=${mmsiNum}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const fallback = { mmsi: mmsiNum, photo_url: null, vessel_name: null, is_real_photo: false };
      photoCache.set(mmsiNum, fallback);
      return NextResponse.json(fallback);
    }

    const html = await res.text();
    // Parse real spotter photo and vessel name from HTML
    const match = html.match(/<img[^>]+alt=\"([^\"]+)\"[^>]+data-src=\"([^\"]+)\"/i);

    let photoUrl: string | null = null;
    let vesselName: string | null = null;
    let isRealPhoto = false;

    if (match) {
      const rawName = match[1].trim();
      const rawPhoto = match[2].trim();

      if (
        rawName &&
        !rawName.toLowerCase().includes("vesselfinder") &&
        !rawName.toLowerCase().includes("placeholder")
      ) {
        vesselName = rawName;
      }

      // Check if it's an actual ship spotter photograph
      if (rawPhoto.includes("ship-photo")) {
        photoUrl = rawPhoto;
        isRealPhoto = true;
      }
    }

    // If we discovered a new vessel name, update Postgres hot store asynchronously
    if (vesselName) {
      pool
        .query(
          `UPDATE vessel_latest_state SET vessel_name = $1 WHERE mmsi = $2 AND (vessel_name IS NULL OR vessel_name = '')`,
          [vesselName, mmsiNum]
        )
        .catch(() => {});
    }

    const result = {
      mmsi: mmsiNum,
      photo_url: photoUrl,
      vessel_name: vesselName,
      is_real_photo: isRealPhoto,
    };

    photoCache.set(mmsiNum, result);
    return NextResponse.json(result);
  } catch (err: any) {
    const fallback = { mmsi: mmsiNum, photo_url: null, vessel_name: null, is_real_photo: false };
    photoCache.set(mmsiNum, fallback);
    return NextResponse.json(fallback);
  }
}
