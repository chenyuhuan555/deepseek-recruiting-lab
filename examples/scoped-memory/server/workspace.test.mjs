import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLocalDb } from './local-db.mjs';
import { bootstrap, listJobs, saveRevision, setTask, saveReview } from './workspace.mjs';

const change = (version = 1) => ({ expectedVersion: version, sourceText: 'B 端产品经验改为加分项。城市可以放宽。', confirmedBy: '顾问林', changes: [{ operation: 'update', id: 'b2b', text: '具备 B 端产品经验', kind: 'preferred', quote: 'B 端产品经验改为加分项' }], questions: [{ criterionId: 'city', text: '城市放宽到哪些地方？', quote: '城市可以放宽' }] });
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'memory-versions-')); const file = join(dir, 'test.sqlite'); let db = await openLocalDb(file);
  t.after(async () => { db.close(); await rm(dir, { recursive: true, force: true }); });
  await bootstrap(db);
  return { get db() { return db; }, reopen: async () => { db.close(); db = await openLocalDb(file); } };
}
test('saved requirements, questions, history and task status survive reopening', async t => {
  const f = await fixture(t); const result = await saveRevision(f.db, 'job-a', change());
  assert.equal(result.version, 2); assert.equal(result.criteria.find(c => c.id === 'rag').kind, 'preferred');
  assert.equal(result.questions.length, 1); assert.ok(result.tasks.some(x => x.type === 'sourcing')); assert.ok(result.tasks.some(x => x.type === 'evidence'));
  await setTask(f.db, 'job-a', { version: 2, id: result.tasks[0].id, done: true }); await f.reopen();
  const job = (await listJobs(f.db)).find(x => x.id === 'job-a'); assert.equal(job.version, 2); assert.equal(job.tasks[0].done, true);
  assert.equal(job.history[0].previousCriteria.find(x => x.id === 'b2b').kind, 'required'); assert.equal(job.questions[0].quote, '城市可以放宽');
  await bootstrap(f.db); assert.equal((await listJobs(f.db))[0].version, 2);
});
test('concurrent stale saves cannot overwrite a version or duplicate tasks', async t => {
  const f = await fixture(t); const results = await Promise.allSettled([saveRevision(f.db, 'job-a', change()), saveRevision(f.db, 'job-a', change())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal((await listJobs(f.db)).find(x => x.id === 'job-a').history.length, 1);
});
test('invented evidence and unknown jobs do not create versions', async t => {
  const f = await fixture(t); const invalid = change(); invalid.questions[0].quote = '虚构原话';
  await assert.rejects(saveRevision(f.db, 'job-a', invalid)); await assert.rejects(saveRevision(f.db, 'missing', change()), e => e.status === 404);
  assert.equal((await listJobs(f.db))[0].version, 1);
});
test('old tasks become obsolete and cannot be completed for a newer job', async t => {
  const f = await fixture(t); const v2 = await saveRevision(f.db, 'job-a', change());
  await saveRevision(f.db, 'job-a', { ...change(2), sourceText: '必须主导上线', changes: [{ operation: 'add', text: '主导上线', kind: 'required', quote: '必须主导上线' }], questions: [] });
  await assert.rejects(setTask(f.db, 'job-a', { version: 2, id: v2.tasks[0].id, done: true }), e => e.status === 409);
  const other = (await listJobs(f.db)).find(x => x.id === 'job-b'); assert.equal(other.version, 1); assert.equal(other.tasks.length, 0);
});
test('evidence review persists and rejects unknown evidence or stale versions', async t => {
  const f = await fixture(t); await saveReview(f.db, 'job-a', { version: 1, evidenceId: 'e1', status: 'supported', by: '顾问林' }); await f.reopen();
  const job = (await listJobs(f.db))[0]; assert.equal(job.reviews.e1.status, 'supported');
  await assert.rejects(saveReview(f.db, 'job-a', { version: 1, evidenceId: 'invented', status: 'supported', by: '顾问林' }));
});
test('unaffected tasks and their completion carry into a later version', async t => {
  const f = await fixture(t); const job = await saveRevision(f.db, 'job-a', change());
  const task = job.tasks.find(t => t.type === 'sourcing'); await setTask(f.db, job.id, { version: 2, id: task.id, done: true });
  const question = job.tasks.find(t => t.type === 'clarification'); await setTask(f.db, job.id, { version: 2, id: question.id, done: true });
  const next = await saveRevision(f.db, job.id, { ...change(2), sourceText: '必须主导上线', changes: [{ operation: 'add', text: '主导上线', kind: 'required', quote: '必须主导上线' }], questions: [] });
  assert.equal(next.tasks.find(t => t.id === task.id)?.done, true); assert.equal(next.tasks.find(t => t.id === task.id).sourceVersion, 2);
  assert.equal(next.tasks.find(t => t.type === 'clarification').done, true);
});
