import "server-only";

import {
  discover,
  genreMap,
  getTmdbTrailerKey,
  getWatchInfo,
  JUSTWATCH_ATTRIBUTION,
  toFeedBase,
  type FeedItemDraft,
} from "./tmdb";
import type { FeedItem, FeedResponse, MediaType } from "./types";
import { searchYoutubeTrailer } from "./youtube";

export interface FeedQuery {
  providerIds: number[];
  mediaTypes: MediaType[];
  page: number;
  region: string;
  genreIds?: number[];
  /** Keys already seen by the client, to skip. */
  exclude?: Set<string>;
}

/** Run async work over items with a concurrency cap (TMDB allows ~50 req/s; stay polite). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function enrich(draft: FeedItemDraft, providerIds: Set<number>, region: string): Promise<FeedItem | null> {
  try {
    const [tmdbKey, watch] = await Promise.all([
      getTmdbTrailerKey(draft.mediaType, draft.id),
      getWatchInfo(draft.mediaType, draft.id, region),
    ]);
    let trailerKey = tmdbKey;
    let trailerSource: FeedItem["trailerSource"] = "tmdb";
    if (!trailerKey) {
      trailerKey = await searchYoutubeTrailer(draft.title, draft.year);
      trailerSource = "youtube";
    }
    if (!trailerKey) return null;

    const availableOn = watch.providers.filter((p) => providerIds.has(p.id));
    // /discover can be stale; drop titles no longer on any of the user's services.
    if (availableOn.length === 0) return null;

    return { ...draft, trailerKey, trailerSource, watchLink: watch.link, availableOn };
  } catch {
    return null;
  }
}

/**
 * One page of the feed: pulls the same /discover page for each media type,
 * interleaves movies and shows, then enriches each title with a trailer and
 * watch link. Titles without a playable trailer are dropped.
 */
export async function buildFeed(q: FeedQuery): Promise<FeedResponse> {
  const genres = await genreMap();
  const pages = await Promise.all(
    q.mediaTypes.map((mediaType) =>
      discover({ mediaType, providerIds: q.providerIds, region: q.region, page: q.page, genreIds: q.genreIds }).then(
        (p) => ({ mediaType, p }),
      ),
    ),
  );

  const lists = pages.map(({ mediaType, p }) => p.results.map((r) => toFeedBase(r, mediaType, genres)));
  const interleaved: FeedItemDraft[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const l of lists) if (l[i]) interleaved.push(l[i]);
  }
  const fresh = interleaved.filter((d) => !q.exclude?.has(d.key));

  const providerSet = new Set(q.providerIds);
  const enriched = await mapLimit(fresh, 8, (d) => enrich(d, providerSet, q.region));

  return {
    items: enriched.filter((x): x is FeedItem => x !== null),
    page: q.page,
    totalPages: Math.max(0, ...pages.map(({ p }) => p.total_pages)),
    attribution: JUSTWATCH_ATTRIBUTION,
  };
}
