import type { NextRequest } from "next/server";

import { buildFeed } from "@/lib/feed";
import { errorResponse, parseIds } from "@/lib/http";
import { DEFAULT_REGION } from "@/lib/tmdb";
import type { MediaType } from "@/lib/types";

// GET /api/feed?providers=8,9,337&type=all|movie|tv&page=1&genres=28,35&exclude=movie:550,tv:1399
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const providerIds = parseIds(sp.get("providers"));
  if (providerIds.length === 0) {
    return Response.json({ error: "Pass at least one provider id, e.g. ?providers=8,9" }, { status: 400 });
  }
  const type = sp.get("type") ?? "all";
  const mediaTypes: MediaType[] = type === "movie" ? ["movie"] : type === "tv" ? ["tv"] : ["movie", "tv"];
  const page = Math.min(500, Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1));
  const exclude = new Set((sp.get("exclude") ?? "").split(",").filter(Boolean));

  try {
    const feed = await buildFeed({
      providerIds,
      mediaTypes,
      page,
      region: (sp.get("region") ?? DEFAULT_REGION).toUpperCase(),
      genreIds: parseIds(sp.get("genres")),
      exclude,
    });
    return Response.json(feed);
  } catch (err) {
    return errorResponse(err);
  }
}
