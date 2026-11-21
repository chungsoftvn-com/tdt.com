// Run behind an HTTPS reverse proxy. Keep this listener on loopback.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const MAX_BODY = 256 * 1024;
const equal = (a, b) => {
  const x = Buffer.from(a || ''); const y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
};
export async function handleWebhook(request, env = process.env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== '/facebook-webhook') return new Response('Not found', { status: 404 });
  if (!env.FB_VERIFY_TOKEN || !env.FB_APP_SECRET || !env.FB_PAGE_ID || !env.GITHUB_DISPATCH_TOKEN) {
    return new Response('Webhook not configured', { status: 503 });
  }
  if (request.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && equal(url.searchParams.get('hub.verify_token'), env.FB_VERIFY_TOKEN)) {
      return new Response(url.searchParams.get('hub.challenge') || '', { headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MAX_BODY) return new Response('Too large', { status: 413 });
  const signature = 'sha256=' + createHmac('sha256', env.FB_APP_SECRET).update(body).digest('hex');
  if (!equal(request.headers.get('x-hub-signature-256'), signature)) return new Response('Forbidden', { status: 403 });
  let data;
  try { data = JSON.parse(body.toString('utf8')); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const relevant = data.object === 'page' && Array.isArray(data.entry) && data.entry.some(entry =>
    String(entry.id) === String(env.FB_PAGE_ID) && Array.isArray(entry.changes) && entry.changes.some(change =>
      change.field === 'feed' && ['post', 'photo', 'video', 'status', 'share'].includes(change.value?.item) &&
      ['add', 'edited', 'edit', 'remove'].includes(change.value?.verb)
    ));
  if (!relevant) return new Response('Ignored');
  try {
    const response = await fetcher('https://api.github.com/repos/chungsoftvn-com/tdt.com/dispatches', {
      method: 'POST', signal: AbortSignal.timeout(8000), headers: {
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'TodayTourist-Facebook-Webhook',
      }, body: JSON.stringify({ event_type: 'facebook-page-feed' }),
    });
    if (!response.ok) return new Response('Dispatch failed; retry required', { status: 503 });
    return new Response('Accepted');
  } catch { return new Response('Dispatch unavailable; retry required', { status: 503 }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const key of ['FB_VERIFY_TOKEN', 'FB_APP_SECRET', 'FB_PAGE_ID', 'GITHUB_DISPATCH_TOKEN']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  const server = createServer(async (req, res) => {
    const chunks = []; let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) { res.writeHead(413).end('Too large'); return; }
        chunks.push(chunk);
      }
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method, headers: req.headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }),
      });
      const result = await handleWebhook(request);
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
    } catch { res.writeHead(500).end('Request failed'); }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  server.listen(Number(process.env.FB_WEBHOOK_PORT || 8787), '127.0.0.1', () => console.log('Facebook webhook listening on loopback'));
}
