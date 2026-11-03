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
  return `<div class="grid"><section class="panel"><div class="panel-head"><div><p class="section-label">REQUIREMENT PATCH</p><h2>把客户补充，变成一次明确修改</h2></div></div><div class="panel-body"><p class="preset-label">先选一个场景试试</p><div class="presets"><button class="preset" data-preset="add">＋ 增加上线经历</button><button class="preset" data-preset="soften">↘ B 端改为加分项</button><button class="preset" data-preset="remove">− 取消 RAG 条件</button></div>
  <form id="patch-form"><div class="field"><label for="sourceText">客户补充原话</label><textarea name="sourceText" id="sourceText" required maxlength="3000">${escape(v.sourceText)}</textarea></div>
  <div class="two-fields"><div class="field"><label for="target">修改哪条条件</label><select id="target" name="target" class="control">${[...new Map([...projects.find(p => p.id === job.id).criteria.map(i => [i.id, i.text]), ...job.criteria.map(i => [i.id, i.text]), ['launch', '上线经历（新增 / 修改）']])].map(([id, text]) => `<option value="${id}" ${id === v.target ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></div><div class="field"><label for="action">本轮操作</label><select id="action" name="action" class="control"><option value="update" ${v.action === 'update' ? 'selected' : ''}>新增 / 替换</option><option value="remove" ${v.action === 'remove' ? 'selected' : ''}>明确取消</option></select></div></div>
  ${formField('整理后的条件', 'text', v.text, 'maxlength="300"')}<div class="two-fields"><div class="field"><label for="kind">条件分类</label><select id="kind" name="kind" class="control">${Object.entries(kindLabels).map(([key, text]) => `<option value="${key}" ${v.kind === key ? 'selected' : ''}>${text}</option>`).join('')}</select></div>${formField('对应原话摘录', 'quote', v.quote, 'maxlength="1000"')}</div>
  <div class="action-row"><button class="primary" type="submit">查看变更 <span aria-hidden="true">→</span></button><small>先看差异，再由你确认。</small></div></form>
  <div id="proposal">${draft ? proposalView(job) : ''}</div><p class="fineprint">原话和结构化条件由你填写；此处不做自然语言识别，也不调用模型。取消条件时仍需核对客户原话。</p></div></section>
  <aside><section class="panel"><div class="panel-head"><h2>当前岗位档案</h2><span class="counter">v${job.version} · ${job.criteria.length} 条</span></div><div class="panel-body">${criteriaList(job.criteria)}<div class="callout">只处理本次明确修改的条件，其他条件原样保留。</div></div></section>
  <section class="panel subsection"><div class="panel-head"><h2>版本记录</h2><span class="counter">${job.history.length + 1} 个版本</span></div><div class="panel-body timeline">${[...job.history].reverse().map(item => `<div class="history-item"><strong>v${item.fromVersion + 1} · ${escape(item.confirmedBy)} 确认</strong><p>${escape(item.sourceText)}</p><details><summary>查看修改前 v${item.fromVersion} 的条件</summary>${criteriaList(item.previousCriteria)}</details></div>`).join('')}<div class="history-item"><strong>v1 · 初始需求</strong><p>${escape(job.source)}</p></div></div></section></aside></div>`;
}
function proposalView(job) {
  const previous = job.criteria.find(i => i.id === draft.target);
  const action = draft.patch.removeIds.length ? '取消' : previous ? '替换' : '新增';
  return `<section class="proposal"><h3>变更预览 <small>基于 v${draft.patch.expectedVersion}</small></h3><div class="diff-line"><span>${action}</span>${escape(draft.patch.removeIds.length ? previous?.text || draft.target : draft.patch.updates[0].text)}${draft.patch.updates.length ? ' · ' + kindLabels[draft.patch.updates[0].kind] : ''}</div><small>只有这条条件改变，其余条件保留。模拟确认人：${names[recruiter]}</small><label class="check"><input type="checkbox" id="reviewed">我已核对原话、操作与分类</label><div class="action-row"><button id="commit" class="primary" disabled>确认并保存新版本</button><button class="link-button" id="conflict">模拟另一位顾问先保存</button></div></section>`;
}
function memoryView(job) {
  const context = { job: job.id, client: job.clientId, recruiter, today };
  const rows = memories.map(m => ({ ...m, ...memoryDisposition(m, context) }));
  const selected = rows.filter(m => m.included);
  return `<div class="grid"><section class="panel"><div class="panel-head"><div><p class="section-label">SCOPED MEMORY</p><h2>不是所有过去的反馈，都适用于这次</h2></div><span class="counter">${selected.length} / ${rows.length} 条纳入</span></div><div class="panel-body"><div class="toolbar"><div class="field"><label for="recruiter">当前顾问</label><select class="control" id="recruiter">${Object.entries(names).map(([id, name]) => `<option value="${id}" ${recruiter === id ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div class="field"><label for="date">实验日期</label><input id="date" type="date" value="${today}" required min="2020-01-01" max="2099-12-31"></div></div><ul class="memory-list">${rows.map(m => `<li class="memory-row ${m.included ? '' : 'excluded'}"><div class="memory-top"><p class="memory-text">${escape(m.text)}</p><span class="scope-tag">${{ job: '岗位', client: '客户', recruiter: '顾问' }[m.scope]}</span></div><small>${escape(m.owner)} · ${escape(m.source)} · ${m.expiresOn ? '截止 ' + m.expiresOn : '未设截止日'}</small><p class="reason">${m.included ? '✓ 纳入' : '− 排除'} · ${m.reason}</p></li>`).join('')}</ul></div></section>
  <aside class="panel"><div class="panel-head"><h2>本轮上下文</h2><span class="counter">v${job.version}</span></div><div class="panel-body"><p class="fineprint" style="margin-top:0">先过滤适用范围，再提供给助手。</p><div class="context-block"><h3>已确认的岗位条件</h3><ul>${job.criteria.map(i => `<li>${escape(i.text)} · ${kindLabels[i.kind]}</li>`).join('')}</ul></div><div class="context-block"><h3>历史建议 · 不自动升级为岗位要求</h3>${selected.length ? `<ul>${selected.map(m => `<li>${escape(m.text)}</li>`).join('')}</ul>` : '<p class="empty">当前没有适用的历史建议。</p>'}</div><div class="callout warm">切换顶部项目，看另一客户的偏好被排除；再把日期改到 2026-10-31 或 2027-02-01，观察有效期变化。</div><p class="fineprint">截止日当天仍有效。此处演示上下文过滤，不代表已实现账号权限或组织隔离。</p></div></aside></div>`;
}
function evidenceView(job) {
  return `<div class="evidence-note"><p>同一份虚构材料中，分别核对两条判断。原文存在，不等于推论成立。</p><span class="counter">当前岗位 v${job.version}</span></div><div class="evidence-grid">${evidence.map(item => {
    const review = reviews[`${job.id}:${item.id}`];
    const status = reviewState(review, job);
    const criterion = job.criteria.find(c => c.id === item.criterionId);
    return `<article class="panel evidence-card"><div class="panel-head"><div><p class="section-label">EVIDENCE ${item.id === 'e1' ? '01' : '02'}</p><h2>${item.title}</h2></div><span class="badge ${status === 'supported' ? '' : 'preferred'}">${reviewLabels[status]}</span></div><div class="panel-body"><small>${item.source}</small><blockquote>“${escape(item.quote)}”</blockquote><dl><div class="analysis-row"><dt>待核实判断</dt><dd>${escape(item.inference)}</dd></div><div class="analysis-row"><dt>仍然缺什么</dt><dd>${escape(item.gap)}</dd></div><div class="analysis-row"><dt>当前条件</dt><dd>${criterion ? escape(criterion.text) + ' · ' + kindLabels[criterion.kind] : '此条件已取消；不再作为当前筛选要求'}</dd></div></dl><form class="review-box" data-review="${item.id}"><label for="review-${item.id}">你的复核结论</label><select id="review-${item.id}" name="status" class="control" required><option value="">选择结论</option>${['supported', 'unsupported', 'insufficient'].map(s => `<option value="${s}">${reviewLabels[s]}</option>`).join('')}</select><div class="action-row"><button class="primary" type="submit">记录复核</button><small>模拟确认人 · ${names[recruiter]}</small></div></form><p class="review-note">${review ? `上次记录：v${review.version} · ${reviewLabels[review.status]} · ${escape(review.by)}${status === 'stale' ? '。岗位已修改，请重新核对。' : ''}` : '尚未记录。本页只保存你的判断，不会自动验证材料真实性。'}</p></div></article>`;
  }).join('')}</div><div class="callout warm">试着复核一张卡片，再回到「岗位修订」保存一次修改。这些判断会标为「需重新复核」，避免旧结论沿用到新需求。</div>`;
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
  try { applyChange(currentJob(), patch); draft = { patch, target: v.target }; render(); notice('预览已就绪。请核对后勾选确认。'); }
  catch (error) { draft = null; $('#proposal').innerHTML = ''; notice(error.message, true); }
}
function saveDraft() {
  if (!draft || !$('#reviewed')?.checked) return;
  try { const next = applyChange(currentJob(), draft.patch); jobs = jobs.map(j => j.id === next.id ? next : j); draft = null; render(); notice(`已保存为 v${next.version}。其他条件保留，相关证据需要重新复核。`); }
  catch (error) { notice(error.message, true); }
}
function preset(name) {
  formValues = name === 'add' ? defaultForm() : name === 'soften' ? { sourceText: 'B 端产品经验改为加分项，其他要求不变。', target: 'b2b', text: '具备 B 端产品经验', kind: 'preferred', quote: 'B 端产品经验改为加分项', action: 'update' } : { sourceText: '这次取消 RAG 应用经历要求，其他条件不变。', target: 'rag', text: '参与过 RAG 应用', kind: 'preferred', quote: '取消 RAG 应用经历要求', action: 'remove' };
  draft = null; render(); notice('场景已填入，你可以修改后查看变更。');
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.tab) { tab = button.dataset.tab; render(); notice(''); }
  if (button.dataset.preset) preset(button.dataset.preset);
  if (button.id === 'commit') saveDraft();
  if (button.id === 'conflict' && draft) {
    const job = currentJob(); const sourceText = '工作地点为上海，其他要求不变。';
    const next = applyChange(job, { expectedVersion: job.version, sourceText, confirmedBy: '另一位顾问（模拟）', updates: [{ id: 'city', text: '工作地点为上海', kind: 'required', quote: '工作地点为上海' }], removeIds: [] });
    jobs = jobs.map(j => j.id === next.id ? next : j); render(); notice(`另一位顾问已保存 v${next.version}。你的草稿仍基于 v${draft.patch.expectedVersion}，勾选后尝试提交。`);
  }
  if (button.id === 'reset') { jobs = structuredClone(projects); reviews = {}; draft = null; formValues = null; recruiter = 'r1'; today = initialDate; projectId = 'job-a'; $('#project').value = projectId; render(); notice('实验已重置。'); }
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if (form.id === 'patch-form') preview(form);
  if (form.dataset.review) { const job = currentJob(); const status = new FormData(form).get('status'); if (!['supported', 'unsupported', 'insufficient'].includes(status)) return; reviews[`${job.id}:${form.dataset.review}`] = { jobId: job.id, version: job.version, status, by: names[recruiter] }; render(); notice(`已记录你的复核结论，绑定当前 v${job.version}。`); }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.id === 'project') { projectId = el.value; draft = null; formValues = null; render(); notice('已切换项目。'); }
  if (el.id === 'recruiter') { recruiter = el.value; draft = null; render(); notice('已重新筛选适用于当前顾问的记录。'); }
  if (el.id === 'date') { if (!el.value || !el.validity.valid) { el.value = today; notice('请选择 2020—2099 年的有效日期。', true); } else { today = el.value; render(); notice('已按所选日期重新筛选。'); } }
  if (el.id === 'reviewed') $('#commit').disabled = !el.checked;
});
document.addEventListener('input', event => {
  if (event.target.closest('#patch-form') && draft) { draft = null; $('#proposal').innerHTML = ''; notice('内容已修改，请重新查看变更。'); }
});
render();
