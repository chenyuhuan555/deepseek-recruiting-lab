import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDraft } from './api.mjs';
import { generateDraft, ModelError } from './model.mjs';
const input = { job: { id: 'a', version: 1, criteria: [] }, sourceText: '必须主导上线' };
let user = 0;
const request = (body = input, extra = {}) => new Request('https://lab.example/api/draft', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://lab.example', 'oai-authenticated-user-id': `test-${++user}`, ...extra }, body: JSON.stringify(body) });
test('API validates input before contacting the model', async () => {
  let calls = 0;
  const r = await handleDraft(request({ ...input, sourceText: '' }), {}, () => { calls++; });
  assert.equal(r.status, 400); assert.equal(calls, 0);
});
test('cross-origin and oversized requests are rejected', async () => {
  assert.equal((await handleDraft(request(input, { origin: 'https://other.example' }), {})).status, 403);
  assert.equal((await handleDraft(request({ ...input, extra: 'x'.repeat(25000) }), {})).status, 400);
});
test('model result is returned with private no-store headers', async () => {
  const r = await handleDraft(request(), {}, async () => ({ changes: [], questions: [], baseVersion: 1 }));
  assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /no-store/);
  assert.equal((await r.json()).baseVersion, 1);
});
test('missing model key fails explicitly without a fake draft', async () => {
  const r = await handleDraft(request(), {});
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'MODEL_NOT_CONFIGURED');
});
test('upstream error bodies and secrets are not returned', async () => {
  const r = await handleDraft(request(), {}, async () => { throw new Error('secret-provider-details'); });
  assert.equal(r.status, 502); assert.doesNotMatch(await r.text(), /secret-provider/);
});
test('blank, truncated and invented-evidence model responses fail validation', async () => {
  for (const content of [' ', '{broken', JSON.stringify({ changes: [{ operation: 'add', text: '条件', kind: 'required', quote: '不存在的原文' }], questions: [] })]) {
    await assert.rejects(() => generateDraft(input, { DEEPSEEK_API_KEY: 'test-only' }, async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] })), e => e instanceof ModelError && e.code === 'INVALID_DRAFT');
  }
});
test('validated live-shaped result includes measured usage', async () => {
  const r = await generateDraft(input, { DEEPSEEK_API_KEY: 'test-only' }, async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(JSON.parse(options.body).response_format.type, 'json_object');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ changes: [{ operation: 'add', text: '主导上线', kind: 'required', quote: input.sourceText }], questions: [] }) } }], usage: { prompt_tokens: 500, completion_tokens: 80 } });
  });
  assert.equal(r.baseVersion, 1); assert.equal(r.metrics.inputTokens, 500); assert.equal(r.changes.length, 1);
});
