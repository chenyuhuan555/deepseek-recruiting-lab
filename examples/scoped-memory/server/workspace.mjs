import { projects, evidence } from '../web/data.mjs';
import { applyChange } from '../web/rules.mjs';
import { validateDraft, validateInput, patchFromDraft } from './draft-domain.mjs';
import { buildImpact } from '../web/impact.mjs';

export class WorkspaceError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const json = JSON.stringify;
async function rows(db, sql, ...values) { return (await db.prepare(sql).bind(...values).all()).results; }
async function current(db, id) {
  const row = await db.prepare('SELECT snapshot FROM job_versions WHERE job_id=? ORDER BY version DESC LIMIT 1').bind(id).first();
  if (!row) throw new WorkspaceError('岗位不存在', 404);
  const job = JSON.parse(row.snapshot);
  const states = await rows(db, 'SELECT task_id,done FROM task_states WHERE job_id=? AND version=?', id, job.version);
  job.tasks = job.tasks.map(t => ({ ...t, done: Boolean(states.find(s => s.task_id === t.id)?.done ?? t.done) }));
  return job;
}
function version(job, expected) { if (expected !== job.version) throw new WorkspaceError('岗位版本已变化，请重新加载后核对', 409); }
function text(value, label, max = 100) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new WorkspaceError(`${label}无效`); return value.trim(); }
export async function bootstrap(db) {
  for (const job of projects) await db.prepare('INSERT OR IGNORE INTO job_versions (job_id,version,snapshot,created_at) VALUES (?,?,?,?)').bind(job.id, 1, json({ ...job, questions: [], tasks: [] }), new Date().toISOString()).run();
  return listJobs(db);
}
export async function listJobs(db) {
  const versions = await rows(db, 'SELECT snapshot,created_at FROM job_versions ORDER BY job_id,version');
  const states = await rows(db, 'SELECT * FROM task_states'); const reviews = await rows(db, 'SELECT * FROM evidence_reviews');
  const groups = new Map();
  for (const row of versions) { const snapshot = { ...JSON.parse(row.snapshot), savedAt: row.created_at }; if (!groups.has(snapshot.id)) groups.set(snapshot.id, []); groups.get(snapshot.id).push(snapshot); }
  return [...groups.values()].map(history => {
    const latest = structuredClone(history.at(-1));
    latest.history = history.slice(1).map((j, i) => ({ fromVersion: j.version - 1, sourceText: j.revision.sourceText, confirmedBy: j.revision.confirmedBy, previousCriteria: history[i].criteria, previousQuestions: history[i].questions, questions: j.questions, changes: j.revision.changes, tasks: j.tasks, savedAt: j.savedAt }));
    latest.tasks = latest.tasks.map(task => ({ ...task, done: Boolean(states.find(s => s.job_id === latest.id && s.version === latest.version && s.task_id === task.id)?.done ?? task.done) }));
    latest.reviews = Object.fromEntries(reviews.filter(r => r.job_id === latest.id).map(r => [r.evidence_id, { jobId: r.job_id, version: r.version, status: r.status, by: r.reviewer }]));
    latest.archivedTasks = history.slice(0, -1).flatMap(j => j.tasks.map(task => ({ ...task, done: Boolean(states.find(s => s.job_id === j.id && s.version === j.version && s.task_id === task.id)?.done ?? task.done), obsolete: true })));
    return latest;
  });
}
export async function saveRevision(db, id, input) {
  const job = await current(db, id); version(job, input?.expectedVersion);
  const sourceText = text(input.sourceText, '客户原话', 3000), confirmedBy = text(input.confirmedBy, '确认人');
  let validated;
  try { validated = validateDraft(input, validateInput({ job, sourceText })); } catch (error) { throw new WorkspaceError(error.message); }
  if (!validated.changes.length && !validated.questions.length) throw new WorkspaceError('没有待保存的变更');
  const next = applyChange({ ...job, history: [] }, patchFromDraft(validated, { job, sourceText, confirmedBy }));
  const changed = new Set(validated.changes.map(c => c.id));
  next.questions = [...new Map([...(job.questions || []).filter(q => !changed.has(q.criterionId)), ...validated.questions.map(q => ({ ...q, sourceVersion: next.version }))].map(q => [q.text + q.quote, q])).values()];
  next.tasks = [...job.tasks.filter(t => t.type !== 'clarification' && !changed.has(t.criterionId)).map(t => ({ ...t, version: next.version, sourceVersion: t.sourceVersion ?? t.version })), ...buildImpact(job, next, validated.changes, next.questions)];
  for (const task of next.tasks.filter(t => t.type === 'clarification')) {
    const previous = job.tasks.find(t => t.type === 'clarification' && t.title === task.title && t.quote === task.quote && !changed.has(t.criterionId));
    if (previous) task.done = previous.done;
  }
  next.revision = { sourceText, confirmedBy, changes: validated.changes }; delete next.history;
  try {
    await db.prepare('INSERT INTO job_versions (job_id,version,snapshot,created_at) VALUES (?,?,?,?)').bind(id, next.version, json(next), new Date().toISOString()).run();
  } catch (error) { if (/UNIQUE|constraint.*job_versions/i.test(error.message)) throw new WorkspaceError('岗位版本已变化，请重新加载后核对', 409); throw error; }
  return (await listJobs(db)).find(j => j.id === id);
}
export async function setTask(db, id, input) {
  const job = await current(db, id); version(job, input?.version);
  if (typeof input.done !== 'boolean' || !job.tasks.some(t => t.id === input.id)) throw new WorkspaceError('待办无效');
  // The version guard remains inside the write statement to close the concurrent-save window.
  const result = await db.prepare('INSERT INTO task_states (job_id,version,task_id,done,updated_at) SELECT ?,?,?,?,? WHERE (SELECT MAX(version) FROM job_versions WHERE job_id=?)=? ON CONFLICT(job_id,version,task_id) DO UPDATE SET done=excluded.done,updated_at=excluded.updated_at').bind(id, input.version, input.id, Number(input.done), new Date().toISOString(), id, input.version).run();
  if (!result.meta.changes) throw new WorkspaceError('岗位版本已变化，请重新加载后核对', 409);
  return (await listJobs(db)).find(j => j.id === id);
}
export async function saveReview(db, id, input) {
  const job = await current(db, id); version(job, input?.version);
  if (!evidence.some(e => e.id === input.evidenceId) || !['supported', 'unsupported', 'insufficient'].includes(input.status)) throw new WorkspaceError('复核无效');
  const by = text(input.by, '复核人');
  const result = await db.prepare('INSERT INTO evidence_reviews (job_id,evidence_id,version,status,reviewer) SELECT ?,?,?,?,? WHERE (SELECT MAX(version) FROM job_versions WHERE job_id=?)=? ON CONFLICT(job_id,evidence_id) DO UPDATE SET version=excluded.version,status=excluded.status,reviewer=excluded.reviewer').bind(id, input.evidenceId, input.version, input.status, by, id, input.version).run();
  if (!result.meta.changes) throw new WorkspaceError('岗位版本已变化，请重新加载后核对', 409);
  return (await listJobs(db)).find(j => j.id === id);
}
