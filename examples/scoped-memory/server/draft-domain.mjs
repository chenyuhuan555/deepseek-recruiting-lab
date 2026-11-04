const kinds = new Set(['required', 'preferred', 'not_required', 'unconfirmed']);
function string(value, limit, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${label}无效`);
  return value.trim();
}
function identifier(value) { return typeof value === 'string' && /^[\w-]{1,80}$/.test(value); }
export function validateInput(input) {
  const sourceText = string(input?.sourceText, 3000, '客户反馈');
  const job = input?.job;
  if (!job || !identifier(job.id)) throw new Error('岗位无效');
  if (!Number.isSafeInteger(job.version) || job.version < 1) throw new Error('岗位版本无效');
  if (!Array.isArray(job.criteria) || job.criteria.length > 30) throw new Error('岗位条件无效');
  const ids = new Set();
  const criteria = job.criteria.map(item => {
    if (!item || !identifier(item.id) || ids.has(item.id) || !kinds.has(item.kind)) throw new Error('岗位条件无效');
    ids.add(item.id);
    return { id: item.id, text: string(item.text, 300, '条件'), kind: item.kind, quote: string(item.quote, 1500, '条件原文') };
  });
  return { job: { id: job.id, version: job.version, criteria }, sourceText };
}
export function validateDraft(raw, { job, sourceText }) {
  if (!raw || !Array.isArray(raw.changes) || !Array.isArray(raw.questions) || raw.changes.length > 12 || raw.questions.length > 10) throw new Error('草稿格式无效');
  const existing = new Map(job.criteria.map(item => [item.id, item]));
  const quote = value => {
    const result = string(value, 1500, '原文摘录');
    if (!sourceText.includes(result)) throw new Error('摘录未出现在客户原文');
    return result;
  };
  const questions = raw.questions.map(q => {
    if (!q || (q.criterionId != null && !existing.has(q.criterionId))) throw new Error('问题引用的条件不存在');
    return { text: string(q.text, 300, '待确认问题'), quote: quote(q.quote), criterionId: q.criterionId ?? null };
  });
  const uncertain = new Set(questions.map(q => q.criterionId).filter(Boolean));
  const seen = new Set(), allIds = new Set(existing.keys());
  let addition = 0;
  const changes = raw.changes.map(item => {
    if (!item || !['add', 'update', 'remove'].includes(item.operation)) throw new Error('变更操作无效');
    const evidence = quote(item.quote);
    let id = item.id;
    if (item.operation === 'add') {
      do { id = `addition-${++addition}`; } while (allIds.has(id));
      allIds.add(id);
    } else if (!existing.has(id)) throw new Error('变更引用的条件不存在');
    if (seen.has(id)) throw new Error('同一条件重复变更');
    seen.add(id);
    const old = existing.get(id);
    if (item.operation === 'remove') return { operation: 'remove', id, text: old.text, kind: old.kind, quote: evidence };
    if (!kinds.has(item.kind)) throw new Error('条件分类无效');
    return { operation: item.operation, id, text: string(item.text, 300, '条件'), kind: item.kind, quote: evidence };
  }).filter(item => {
    if (uncertain.has(item.id)) return false;
    const old = existing.get(item.id);
    return item.operation !== 'update' || item.text !== old.text || item.kind !== old.kind;
  });
  return { changes, questions };
}
export function patchFromDraft(draft, { job, sourceText, confirmedBy }) {
  return { expectedVersion: job.version, sourceText, confirmedBy,
    updates: draft.changes.filter(c => c.operation !== 'remove').map(({ id, text, kind, quote }) => ({ id, text, kind, quote })),
    removeIds: draft.changes.filter(c => c.operation === 'remove').map(c => c.id) };
}
