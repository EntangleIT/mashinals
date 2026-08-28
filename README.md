# Mashinals

**Mash. Remix. Inscribe.** An Infinite Craft–style browser toy where every discovery is a **Bitcoin SV 1SatOrdinal**.

Combine two pixel characters → get a new viral Mashinal (deterministic recipe) → inscribe the **32×32 pixel PNG** on-chain. Other people remix those ordinals. The inscription *is* the post.

## Why no X / Twitter API

An earlier pitch involved live X-trend meme packs. X API access is too expensive, so Mashinals has **zero dependency on X** — no scrapers, no posting, no trend feeds. The social graph is the ordinal lineage itself.

## Pixel art (not vector chibis)

Characters are **chunky pixel sprites** (32×32 source, nearest-neighbor scaled):

- Layered parts: body, clothes, hair, eyes, mouth, accessory
- Limited palettes (genes pick a palette index)
- Same two parents always produce the same child sprite + name + caption
- Collectible payload is a tiny **`image/png`** (optional compact grid SVG helper exists for tooling — PNG is what we inscribe)

No GatchaGo SVG path kits, no Three.js meshes, no photoreal AI images.

## 1SatOrdinals flow

1. Client composites the pixel sprite from genes.
2. Client builds inscription: PNG bytes + MAP metadata (`app=mashinals`, name, caption, recipe, generation, genes, parent names / origin outpoints when known).
3. User connects a BSV / 1Sat wallet (payment + ordinal address). **No hot private keys** are shipped or stored on the Worker.
4. Wallet signs & broadcasts (`js-1sat-ord` `createOrdinals` / provider `inscribe()`).
5. Client reports `{txid, origin, …}` to the Worker, which indexes the public feed.

**Demo Inscribe** writes a local “preview ordinal” labeled **NOT on-chain** so the UX is testable without a wallet.

### Libraries

- `js-1sat-ord` + `@bsv/sdk` for ordinal construction
- Browser wallet connect (1sat / Yours-compatible `window.onesat` / `window.yours`)
- Docs: [docs.1satordinals.com](https://docs.1satordinals.com), [js.1satordinals.com](https://js.1satordinals.com/)

## Repo layout

npm workspaces:

| Package | Role |
|---------|------|
| `shared` | Types, palettes, deterministic mash genetics, starters, tests |
| `client` | Vite + React 18 + Zustand + Framer Motion play UI |
| `worker` | **New** Cloudflare Worker `mashinals` — API + Workers Static Assets (same origin) + Mashinals-only D1 |

This app does **not** reuse `gachago-api`, does **not** publish into an entangleit.com Pages/portfolio directory, and does **not** share GatchaGo’s Wrangler project.

## Local dev

```bash
npm install
npm run dev:client          # http://127.0.0.1:45321  (Vite; proxies /api → worker)
npm run db:migrate:local
npm run dev:worker          # http://127.0.0.1:8788  (Worker + built assets + D1)
# or both:
npm run dev
```

Client calls `/api/*` (same-origin in production; Vite proxy in local client-only mode).

### Env

Copy `.env.example` → `client/.env.local` only if you need overrides:

| Var | Purpose |
|-----|---------|
| `VITE_API_URL` | API base (default `/api` — correct for same-origin Worker deploy) |
| `VITE_ENABLE_AI_FLOURISH` | Optional Workers AI name/caption flag — **off by default**; app is fully playable without it |

No secrets are required to play. Never commit `.env`, `.dev.vars`, or account-specific Cloudflare IDs.

## Deploy (new Cloudflare Worker)

One Worker named **`mashinals`** serves the frontend (Workers Static Assets) and the `/api/*` routes. D1 database name: **`mashinals-db`**.

```bash
# 1) Auth (once)
npx wrangler login

# 2) Create Mashinals-only D1 (once)
npm run db:create
# → copy the printed database_id into worker/wrangler.jsonc → d1_databases[0].database_id
#    (replace the placeholder UUID)

# 3) Apply migrations to remote D1
npm run db:migrate

# 4) Build client + shared, then deploy THIS worker only
npm run deploy
# equivalent: npm run build && npm run deploy -w worker
```

After deploy, open the `*.workers.dev` URL Wrangler prints (or attach a custom route later). Frontend and API share that origin — no separate Pages project, no copying files into another site.

Optional: set `CORS_ORIGIN` in `worker/wrangler.jsonc` `vars` if you ever front the API from a different origin (not needed for the default same-origin setup).

There are **no required Worker secrets** for the core toy (wallet keys never leave the browser). If you later enable optional AI flourish, document those secrets separately and keep them out of git.

## Tests

```bash
npm test
```

Covers: same parents → same child; different parents → different child; genes stay in valid part ranges.

## Play loop

1. Start with primordial pixel pals: Spark, Tide, Pebble, Gust, Pixel, Meme, Heart, Glitch.
2. Click two onto combine slots → **Mash** (auto-combines when both slots fill).
3. First time a recipe is found = discovery; repeats select the existing child.
4. Gallery / feed / character detail with Inscribe + Demo Inscribe.
5. Keep mashing discoveries into deeper generations.

## License

MIT — build weird pixel creatures, inscribe responsibly.
