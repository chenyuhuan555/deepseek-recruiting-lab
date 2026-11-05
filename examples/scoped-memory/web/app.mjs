import { applyChange, memoryDisposition, reviewState } from './rules.mjs';
import { projects, memories, evidence, kindLabels, reviewLabels } from './data.mjs?v=8';
import { escape, defaultFeedback, generatedView, collectDraft, questionList } from './draft-ui.mjs?v=8';
import { patchFromDraft } from './draft-domain.mjs?v=8';
import { tasksView } from './tasks-ui.mjs?v=8';

const $ = selector => document.querySelector(selector);
const names = { r1: '顾问林', r2: '顾问周' };
let jobs = [], projectId = 'job-a', tab = 'revision', recruiter = 'r1', busy = false, loaded = false;
const localDate = new Date();
const initialDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
let today = initialDate, draft = null, formValues = null, reviews = {};
let generation = null;
const feedbacks = new Map();
const currentJob = () => jobs.find(job => job.id === projectId);
const defaultForm = () => ({ sourceText: '必须主导过产品上线，原来其他条件不变。', target: 'launch', text: '主导过产品上线', kind: 'required', quote: '必须主导过产品上线', action: 'update' });
const notice = (text, error = false) => { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); };
const badge = kind => `<span class="badge ${kind}">${kindLabels[kind]}</span>`;
async function api(path, data) {
  const response = await fetch('/api/' + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(20000) });
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('服务不可用，请重新登录');
  const result = await response.json(); if (!response.ok) throw new Error(result.error || '保存失败'); return result;
}
function lock(value) {
  busy = value; $('#workspace').disabled = value || !loaded;
  document.querySelectorAll('.contextbar button, .contextbar select, .tab').forEach(el => el.disabled = value || !loaded);
  $('#reload').disabled = value;
}
function acceptJob(job) {
  jobs = jobs.map(j => j.id === job.id ? job : j);
  Object.entries(job.reviews || {}).forEach(([id, review]) => reviews[`${job.id}:${id}`] = review);
}
async function loadWorkspace() {
  if (busy) return; cancelGeneration(); lock(true); notice('正在加载');
  try {
    const result = await api('workspace', {}); jobs = result.jobs; loaded = true; draft = null; reviews = {};
    jobs.forEach(acceptJob); render(); notice('');
  } catch (error) { notice(error.message, true); }
  finally { lock(false); }
}
function criteriaList(items) {
  return `<ul class="criteria">${items.map(item => `<li class="criterion"><div class="criterion-title"><strong>${escape(item.text)}</strong>${badge(item.kind)}</div><small>原话「${escape(item.quote)}」</small></li>`).join('')}</ul>`;
}
function formField(label, name, value, extra = '') {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${escape(value)}" ${extra}></div>`;
}
function revisionView(job) {
  const v = formValues || defaultForm();
  return `<div class="grid"><section class="panel"><div class="panel-head"><h2>客户反馈</h2></div><div class="panel-body">
  <form id="feedback-form"><div class="field"><label for="feedbackText">客户原话</label><textarea id="feedbackText" name="feedbackText" required maxlength="3000">${escape(feedbacks.get(job.id) ?? defaultFeedback)}</textarea></div><button class="primary" id="generate" type="submit" ${generation ? 'disabled' : ''}>${generation ? '生成中…' : '生成草稿'}</button></form>
  <details class="manual-edit"><summary>手动修改</summary><div class="presets"><button class="preset" data-preset="add">增加上线经历</button><button class="preset" data-preset="soften">B 端改为加分项</button><button class="preset" data-preset="remove">取消 RAG 条件</button></div>
  <form id="patch-form"><div class="field"><label for="sourceText">客户原话</label><textarea name="sourceText" id="sourceText" required maxlength="3000">${escape(v.sourceText)}</textarea></div>
  <div class="two-fields"><div class="field"><label for="target">条件</label><select id="target" name="target" class="control">${[...new Map([...projects.find(p => p.id === job.id).criteria.map(i => [i.id, i.text]), ...job.criteria.map(i => [i.id, i.text]), ['launch', '上线经历（新增 / 修改）']])].map(([id, text]) => `<option value="${id}" ${id === v.target ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></div><div class="field"><label for="action">操作</label><select id="action" name="action" class="control"><option value="update" ${v.action === 'update' ? 'selected' : ''}>新增 / 替换</option><option value="remove" ${v.action === 'remove' ? 'selected' : ''}>明确取消</option></select></div></div>
  ${formField('条件内容', 'text', v.text, 'maxlength="300"')}<div class="two-fields"><div class="field"><label for="kind">分类</label><select id="kind" name="kind" class="control">${Object.entries(kindLabels).map(([key, text]) => `<option value="${key}" ${v.kind === key ? 'selected' : ''}>${text}</option>`).join('')}</select></div>${formField('原文摘录', 'quote', v.quote, 'maxlength="1000"')}</div>
  <div class="action-row"><button class="primary" type="submit">查看变更</button></div></form></details>
  <div id="proposal">${draft ? proposalView(job) : ''}</div></div></section>
  <aside><section class="panel"><div class="panel-head"><h2>岗位档案</h2><span class="counter">v${job.version} · ${job.criteria.length} 条</span></div><div class="panel-body">${criteriaList(job.criteria)}${questionList(job.questions)}</div></section>
  <section class="panel subsection"><div class="panel-head"><h2>版本记录</h2><span class="counter">${job.history.length + 1} 个版本</span></div><div class="panel-body timeline">${[...job.history].reverse().map(item => `<div class="history-item"><strong>v${item.fromVersion + 1} · ${escape(item.confirmedBy)} 确认</strong><p>${escape(item.sourceText)}</p><details><summary>查看修改前 v${item.fromVersion} 的条件</summary>${criteriaList(item.previousCriteria)}${questionList(item.previousQuestions)}</details></div>`).join('')}<div class="history-item"><strong>v1 · 初始需求</strong><p>${escape(job.source)}</p></div></div></section></aside></div>`;
}
function proposalView(job) {
  if (draft.kind === 'generated') return generatedView(draft, job);
  const previous = job.criteria.find(i => i.id === draft.target);
  const action = draft.patch.removeIds.length ? '取消' : previous ? '替换' : '新增';
  return `<section class="proposal"><h3>变更预览 <small>v${draft.patch.expectedVersion}</small></h3><div class="diff-line"><span>${action}</span>${escape(draft.patch.removeIds.length ? previous?.text || draft.target : draft.patch.updates[0].text)}${draft.patch.updates.length ? ' · ' + kindLabels[draft.patch.updates[0].kind] : ''}</div><label class="check"><input type="checkbox" id="reviewed">确认变更</label><div class="action-row"><button id="commit" class="primary" disabled>保存</button></div></section>`;
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
  if (!loaded) { $('#workspace').textContent = ''; return; }
  const job = currentJob();
  $('#job-version').textContent = `v${job.version}`;
  document.querySelectorAll('.tab').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#workspace').innerHTML = tab === 'revision' ? revisionView(job) : tab === 'memory' ? memoryView(job) : tab === 'tasks' ? tasksView(job) : evidenceView(job);
}
function preview(form) {
  cancelGeneration();
  formValues = Object.fromEntries(new FormData(form));
  const v = formValues;
  const patch = { expectedVersion: currentJob().version, sourceText: v.sourceText, confirmedBy: names[recruiter], updates: v.action === 'remove' ? [] : [{ id: v.target, text: v.text, kind: v.kind, quote: v.quote }], removeIds: v.action === 'remove' ? [v.target] : [] };
  try { applyChange(currentJob(), patch); draft = { patch, target: v.target }; render(); notice(''); }
  catch (error) { draft = null; $('#proposal').innerHTML = ''; notice(error.message, true); }
}
async function saveDraft() {
  if (busy || !draft || !$('#reviewed')?.checked) return;
  let payload, id;
  try {
    const job = currentJob();
    id = job.id;
    if (job.version !== draft.patch.expectedVersion) throw new Error('岗位版本已变化，请重新生成草稿');
    let patch = draft.patch, questions = [];
    if (draft.kind === 'generated') {
      const edited = collectDraft($('#proposal'), draft, job);
      if (!edited.changes.length && !edited.questions.length) throw new Error('没有待保存的变更');
      patch = patchFromDraft(edited, { job, sourceText: draft.sourceText, confirmedBy: names[recruiter] });
      questions = edited.questions;
    }
    const edited = draft.kind === 'generated' ? collectDraft($('#proposal'), draft, job) : { changes: [...patch.updates.map(c => ({ ...c, operation: job.criteria.some(old => old.id === c.id) ? 'update' : 'add' })), ...patch.removeIds.map(id => ({ operation: 'remove', id, quote: formValues.quote }))], questions };
    payload = { expectedVersion: patch.expectedVersion, sourceText: patch.sourceText, confirmedBy: patch.confirmedBy, ...edited };
  }
  catch (error) { notice(error.message, true); return; }
  lock(true); notice('正在保存');
  try { const result = await api(`jobs/${id}/revisions`, payload); acceptJob(result.job); draft = null; render(); notice(`已保存 v${result.job.version}`); }
  catch (error) { notice(error.message, true); }
  finally { lock(false); }
}
function preset(name) {
  cancelGeneration();
  formValues = name === 'add' ? defaultForm() : name === 'soften' ? { sourceText: 'B 端产品经验改为加分项，其他要求不变。', target: 'b2b', text: '具备 B 端产品经验', kind: 'preferred', quote: 'B 端产品经验改为加分项', action: 'update' } : { sourceText: '这次取消 RAG 应用经历要求，其他条件不变。', target: 'rag', text: '参与过 RAG 应用', kind: 'preferred', quote: '取消 RAG 应用经历要求', action: 'remove' };
  draft = null; render(); $('#patch-form')?.closest('details')?.setAttribute('open', ''); notice('');
}

function cancelGeneration() {
  generation?.controller.abort(); generation = null;
}
async function generate() {
  if (generation) return;
  const sourceText = $('#feedbackText').value.trim();
  if (!sourceText) { notice('请填写客户反馈', true); return; }
  const job = structuredClone(currentJob());
  feedbacks.set(job.id, sourceText); draft = null;
  const pending = { controller: new AbortController() }; generation = pending; render(); notice('');
  const timeout = setTimeout(() => pending.controller.abort('timeout'), 65000);
  try {
    const response = await fetch('/api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job: { id: job.id, version: job.version, criteria: job.criteria }, sourceText }), signal: pending.controller.signal });
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('服务不可用，请重新登录');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '生成失败，请重试');
    if (generation !== pending) return;
    if (currentJob().id !== job.id || currentJob().version !== job.version || result.jobId !== job.id || result.baseVersion !== job.version) throw new Error('岗位已变化，请重新生成');
    draft = { ...result, kind: 'generated', sourceText, patch: patchFromDraft(result, { job, sourceText, confirmedBy: names[recruiter] }) };
  } catch (error) {
    if (generation === pending) notice(pending.controller.signal.aborted ? '生成超时，请重试' : error.message, true);
  } finally { clearTimeout(timeout); if (generation === pending) { generation = null; render(); } }
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.id === 'reload') { loadWorkspace(); return; }
  if (busy || !loaded) return;
  if (button.dataset.tab) { cancelGeneration(); tab = button.dataset.tab; render(); notice(''); }
  if (button.dataset.preset) preset(button.dataset.preset);
  if (button.id === 'commit') saveDraft();
  if (button.id === 'reset') { cancelGeneration(); feedbacks.set(projectId, ''); draft = null; formValues = null; render(); notice('已清空输入'); }
});
document.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target;
  if (busy || !loaded) return;
  if (form.id === 'patch-form') preview(form);
  if (form.id === 'feedback-form') generate();
  if (form.dataset.review) { const job = currentJob(); const status = new FormData(form).get('status'); if (!['supported', 'unsupported', 'insufficient'].includes(status)) return; lock(true); try { const result = await api(`jobs/${job.id}/reviews`, { version: job.version, evidenceId: form.dataset.review, status, by: names[recruiter] }); acceptJob(result.job); render(); notice('已记录'); } catch (error) { notice(error.message, true); } finally { lock(false); } }
});
document.addEventListener('change', async event => {
  const el = event.target;
  if (busy || !loaded) return;
  if (el.dataset.task) {
    const job = currentJob(); lock(true);
    try { const result = await api(`jobs/${job.id}/tasks`, { version: job.version, id: el.dataset.task, done: el.checked }); acceptJob(result.job); render(); notice('已保存'); }
    catch (error) { el.checked = !el.checked; notice(error.message, true); } finally { lock(false); }
  }
  if (el.id === 'project') { cancelGeneration(); projectId = el.value; draft = null; formValues = null; render(); notice(''); }
  if (el.id === 'recruiter') { recruiter = el.value; draft = null; render(); notice(''); }
  if (el.id === 'date') { if (!el.value || !el.validity.valid) { el.value = today; notice('日期无效', true); } else { today = el.value; render(); notice(''); } }
  if (el.id === 'reviewed') $('#commit').disabled = !el.checked;
});
document.addEventListener('input', event => {
  if (event.target.closest('#patch-form')) {
    formValues = Object.fromEntries(new FormData($('#patch-form')));
    cancelGeneration();
    const button = $('#generate'); if (button) { button.disabled = false; button.textContent = '生成草稿'; }
  }
  if (event.target.id === 'feedbackText') {
    feedbacks.set(projectId, event.target.value); cancelGeneration();
    if (draft) { draft = null; $('#proposal').innerHTML = ''; }
    const button = $('#generate'); if (button) { button.disabled = false; button.textContent = '生成草稿'; }
  }
  if (event.target.closest('#proposal') && event.target.id !== 'reviewed' && $('#reviewed')) { $('#reviewed').checked = false; $('#commit').disabled = true; }
  if (event.target.closest('#patch-form') && draft) { draft = null; $('#proposal').innerHTML = ''; notice('请重新预览'); }
});
render();
loadWorkspace();
