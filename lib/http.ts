import "server-only";

import { TmdbError } from "./tmdb";

export function errorResponse(err: unknown): Response {
  if (err instanceof TmdbError) {
    const status = err.status === 401 ? 502 : err.status >= 400 && err.status < 600 ? err.status : 502;
    return Response.json({ error: err.message }, { status });
  }
  console.error(err);
  return Response.json({ error: "Unexpected error" }, { status: 500 });
}

export function parseIds(v: string | null): number[] {
  if (!v) return [];
  return v
    .split(/[,|]/)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}
