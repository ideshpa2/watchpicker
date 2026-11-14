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
