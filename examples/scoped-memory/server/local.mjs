import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { handleDraft } from './api.mjs';

const port = Number(process.env.MEMORY_LAB_PORT || 4392);
const files = { '/': ['../web/index.html', 'text/html; charset=utf-8'], '/index.html': ['../web/index.html', 'text/html; charset=utf-8'], '/app.mjs': ['../web/app.mjs', 'text/javascript; charset=utf-8'], '/rules.mjs': ['../web/rules.mjs', 'text/javascript; charset=utf-8'], '/data.mjs': ['../web/data.mjs', 'text/javascript; charset=utf-8'], '/draft-ui.mjs': ['../web/draft-ui.mjs', 'text/javascript; charset=utf-8'], '/draft-domain.mjs': ['./draft-domain.mjs', 'text/javascript; charset=utf-8'], '/style.css': ['../web/style.css', 'text/css; charset=utf-8'], '/memory-map.svg': ['../web/memory-map.svg', 'image/svg+xml'] };
createServer(async (req, res) => {
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) { res.writeHead(403); res.end(); return; }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/draft') {
      const headers = new Headers(req.headers); headers.set('oai-authenticated-user-id', 'local-owner');
      const request = new Request(url, { method: req.method, headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
      const result = await handleDraft(request, process.env);
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(req.method) || !files[url.pathname]) { res.writeHead(404); res.end(); return; }
    const [path, type] = files[url.pathname];
    const content = await readFile(fileURLToPath(new URL(path, import.meta.url)));
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(500); res.end('服务暂不可用'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
