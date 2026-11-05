import { handleDraft } from '../server/api.mjs';
import assets from './assets.generated.mjs';
import { handleWorkspace } from '../server/workspace-api.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/draft') return handleDraft(request, env);
    if (url.pathname.startsWith('/api/')) return handleWorkspace(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const item = assets[url.pathname];
    if (!item) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : item.content, { headers: { 'Content-Type': item.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' } });
  },
};
