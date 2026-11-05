import { escape } from './draft-ui.mjs?v=8';
import { kindLabels } from './data.mjs?v=8';
const labels = { sourcing: '寻访调整', evidence: '材料复核', clarification: '客户待确认' };
function taskRow(task, archived = false) {
  const describe = item => item ? `${item.text} · ${kindLabels[item.kind]}` : '无';
  return `<article class="task-row ${task.done ? 'task-done' : ''}"><label class="check"><input type="checkbox" data-task="${escape(task.id)}" ${task.done ? 'checked' : ''} ${archived ? 'disabled' : ''}><strong>${escape(task.title)}</strong></label><details><summary>查看来源 · v${task.sourceVersion ?? task.version}</summary><blockquote>${escape(task.quote)}</blockquote>${task.before || task.after ? `<p>变更前：${escape(describe(task.before))}</p><p>变更后：${escape(describe(task.after))}</p>` : ''}${task.evidenceQuote ? `<p>材料原文：${escape(task.evidenceQuote)}</p>` : ''}</details></article>`;
}
export function tasksView(job) {
  const tasks = job.tasks || [], completed = tasks.filter(t => t.done).length;
  return `<section class="panel"><div class="panel-head"><h2>影响与待办</h2><span class="counter">v${job.version} · ${completed} / ${tasks.length} 已完成</span></div><div class="panel-body">${tasks.length ? Object.entries(labels).map(([type, label]) => {
    const items = tasks.filter(t => t.type === type); return items.length ? `<section class="task-group"><h3>${label}</h3>${items.map(t => taskRow(t)).join('')}</section>` : '';
  }).join('') : '<p class="empty">暂无待办</p>'}${job.archivedTasks?.length ? `<details class="archived-tasks"><summary>旧版本待办 · 已过期</summary>${job.archivedTasks.map(t => taskRow(t, true)).join('')}</details>` : ''}</div></section>`;
}
