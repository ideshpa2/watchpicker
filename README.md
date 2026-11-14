# WatchPicker

A mobile-first app that fixes decision paralysis about what to watch. Pick your streaming services, then swipe through a full-screen feed of trailers. After 5 skips, WatchPicker commits to its best pick for you.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- TMDB for titles, trailers and watch providers (called only from server route handlers)
- YouTube IFrame Player API for trailer playback (autoplay muted, tap to unmute)
- Thompson-sampling bandit over genres (`lib/bandit.ts`), state in `localStorage`

## Getting started

```bash
cp .env.local.example .env.local   # add TMDB_API_KEY (and YOUTUBE_API_KEY)
npm install
npm run dev
```

Open http://localhost:3000 on a phone-sized viewport.

## Plan

1. Setup screen: choose streaming services (TMDB watch-provider IDs, US region)
2. Feed: vertical scroll-snap trailers from TMDB `/discover` filtered by providers
3. Watch-time tracking per card, swipe = skip, 5-skip budget then auto-commit
4. "Watch this" deep link via TMDB watch/providers (JustWatch attribution)
5. Bandit recommender + "why this pick" label

Watch-provider data is supplied by [JustWatch](https://www.justwatch.com) via TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.

## API (server route handlers)

All TMDB and YouTube calls run on the server; keys never reach the browser. `TMDB_API_KEY` can be a v3 API key or a v4 read access token.

| Route | What it returns |
| --- | --- |
| `GET /api/providers?region=US` | Streaming services in the region (id, name, logo), sorted by popularity. Feeds the setup screen. |
| `GET /api/genres` | Movie + TV genres merged. These are the bandit's arms. |
| `GET /api/feed?providers=8,9&type=all&page=1&genres=28,35&exclude=movie:550` | One page of feed cards: `/discover` results on any of your services, movies and shows interleaved, each with a YouTube trailer key, genres, the TMDB watch link and which of your services carry it. Titles with no trailer are dropped. |

Trailers come from TMDB `/videos`. If TMDB has none and `YOUTUBE_API_KEY` is set, it falls back to a YouTube search (100 quota units per call, cached for a day).
