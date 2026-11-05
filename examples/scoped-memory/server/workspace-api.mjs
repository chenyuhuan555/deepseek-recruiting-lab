import { readBody } from './api.mjs';
import { bootstrap, listJobs, saveRevision, setTask, saveReview, WorkspaceError } from './workspace.mjs';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function handleWorkspace(request, env) {
  const url = new URL(request.url);
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: '请求来源不符' }, 403);
  if (!env.DB) return json({ error: '存档服务尚未配置' }, 503);
  try {
    if (url.pathname === '/api/jobs' && request.method === 'GET') return json({ jobs: await listJobs(env.DB) });
    if (request.method !== 'POST') return json({ error: '不支持此操作' }, 405);
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: '请求格式无效' }, 415);
    let input; try { input = await readBody(request); } catch { return json({ error: '请求格式无效或过大' }, 400); }
    if (url.pathname === '/api/workspace') return json({ jobs: await bootstrap(env.DB) });
    const match = url.pathname.match(/^\/api\/jobs\/([\w-]{1,80})\/(revisions|tasks|reviews)$/);
    if (!match) return json({ error: '操作不存在' }, 404);
    const action = { revisions: saveRevision, tasks: setTask, reviews: saveReview }[match[2]];
    return json({ job: await action(env.DB, match[1], input) });
  } catch (error) { return json({ error: error instanceof WorkspaceError ? error.message : '存档服务暂不可用，请重试' }, error instanceof WorkspaceError ? error.status : 500); }
}
