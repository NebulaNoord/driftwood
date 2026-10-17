# Driftwood

Build an island colony, raise an army and raid other players' islands, right in the browser. Players don't need an account.

## How it works

- `public/index.html` is the whole game in one file: a custom WebGL renderer, the simulation and the UI.
- `api/db.js` is the shared store, a single Vercel function backed by Upstash Redis. Islands, raid reports and private saves all live there.
- Each browser makes a secret **player code** the first time it opens the game. The server hashes that code into a player id, so it never stores accounts or passwords. To play on another device, paste the code into **Your islands → Use code**.

Store rules (enforced in `api/db.js`):

| Path | Read | Write |
|---|---|---|
| `islands/<id>` | anyone | only player `<id>` |
| `raids/<id>` | anyone | anyone can log a raid they led; reports can't be edited, and they expire after 30 days |
| `data/users/<id>/<save>` | only player `<id>` | only player `<id>` (up to 80 saves) |

Writes are rate-limited per player, and raid loot is capped on the server.

## Music

Background music is from [“Cozy Music Sampler” by Spaceyyy](https://aquumgifts.itch.io/cozy-music-complete), licensed CC BY 4.0 (see `music/LICENSE.txt`). Five tracks are used: Spring Morning, Cozy Tavern and Morning Brew rotate through the day, Late-Night Study plays at night, and Snowy Village plays on rainy days. The files in `music/` are volume-matched AAC copies, with Opus copies as a fallback for browsers that can't play AAC.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project**, import this repository, and deploy it with the default settings. There's no build step: Vercel serves `public/` and turns `api/db.js` into a function.
2. In the project, open **Storage** (or the **Marketplace**), add **Upstash for Redis** (the free plan is enough), and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; either pair works.
3. Redeploy so the function picks up the new variables. Then share the link: anyone who opens it can build and raid.

Until the store is connected, the game still runs, but sharing and raiding other players are switched off.

## Working on it

The game source is in `src/`. `build.py` puts it together:

- `public/index.html` is the web build, with `web/adapter.js` connecting the game to `/api/db`.
- `dist/driftwood.html` is the Claude artifact build.

```sh
python3 build.py                 # rebuild public/index.html
node tests/webserver.js 8787     # local server with an in-memory store, at http://127.0.0.1:8787
node tests/sim.test.js           # simulation tests
python3 tests/web.py             # two-player end-to-end test (needs Playwright)
```

Commit `public/index.html` after rebuilding, since Vercel serves it as it is.
