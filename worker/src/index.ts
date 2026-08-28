import { corsHeaders, json } from './cors';
import type { Env } from './env';

/** Public path on entangleit.com — keep in sync with client Vite `base` + Router basename. */
const PREFIX = '/mashinals';

function stripPrefix(pathname: string): string {
  if (pathname === PREFIX || pathname === `${PREFIX}/`) return '/';
  if (pathname.startsWith(`${PREFIX}/`)) return pathname.slice(PREFIX.length) || '/';
  return pathname;
}

function toAssetRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = stripPrefix(url.pathname);
  return new Request(url.toString(), request);
}

function apiPath(pathname: string): string | null {
  const stripped = stripPrefix(pathname);
  if (stripped === '/api' || stripped.startsWith('/api/')) {
    return stripped.slice('/api'.length) || '/';
  }
  // Also accept bare /api when served from workers.dev root
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return pathname.slice('/api'.length) || '/';
  }
  return null;
}

/** Cloudflare Worker: /mashinals SPA + /mashinals/api + workers.dev. No private keys. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }

    const url = new URL(request.url);

    // Canonical trailing slash for the app root on the custom path
    if (url.pathname === PREFIX) {
      url.pathname = `${PREFIX}/`;
      return Response.redirect(url.toString(), 301);
    }

    const api = apiPath(url.pathname);
    if (api !== null) {
      return handleApi(request, env, api, url);
    }

    // workers.dev root or /mashinals/* → static assets (prefix stripped)
    return env.ASSETS.fetch(toAssetRequest(request));
  },
};

async function handleApi(
  request: Request,
  env: Env,
  path: string,
  url: URL,
): Promise<Response> {
  if (!path.startsWith('/')) path = `/${path}`;

  try {
    if (path === '/health' && request.method === 'GET') {
      return json(env, request, { ok: true, service: 'mashinals' });
    }

    if (path === '/feed' && request.method === 'GET') {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 40)));
      const { results } = await env.DB.prepare(
        `SELECT id, name, caption, generation, parent_a_name, parent_b_name,
                origin, txid, demo, inscribed_at, svg_hash, spec_json
         FROM inscriptions
         ORDER BY inscribed_at DESC
         LIMIT ?`,
      )
        .bind(limit)
        .all<{
          id: string;
          name: string;
          caption: string;
          generation: number;
          parent_a_name: string | null;
          parent_b_name: string | null;
          origin: string;
          txid: string;
          demo: number;
          inscribed_at: number;
          svg_hash: string | null;
          spec_json: string;
        }>();

      return json(env, request, {
        items: (results ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          caption: r.caption,
          generation: r.generation,
          parentAName: r.parent_a_name,
          parentBName: r.parent_b_name,
          origin: r.origin,
          txid: r.txid,
          demo: Boolean(r.demo),
          inscribedAt: r.inscribed_at,
          svgHash: r.svg_hash,
          specJson: r.spec_json,
        })),
      });
    }

    if (path === '/inscriptions' && request.method === 'POST') {
      const body = (await request.json()) as {
        id?: string;
        name?: string;
        caption?: string;
        generation?: number;
        parentAName?: string | null;
        parentBName?: string | null;
        parentAOrigin?: string | null;
        parentBOrigin?: string | null;
        recipeKey?: string;
        origin?: string;
        txid?: string;
        demo?: boolean;
        svgHash?: string;
        spec?: unknown;
      };

      if (!body.id || !body.origin || !body.txid || !body.name || !body.spec) {
        return json(env, request, { error: 'id, origin, txid, name, spec required' }, 400);
      }

      await env.DB.prepare(
        `INSERT OR REPLACE INTO inscriptions
          (id, origin, txid, name, caption, generation, parent_a_name, parent_b_name,
           parent_a_origin, parent_b_origin, recipe_key, svg_hash, spec_json, demo, inscribed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          body.id,
          body.origin,
          body.txid,
          body.name.slice(0, 64),
          (body.caption ?? '').slice(0, 280),
          body.generation ?? 0,
          body.parentAName ?? null,
          body.parentBName ?? null,
          body.parentAOrigin ?? null,
          body.parentBOrigin ?? null,
          body.recipeKey ?? null,
          body.svgHash ?? null,
          JSON.stringify(body.spec),
          body.demo ? 1 : 0,
          Date.now(),
        )
        .run();

      return json(env, request, { ok: true });
    }

    if (path === '/recipes' && request.method === 'POST') {
      const body = (await request.json()) as {
        recipeKey?: string;
        parentAId?: string;
        parentBId?: string;
        childId?: string;
        childName?: string;
      };
      if (!body.recipeKey || !body.parentAId || !body.parentBId || !body.childId) {
        return json(env, request, { error: 'recipe fields required' }, 400);
      }

      const existing = await env.DB.prepare('SELECT discovery_count FROM recipes WHERE recipe_key = ?')
        .bind(body.recipeKey)
        .first<{ discovery_count: number }>();

      if (existing) {
        await env.DB.prepare(
          'UPDATE recipes SET discovery_count = discovery_count + 1, child_name = ? WHERE recipe_key = ?',
        )
          .bind(body.childName ?? 'Mashinal', body.recipeKey)
          .run();
      } else {
        await env.DB.prepare(
          `INSERT INTO recipes
            (recipe_key, parent_a_id, parent_b_id, child_id, child_name, first_discovered_at, discovery_count)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
        )
          .bind(
            body.recipeKey,
            body.parentAId,
            body.parentBId,
            body.childId,
            body.childName ?? 'Mashinal',
            Date.now(),
          )
          .run();
      }

      return json(env, request, { ok: true });
    }

    if (path === '/recipes' && request.method === 'GET') {
      const key = url.searchParams.get('key');
      if (!key) return json(env, request, { error: 'key required' }, 400);
      const row = await env.DB.prepare('SELECT * FROM recipes WHERE recipe_key = ?')
        .bind(key)
        .first();
      return json(env, request, { recipe: row });
    }

    return json(env, request, { error: 'Not found' }, 404);
  } catch (err) {
    console.error(err);
    return json(
      env,
      request,
      { error: err instanceof Error ? err.message : 'Server error' },
      500,
    );
  }
}
