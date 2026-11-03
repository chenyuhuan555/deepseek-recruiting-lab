import test from 'node:test';
import assert from 'node:assert/strict';
import { applyChange, memoryDisposition, reviewState } from './rules.mjs';

const job = { id: 'a', version: 1, criteria: [{ id: 'b2b', text: 'B端经验', kind: 'required', quote: 'B端经验' }], history: [] };
const patch = { expectedVersion: 1, sourceText: '主导过上线', updates: [{ id: 'launch', text: '主导过上线', kind: 'preferred', quote: '主导过上线' }], removeIds: [], confirmedBy: '顾问甲' };
test('new condition preserves the previous immutable snapshot and its classification', () => {
  const result = applyChange(job, patch);
  assert.equal(result.version, 2);
  assert.equal(result.criteria.length, 2);
  assert.equal(result.criteria[1].kind, 'preferred');
  assert.equal(job.criteria.length, 1);
  assert.deepEqual(result.history[0].previousCriteria, job.criteria);
});
test('stale draft cannot overwrite the current version', () => assert.throws(() => applyChange({ ...job, version: 2 }, patch), /版本/));
test('source and reviewer are required', () => {
  assert.throws(() => applyChange(job, { ...patch, confirmedBy: ' ' }), /确认/);
  assert.throws(() => applyChange(job, { ...patch, sourceText: '另一段话' }), /摘录/);
});
test('duplicate, unsupported and conflicting updates are rejected', () => {
  assert.throws(() => applyChange(job, { ...patch, updates: [...patch.updates, ...patch.updates] }), /重复/);
  assert.throws(() => applyChange(job, { ...patch, updates: [{ ...patch.updates[0], kind: 'other' }] }), /分类/);
  assert.throws(() => applyChange(job, { ...patch, removeIds: ['launch'] }), /冲突/);
});
test('only explicit known conditions may be removed', () => {
  assert.equal(applyChange(job, { ...patch, updates: [], removeIds: ['b2b'] }).criteria.length, 0);
  assert.throws(() => applyChange(job, { ...patch, removeIds: ['unknown'] }), /不存在/);
});
const context = { job: 'a', client: 'client-a', recruiter: 'r1', today: '2026-11-03' };
const memory = { scope: 'client', ownerId: 'client-a', confirmedBy: '甲', expiresOn: '2026-11-03' };
test('matching memory includes the expiration day', () => assert.equal(memoryDisposition(memory, context).included, true));
test('other client, expired, draft and unknown scope are excluded', () => {
  for (const change of [{ ownerId: 'client-b' }, { expiresOn: '2026-11-02' }, { confirmedBy: '' }, { scope: 'other' }]) {
    assert.equal(memoryDisposition({ ...memory, ...change }, context).included, false);
  }
});
test('review belongs to a job version and must be redone after requirements change', () => {
  assert.equal(reviewState({ jobId: 'a', version: 1, status: 'supported' }, job), 'supported');
  assert.equal(reviewState({ jobId: 'a', version: 1, status: 'supported' }, { ...job, version: 2 }), 'stale');
  assert.equal(reviewState(null, job), 'pending');
  assert.equal(reviewState({ jobId: 'b', version: 1, status: 'supported' }, job), 'pending');
});
