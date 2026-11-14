import "server-only";

import type { FeedItem, Genre, MediaType, Provider } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";
export const DEFAULT_REGION = "US";
export const JUSTWATCH_ATTRIBUTION = "Streaming availability data provided by JustWatch via TMDB.";

export class TmdbError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new TmdbError("TMDB_API_KEY is not set. Copy .env.local.example to .env.local.", 500);
  return key;
}

/**
 * Fetch from TMDB. Accepts either a v3 API key (sent as ?api_key=) or a
 * v4 read access token (a JWT starting with "eyJ", sent as a Bearer header).
 */
export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  revalidate = 60 * 60,
): Promise<T> {
  const key = apiKey();
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: HeadersInit = { accept: "application/json" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);

  const res = await fetch(url, { headers, next: { revalidate } });
  if (!res.ok) {
    throw new TmdbError(`TMDB ${path} failed: ${res.status} ${res.statusText}`, res.status);
  }
  return (await res.json()) as T;
}

const img = (path: string | null | undefined, size: string) => (path ? `${IMG_BASE}/${size}${path}` : null);

/* ---------- Providers ---------- */

interface RawProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
  display_priorities?: Record<string, number>;
}

const toProvider = (p: RawProvider, region: string): Provider => ({
  id: p.provider_id,
  name: p.provider_name,
  logoUrl: img(p.logo_path, "w92"),
  priority: p.display_priorities?.[region] ?? p.display_priority ?? 999,
});

/** Streaming services available in a region, merged across movie + tv, sorted by popularity. */
export async function getProviders(region = DEFAULT_REGION): Promise<Provider[]> {
  const [movie, tv] = await Promise.all(
    (["movie", "tv"] as const).map((t) =>
      tmdbFetch<{ results: RawProvider[] }>(`/watch/providers/${t}`, { watch_region: region }, 24 * 60 * 60),
    ),
  );
  const byId = new Map<number, Provider>();
  for (const p of [...movie.results, ...tv.results]) {
    const prov = toProvider(p, region);
    const existing = byId.get(prov.id);
    if (!existing || prov.priority < existing.priority) byId.set(prov.id, prov);
  }
  return [...byId.values()].sort((a, b) => a.priority - b.priority);
}

/* ---------- Genres ---------- */

let genreCache: { at: number; map: Map<number, string> } | null = null;

export async function getGenres(): Promise<Genre[]> {
  const [movie, tv] = await Promise.all(
    (["movie", "tv"] as const).map((t) => tmdbFetch<{ genres: Genre[] }>(`/genre/${t}/list`, {}, 24 * 60 * 60)),
  );
  const byId = new Map<number, Genre>();
  for (const g of [...movie.genres, ...tv.genres]) byId.set(g.id, g);
  return [...byId.values()];
}

async function genreMap(): Promise<Map<number, string>> {
  if (genreCache && Date.now() - genreCache.at < 24 * 60 * 60 * 1000) return genreCache.map;
  const map = new Map((await getGenres()).map((g) => [g.id, g.name]));
  genreCache = { at: Date.now(), map };
  return map;
}

/* ---------- Discover ---------- */

interface RawTitle {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
}

interface DiscoverPage {
  page: number;
  total_pages: number;
  results: RawTitle[];
}

export interface DiscoverOptions {
  mediaType: MediaType;
  providerIds: number[];
  region?: string;
  page?: number;
  genreIds?: number[];
}

export async function discover(opts: DiscoverOptions): Promise<DiscoverPage> {
  const region = opts.region ?? DEFAULT_REGION;
  return tmdbFetch<DiscoverPage>(`/discover/${opts.mediaType}`, {
    watch_region: region,
    // "|" = OR: available on any of the user's services
    with_watch_providers: opts.providerIds.join("|"),
    with_watch_monetization_types: "flatrate|free|ads",
    with_genres: opts.genreIds?.length ? opts.genreIds.join("|") : undefined,
    sort_by: "popularity.desc",
    "vote_count.gte": 50,
    include_adult: false,
    language: "en-US",
    page: opts.page ?? 1,
  });
}

/* ---------- Trailers ---------- */

interface RawVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
  iso_639_1: string;
  published_at: string;
}

/** Best YouTube trailer key from TMDB /videos, or null. */
export async function getTmdbTrailerKey(mediaType: MediaType, id: number): Promise<string | null> {
  const { results } = await tmdbFetch<{ results: RawVideo[] }>(`/${mediaType}/${id}/videos`, {
    include_video_language: "en,null",
  });
  const yt = results.filter((v) => v.site === "YouTube");
  const score = (v: RawVideo) =>
    (v.type === "Trailer" ? 4 : v.type === "Teaser" ? 2 : 0) + (v.official ? 1 : 0) + (v.iso_639_1 === "en" ? 1 : 0);
  yt.sort((a, b) => score(b) - score(a) || b.published_at.localeCompare(a.published_at));
  const best = yt[0];
  return best && (best.type === "Trailer" || best.type === "Teaser") ? best.key : null;
}

/* ---------- Watch providers (deep link) ---------- */

interface RawWatchRegion {
  link?: string;
  flatrate?: RawProvider[];
  free?: RawProvider[];
  ads?: RawProvider[];
}

export async function getWatchInfo(
  mediaType: MediaType,
  id: number,
  region = DEFAULT_REGION,
): Promise<{ link: string | null; providers: Provider[] }> {
  const data = await tmdbFetch<{ results: Record<string, RawWatchRegion> }>(`/${mediaType}/${id}/watch/providers`);
  const r = data.results[region];
  if (!r) return { link: null, providers: [] };
  const providers = [...(r.flatrate ?? []), ...(r.free ?? []), ...(r.ads ?? [])].map((p) => toProvider(p, region));
  return { link: r.link ?? null, providers };
}

/* ---------- Feed assembly ---------- */

export function toFeedBase(t: RawTitle, mediaType: MediaType, genres: Map<number, string>) {
  const date = t.release_date || t.first_air_date || "";
  return {
    key: `${mediaType}:${t.id}`,
    id: t.id,
    mediaType,
    title: t.title ?? t.name ?? "Untitled",
    overview: t.overview,
    year: date ? date.slice(0, 4) : null,
    posterUrl: img(t.poster_path, "w500"),
    backdropUrl: img(t.backdrop_path, "w780"),
    voteAverage: t.vote_average,
    genreIds: t.genre_ids,
    genres: t.genre_ids.map((g) => genres.get(g)).filter((g): g is string => !!g),
  };
}

export { genreMap, type RawTitle };

export type FeedItemDraft = Omit<FeedItem, "trailerKey" | "trailerSource" | "watchLink" | "availableOn">;
