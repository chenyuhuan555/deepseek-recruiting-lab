import { validateInput } from './draft-domain.mjs';
import { generateDraft, ModelError } from './model.mjs';

const slots = new Map();
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('请求为空');
  let size = 0; const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 24000) { await reader.cancel(); throw new Error('请求过大'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleDraft(request, env, generator = generateDraft) {
  if (request.method !== 'POST') return json({ error: '仅支持 POST' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: '请求来源不符' }, 403);
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: '请求格式无效' }, 415);
  let input;
  try { input = validateInput(await readBody(request)); } catch (error) { return json({ error: error instanceof SyntaxError ? '请求格式无效' : error.message }, 400); }
  const key = request.headers.get('oai-authenticated-user-id') || 'private-owner';
  const now = Date.now();
  for (const [id, entry] of slots) if (!entry.active && entry.expires < now) slots.delete(id);
  let entry = slots.get(key);
  if (!entry || (!entry.active && entry.expires < now)) entry = { count: 0, expires: now + 60000, active: false };
  if (entry.active || entry.count >= 8) return json({ error: '请求较频繁，请稍后重试' }, 429);
  entry.count++; entry.active = true; slots.set(key, entry);
  try { return json(await generator(input, env)); }
  catch (error) { return json({ error: error instanceof ModelError ? error.message : '生成失败，请重试', code: error instanceof ModelError ? error.code : 'GENERATION_FAILED' }, error instanceof ModelError ? error.status : 502); }
  finally { entry.active = false; }
}
