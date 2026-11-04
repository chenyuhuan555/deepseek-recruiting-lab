import { validateDraft } from './draft-domain.mjs';
import { SYSTEM_PROMPT } from './prompt.mjs';

export class ModelError extends Error {
  constructor(message, code = 'MODEL_ERROR', status = 502) { super(message); this.code = code; this.status = status; }
}
export async function generateDraft(input, env, fetcher = fetch) {
  if (!env.DEEPSEEK_API_KEY) throw new ModelError('模型未配置', 'MODEL_NOT_CONFIGURED', 503);
  const start = Date.now();
  const model = env.DEEPSEEK_MODEL || 'deepseek-flash';
  let response;
  try {
    response = await fetcher('https://api.deepseek.com/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(input) }], response_format: { type: 'json_object' }, thinking: { type: 'disabled' }, max_tokens: 2200, temperature: 0 }),
      signal: AbortSignal.timeout(60000),
    });
  } catch { throw new ModelError('生成超时或网络异常，请重试', 'MODEL_UNAVAILABLE', 504); }
  if (!response.ok) throw new ModelError(response.status === 429 ? '模型繁忙，请稍后重试' : '模型服务暂不可用', 'MODEL_UNAVAILABLE', response.status === 429 ? 429 : 502);
  let payload, raw;
  try {
    payload = await response.json();
    const choice = payload.choices?.[0];
    if (choice?.finish_reason !== 'stop' || !choice.message?.content?.trim()) throw new Error();
    raw = JSON.parse(choice.message.content);
    const draft = validateDraft(raw, input);
    const usage = payload.usage || {};
    return { ...draft, jobId: input.job.id, baseVersion: input.job.version, model,
      metrics: { generationMs: Date.now() - start, inputTokens: Number.isSafeInteger(usage.prompt_tokens) ? usage.prompt_tokens : null, outputTokens: Number.isSafeInteger(usage.completion_tokens) ? usage.completion_tokens : null } };
  } catch { throw new ModelError('草稿未通过原文或格式检查，请重试', 'INVALID_DRAFT'); }
}
