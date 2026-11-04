import { kindLabels } from './data.mjs?v=6';
import { validateDraft } from './draft-domain.mjs?v=6';

export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const operations = { add: '新增', update: '修改', remove: '取消' };
export const defaultFeedback = 'RAG 不用卡死，但必须主导过产品上线，城市可以放宽。';
export function generatedView(draft, job) {
  if (!draft.changes.length && !draft.questions.length) return '<section class="proposal"><h3>无变更</h3></section>';
  return `<section class="proposal"><h3>变更草稿 <small>v${draft.baseVersion}</small></h3>
  ${draft.changes.map((change, index) => {
    const old = job.criteria.find(c => c.id === change.id);
    return `<div class="draft-row" data-change-row="${index}"><label class="check"><input type="checkbox" data-include checked aria-label="应用第${index + 1}项">${operations[change.operation]}</label>
    ${old ? `<p class="before-value">原条件：${escape(old.text)} · ${kindLabels[old.kind]}</p>` : ''}
    ${change.operation === 'remove' ? `<p>${escape(change.text)}</p>` : `<div class="draft-fields"><input data-change-text aria-label="第${index + 1}项条件" value="${escape(change.text)}" maxlength="300"><select data-change-kind class="control" aria-label="第${index + 1}项分类">${Object.entries(kindLabels).map(([kind, label]) => `<option value="${kind}" ${kind === change.kind ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`}
    <label class="quote-label">原文摘录<input data-change-quote aria-label="第${index + 1}项原文" value="${escape(change.quote)}" maxlength="1500"></label></div>`;
  }).join('')}
  ${draft.questions.length ? `<div class="draft-questions"><h3>待确认</h3>${draft.questions.map((question, index) => `<div class="question-row"><input data-question="${index}" aria-label="待确认问题${index + 1}" value="${escape(question.text)}" maxlength="300"><small>原话「${escape(question.quote)}」</small></div>`).join('')}</div>` : ''}
  <label class="check"><input type="checkbox" id="reviewed">确认变更</label><div class="action-row"><button id="commit" class="primary" disabled>保存</button><button class="link-button" id="conflict">模拟版本冲突</button></div>
  <details class="generation-record"><summary>调用记录</summary><p>${escape(draft.model)} · ${(draft.metrics.generationMs / 1000).toFixed(1)} 秒</p><p>输入 ${draft.metrics.inputTokens ?? '—'} / 输出 ${draft.metrics.outputTokens ?? '—'} tokens</p></details></section>`;
}
export function collectDraft(root, draft, job) {
  const changes = [...root.querySelectorAll('[data-change-row]')].filter(row => row.querySelector('[data-include]').checked).map(row => {
    const original = draft.changes[Number(row.dataset.changeRow)];
    return { ...original, text: row.querySelector('[data-change-text]')?.value ?? original.text, kind: row.querySelector('[data-change-kind]')?.value ?? original.kind, quote: row.querySelector('[data-change-quote]').value };
  });
  const questions = draft.questions.map((q, index) => ({ ...q, text: root.querySelector(`[data-question="${index}"]`).value }));
  return validateDraft({ changes, questions }, { job, sourceText: draft.sourceText });
}
export function questionList(questions = []) {
  if (!questions.length) return '';
  return `<section class="saved-questions"><h3>待确认</h3>${questions.map(q => `<p>${escape(q.text)}</p><small>原话「${escape(q.quote)}」</small>`).join('')}</section>`;
}
