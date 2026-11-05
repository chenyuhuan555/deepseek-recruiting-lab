import { evidence, kindLabels } from './data.mjs';

export function buildImpact(previous, next, changes, questions) {
  const tasks = [];
  for (const change of changes) {
    const before = previous.criteria.find(c => c.id === change.id) ?? null;
    const after = next.criteria.find(c => c.id === change.id) ?? null;
    const label = after?.text ?? before.text;
    const action = !after || after.kind === 'not_required' ? `移除「${label}」的筛选限制` : `将「${label}」按${kindLabels[after.kind]}检查寻访条件`;
    const source = { criterionId: change.id, before, after, quote: change.quote };
    tasks.push({ id: `v${next.version}-${change.id}-sourcing`, type: 'sourcing', title: action, ...source });
    for (const item of evidence.filter(e => e.criterionId === change.id)) {
      tasks.push({ id: `v${next.version}-${change.id}-${item.id}`, type: 'evidence', title: `重新复核「${item.title}」`, evidenceId: item.id, evidenceQuote: item.quote, ...source });
    }
    if (after?.kind === 'required' && !evidence.some(e => e.criterionId === change.id)) tasks.push({ id: `v${next.version}-${change.id}-check`, type: 'evidence', title: `补充核验「${label}」的材料`, ...source });
  }
  questions.forEach((q, index) => tasks.push({ id: `v${next.version}-question-${index}`, type: 'clarification', title: q.text, criterionId: q.criterionId, quote: q.quote, sourceVersion: q.sourceVersion ?? next.version, before: null, after: null }));
  return tasks.map(t => ({ ...t, version: next.version, done: false }));
}
