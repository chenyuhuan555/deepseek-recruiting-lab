import test from 'node:test';
import assert from 'node:assert/strict';
import { openLocalDb } from './local-db.mjs';
import { handleWorkspace } from './workspace-api.mjs';
const request = (method, route, data, origin = 'https://lab.example') => new Request('https://lab.example/api/' + route, { method, headers: { origin, 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
test('workspace rejects foreign-origin writes and unconfigured storage', async () => {
  assert.equal((await handleWorkspace(request('POST', 'workspace', {}, 'https://other.example'), {})).status, 403);
  assert.equal((await handleWorkspace(request('GET', 'jobs'), {})).status, 503);
});
test('workspace initializes durable jobs and rejects malformed mutations', async t => {
  const db = await openLocalDb(':memory:'); t.after(() => db.close());
  const result = await handleWorkspace(request('POST', 'workspace', {}), { DB: db }); assert.equal(result.status, 200); assert.equal((await result.json()).jobs.length, 2);
  const saved = await handleWorkspace(request('POST', 'jobs/job-a/revisions', { expectedVersion: 1, sourceText: '必须主导上线', confirmedBy: '林', changes: [{ operation: 'add', text: '主导上线', kind: 'required', quote: '必须主导上线' }], questions: [] }), { DB: db });
  assert.equal(saved.status, 200); assert.equal((await saved.json()).job.version, 2);
  assert.equal((await handleWorkspace(request('POST', 'jobs/job-a/revisions', {}), { DB: db })).status, 409);
  assert.equal((await handleWorkspace(request('POST', 'jobs/job-a/tasks', { version: 2, id: 'invented', done: true }), { DB: db })).status, 400);
  assert.equal((await handleWorkspace(request('POST', 'jobs/job-a/revisions', { expectedVersion: 2, sourceText: '原话', confirmedBy: '林', changes: [], questions: [{ text: '问题', quote: '不存在' }] }), { DB: db })).status, 400);
});
