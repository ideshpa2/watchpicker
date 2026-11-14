// Shared types between server route handlers and the client feed.

export type MediaType = "movie" | "tv";

export interface Provider {
  id: number;
  name: string;
  logoUrl: string | null;
  priority: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface FeedItem {
  /** Stable key across movie/tv, e.g. "movie:550". */
  key: string;
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  year: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number;
  genreIds: number[];
  genres: string[];
  /** YouTube video id for the trailer. */
  trailerKey: string;
  trailerSource: "tmdb" | "youtube";
  /** TMDB watch page for the region (JustWatch-powered). Use as the "Watch this" deep link. */
  watchLink: string | null;
  /** Which of the user's services carry this title (flatrate/free/ads). */
  availableOn: Provider[];
}

export interface FeedResponse {
  items: FeedItem[];
  page: number;
  totalPages: number;
  attribution: string;
}
