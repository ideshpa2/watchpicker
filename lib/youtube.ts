import "server-only";

/**
 * Fallback trailer lookup via the YouTube Data API v3, used only when TMDB
 * has no trailer for a title. Costs 100 quota units per call, so results are
 * cached for a day. Returns null if YOUTUBE_API_KEY isn't set.
 */
export async function searchYoutubeTrailer(title: string, year: string | null): Promise<string | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("q", `${title}${year ? ` ${year}` : ""} official trailer`);
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { next: { revalidate: 24 * 60 * 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: { id?: { videoId?: string } }[] };
    return data.items?.[0]?.id?.videoId ?? null;
  } catch {
    return null;
  }
}
