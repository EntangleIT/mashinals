import type { Env } from './env';

export function corsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '*';
  const allow = env.CORS_ORIGIN && env.CORS_ORIGIN !== '*' ? env.CORS_ORIGIN : origin;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(env: Env, request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env, request),
    },
  });
}
