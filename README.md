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
| `worker` | Cloudflare Worker + D1 (recipes, inscription index) |

## Local dev

```bash
npm install
npm run dev:client          # http://127.0.0.1:45321
# optional API:
npm run db:migrate:local -w worker
npm run dev:worker          # http://127.0.0.1:8788
# or both:
npm run dev
```

Client proxies `/api/*` to the worker in Vite.

### Env

Copy `.env.example` → `client/.env.local` if you need overrides:

| Var | Purpose |
|-----|---------|
| `VITE_API_URL` | Worker base URL (default `/api` via Vite proxy) |
| `VITE_ENABLE_AI_FLOURISH` | Optional Workers AI name/caption flag — **off by default**; app is fully playable without it |

No secrets are required to play. Never commit `.env` / `.dev.vars` with keys.

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
