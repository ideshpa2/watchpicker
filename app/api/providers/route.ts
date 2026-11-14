import type { NextRequest } from "next/server";

import { errorResponse } from "@/lib/http";
import { DEFAULT_REGION, getProviders, JUSTWATCH_ATTRIBUTION } from "@/lib/tmdb";

// GET /api/providers?region=US&limit=30
export async function GET(req: NextRequest) {
  const region = (req.nextUrl.searchParams.get("region") ?? DEFAULT_REGION).toUpperCase();
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);
  try {
    const providers = await getProviders(region);
    return Response.json({ providers: providers.slice(0, limit > 0 ? limit : undefined), attribution: JUSTWATCH_ATTRIBUTION });
  } catch (err) {
    return errorResponse(err);
  }
}
