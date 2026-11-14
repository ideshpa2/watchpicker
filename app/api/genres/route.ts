import { errorResponse } from "@/lib/http";
import { getGenres } from "@/lib/tmdb";

// GET /api/genres  (movie + tv genres merged; these are the bandit's arms)
export async function GET() {
  try {
    return Response.json({ genres: await getGenres() });
  } catch (err) {
    return errorResponse(err);
  }
}
