import { applyChange, memoryDisposition, reviewState } from './rules.mjs';
import { projects, memories, evidence, kindLabels, reviewLabels } from './data.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const names = { r1: '顾问林', r2: '顾问周' };
let jobs = structuredClone(projects), projectId = 'job-a', tab = 'revision', recruiter = 'r1';
const localDate = new Date();
const initialDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
let today = initialDate, draft = null, formValues = null, reviews = {};
const currentJob = () => jobs.find(job => job.id === projectId);
const defaultForm = () => ({ sourceText: '必须主导过产品上线，原来其他条件不变。', target: 'launch', text: '主导过产品上线', kind: 'required', quote: '必须主导过产品上线', action: 'update' });
const notice = (text, error = false) => { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); };
const badge = kind => `<span class="badge ${kind}">${kindLabels[kind]}</span>`;
function criteriaList(items) {
  return `<ul class="criteria">${items.map(item => `<li class="criterion"><div class="criterion-title"><strong>${escape(item.text)}</strong>${badge(item.kind)}</div><small>原话「${escape(item.quote)}」</small></li>`).join('')}</ul>`;
}
function formField(label, name, value, extra = '') {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${escape(value)}" ${extra}></div>`;
}
function revisionView(job) {
  const v = formValues || defaultForm();
  return `<div class="grid"><section class="panel"><div class="panel-head"><h2>岗位条件</h2></div><div class="panel-body"><div class="presets"><button class="preset" data-preset="add">增加上线经历</button><button class="preset" data-preset="soften">B 端改为加分项</button><button class="preset" data-preset="remove">取消 RAG 条件</button></div>
  <form id="patch-form"><div class="field"><label for="sourceText">客户原话</label><textarea name="sourceText" id="sourceText" required maxlength="3000">${escape(v.sourceText)}</textarea></div>
  <div class="two-fields"><div class="field"><label for="target">条件</label><select id="target" name="target" class="control">${[...new Map([...projects.find(p => p.id === job.id).criteria.map(i => [i.id, i.text]), ...job.criteria.map(i => [i.id, i.text]), ['launch', '上线经历（新增 / 修改）']])].map(([id, text]) => `<option value="${id}" ${id === v.target ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></div><div class="field"><label for="action">操作</label><select id="action" name="action" class="control"><option value="update" ${v.action === 'update' ? 'selected' : ''}>新增 / 替换</option><option value="remove" ${v.action === 'remove' ? 'selected' : ''}>明确取消</option></select></div></div>
  ${formField('条件内容', 'text', v.text, 'maxlength="300"')}<div class="two-fields"><div class="field"><label for="kind">分类</label><select id="kind" name="kind" class="control">${Object.entries(kindLabels).map(([key, text]) => `<option value="${key}" ${v.kind === key ? 'selected' : ''}>${text}</option>`).join('')}</select></div>${formField('原文摘录', 'quote', v.quote, 'maxlength="1000"')}</div>
  <div class="action-row"><button class="primary" type="submit">查看变更</button></div></form>
  <div id="proposal">${draft ? proposalView(job) : ''}</div></div></section>
  <aside><section class="panel"><div class="panel-head"><h2>岗位档案</h2><span class="counter">v${job.version} · ${job.criteria.length} 条</span></div><div class="panel-body">${criteriaList(job.criteria)}</div></section>
  <section class="panel subsection"><div class="panel-head"><h2>版本记录</h2><span class="counter">${job.history.length + 1} 个版本</span></div><div class="panel-body timeline">${[...job.history].reverse().map(item => `<div class="history-item"><strong>v${item.fromVersion + 1} · ${escape(item.confirmedBy)} 确认</strong><p>${escape(item.sourceText)}</p><details><summary>查看修改前 v${item.fromVersion} 的条件</summary>${criteriaList(item.previousCriteria)}</details></div>`).join('')}<div class="history-item"><strong>v1 · 初始需求</strong><p>${escape(job.source)}</p></div></div></section></aside></div>`;
}
function proposalView(job) {
  const previous = job.criteria.find(i => i.id === draft.target);
  const action = draft.patch.removeIds.length ? '取消' : previous ? '替换' : '新增';
  return `<section class="proposal"><h3>变更预览 <small>v${draft.patch.expectedVersion}</small></h3><div class="diff-line"><span>${action}</span>${escape(draft.patch.removeIds.length ? previous?.text || draft.target : draft.patch.updates[0].text)}${draft.patch.updates.length ? ' · ' + kindLabels[draft.patch.updates[0].kind] : ''}</div><label class="check"><input type="checkbox" id="reviewed">确认变更</label><div class="action-row"><button id="commit" class="primary" disabled>保存</button><button class="link-button" id="conflict">模拟版本冲突</button></div></section>`;
}
function memoryView(job) {
  const context = { job: job.id, client: job.clientId, recruiter, today };
  const rows = memories.map(m => ({ ...m, ...memoryDisposition(m, context) }));
  const selected = rows.filter(m => m.included);
  return `<div class="grid"><section class="panel"><div class="panel-head"><h2>历史反馈</h2><span class="counter">${selected.length} / ${rows.length} 条纳入</span></div><div class="panel-body"><div class="toolbar"><div class="field"><label for="recruiter">顾问</label><select class="control" id="recruiter">${Object.entries(names).map(([id, name]) => `<option value="${id}" ${recruiter === id ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div class="field"><label for="date">日期</label><input id="date" type="date" value="${today}" required min="2020-01-01" max="2099-12-31"></div></div><ul class="memory-list">${rows.map(m => `<li class="memory-row ${m.included ? '' : 'excluded'}"><div class="memory-top"><p class="memory-text">${escape(m.text)}</p><span class="scope-tag">${{ job: '岗位', client: '客户', recruiter: '顾问' }[m.scope]}</span></div><small>${escape(m.owner)} · ${m.expiresOn ? '截止 ' + m.expiresOn : '长期'}</small><p class="reason">${m.included ? '纳入' : '排除'} · ${m.reason}</p></li>`).join('')}</ul></div></section>
  <aside class="panel"><div class="panel-head"><h2>本轮上下文</h2><span class="counter">v${job.version}</span></div><div class="panel-body"><div class="context-block"><h3>岗位条件</h3><ul>${job.criteria.map(i => `<li>${escape(i.text)} · ${kindLabels[i.kind]}</li>`).join('')}</ul></div><div class="context-block"><h3>历史建议</h3>${selected.length ? `<ul>${selected.map(m => `<li>${escape(m.text)}</li>`).join('')}</ul>` : '<p class="empty">暂无</p>'}</div></div></aside></div>`;
}
function evidenceView(job) {
  return `<div class="evidence-grid">${evidence.map(item => {
    const review = reviews[`${job.id}:${item.id}`];
    const status = reviewState(review, job);
    const criterion = job.criteria.find(c => c.id === item.criterionId);
    return `<article class="panel evidence-card"><div class="panel-head"><h2>${item.title}</h2><span class="badge ${status === 'supported' ? '' : 'preferred'}">${reviewLabels[status]}</span></div><div class="panel-body"><blockquote>“${escape(item.quote)}”</blockquote><dl><div class="analysis-row"><dt>判断</dt><dd>${escape(item.inference)}</dd></div><div class="analysis-row"><dt>待核实</dt><dd>${escape(item.gap)}</dd></div><div class="analysis-row"><dt>条件</dt><dd>${criterion ? escape(criterion.text) + ' · ' + kindLabels[criterion.kind] : '已取消'}</dd></div></dl><form class="review-box" data-review="${item.id}"><label for="review-${item.id}">复核结论</label><select id="review-${item.id}" name="status" class="control" required><option value="">选择结论</option>${['supported', 'unsupported', 'insufficient'].map(s => `<option value="${s}">${reviewLabels[s]}</option>`).join('')}</select><div class="action-row"><button class="primary" type="submit">记录复核</button></div></form>${review ? `<p class="review-note">v${review.version} · ${reviewLabels[review.status]} · ${escape(review.by)}</p>` : ''}</div></article>`;
  }).join('')}</div>`;
}
function render() {
  const job = currentJob();
  $('#job-version').textContent = `v${job.version}`;
  document.querySelectorAll('.tab').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#workspace').innerHTML = tab === 'revision' ? revisionView(job) : tab === 'memory' ? memoryView(job) : evidenceView(job);
}
function preview(form) {
  formValues = Object.fromEntries(new FormData(form));
  const v = formValues;
  const patch = { expectedVersion: currentJob().version, sourceText: v.sourceText, confirmedBy: names[recruiter], updates: v.action === 'remove' ? [] : [{ id: v.target, text: v.text, kind: v.kind, quote: v.quote }], removeIds: v.action === 'remove' ? [v.target] : [] };
  try { applyChange(currentJob(), patch); draft = { patch, target: v.target }; render(); notice(''); }
  catch (error) { draft = null; $('#proposal').innerHTML = ''; notice(error.message, true); }
}
function saveDraft() {
  if (!draft || !$('#reviewed')?.checked) return;
  try { const next = applyChange(currentJob(), draft.patch); jobs = jobs.map(j => j.id === next.id ? next : j); draft = null; render(); notice(`已保存 v${next.version}`); }
  catch (error) { notice(error.message, true); }
}
function preset(name) {
  formValues = name === 'add' ? defaultForm() : name === 'soften' ? { sourceText: 'B 端产品经验改为加分项，其他要求不变。', target: 'b2b', text: '具备 B 端产品经验', kind: 'preferred', quote: 'B 端产品经验改为加分项', action: 'update' } : { sourceText: '这次取消 RAG 应用经历要求，其他条件不变。', target: 'rag', text: '参与过 RAG 应用', kind: 'preferred', quote: '取消 RAG 应用经历要求', action: 'remove' };
  draft = null; render(); notice('');
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.tab) { tab = button.dataset.tab; render(); notice(''); }
  if (button.dataset.preset) preset(button.dataset.preset);
  if (button.id === 'commit') saveDraft();
  if (button.id === 'conflict' && draft) {
    const job = currentJob(); const sourceText = '工作地点为上海，其他要求不变。';
    const next = applyChange(job, { expectedVersion: job.version, sourceText, confirmedBy: '另一位顾问（模拟）', updates: [{ id: 'city', text: '工作地点为上海', kind: 'required', quote: '工作地点为上海' }], removeIds: [] });
    jobs = jobs.map(j => j.id === next.id ? next : j); render(); notice(`当前 v${next.version} · 草稿 v${draft.patch.expectedVersion}`);
  }
  if (button.id === 'reset') { jobs = structuredClone(projects); reviews = {}; draft = null; formValues = null; recruiter = 'r1'; today = initialDate; projectId = 'job-a'; $('#project').value = projectId; render(); notice('已重置'); }
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if (form.id === 'patch-form') preview(form);
  if (form.dataset.review) { const job = currentJob(); const status = new FormData(form).get('status'); if (!['supported', 'unsupported', 'insufficient'].includes(status)) return; reviews[`${job.id}:${form.dataset.review}`] = { jobId: job.id, version: job.version, status, by: names[recruiter] }; render(); notice('已记录'); }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.id === 'project') { projectId = el.value; draft = null; formValues = null; render(); notice(''); }
  if (el.id === 'recruiter') { recruiter = el.value; draft = null; render(); notice(''); }
  if (el.id === 'date') { if (!el.value || !el.validity.valid) { el.value = today; notice('日期无效', true); } else { today = el.value; render(); notice(''); } }
  if (el.id === 'reviewed') $('#commit').disabled = !el.checked;
});
document.addEventListener('input', event => {
  if (event.target.closest('#patch-form') && draft) { draft = null; $('#proposal').innerHTML = ''; notice('请重新预览'); }
});
render();
