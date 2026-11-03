// Browser mapping of the Python teaching example. Inputs are trusted demo data.
export function applyChange(job, patch) {
  const { expectedVersion, sourceText, updates, removeIds, confirmedBy } = patch;
  if (expectedVersion !== job.version) throw new Error('岗位版本已变化，请重新查看变更后再确认。');
  if (!confirmedBy.trim() || !sourceText.trim()) throw new Error('请填写补充原话并指定确认人。');
  const ids = updates.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('条件编号重复。');
  if (ids.some(id => removeIds.includes(id))) throw new Error('同一条件不能同时修改和取消，操作冲突。');
  const current = new Map(job.criteria.map(item => [item.id, item]));
  if (removeIds.some(id => !current.has(id))) throw new Error('不能取消不存在的条件。');
  for (const item of updates) {
    if (!item.id.trim() || !item.text.trim()) throw new Error('请填写条件编号和内容。');
    if (!['required', 'preferred', 'not_required', 'unconfirmed'].includes(item.kind)) throw new Error('不支持的条件分类。');
    if (!item.quote.trim() || !sourceText.includes(item.quote)) throw new Error('来源摘录必须出现在补充原话里。');
  }
  removeIds.forEach(id => current.delete(id));
  updates.forEach(item => current.set(item.id, structuredClone(item)));
  return { ...job, version: job.version + 1, criteria: [...current.values()], history: [...job.history, {
    fromVersion: job.version, sourceText, confirmedBy, previousCriteria: structuredClone(job.criteria), removedIds: [...removeIds],
  }] };
}

export function memoryDisposition(memory, context) {
  if (!['job', 'client', 'recruiter'].includes(memory.scope)) return { included: false, reason: '未知范围' };
  if (memory.ownerId !== context[memory.scope]) return { included: false, reason: '不属于当前' + { job: '岗位', client: '客户', recruiter: '顾问' }[memory.scope] };
  if (!memory.confirmedBy.trim()) return { included: false, reason: '尚未人工确认' };
  if (memory.expiresOn && memory.expiresOn < context.today) return { included: false, reason: '已超过有效期' };
  return { included: true, reason: '范围匹配，已确认且有效' };
}

export function reviewState(review, job) {
  if (!review || review.jobId !== job.id) return 'pending';
  return review.version === job.version ? review.status : 'stale';
}
