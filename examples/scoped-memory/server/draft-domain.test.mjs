import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, validateDraft, patchFromDraft } from './draft-domain.mjs';
import { applyChange } from '../web/rules.mjs';

const job = { id: 'job-a', version: 1, criteria: [
  { id: 'b2b', text: 'B端产品经验', kind: 'required', quote: 'B端产品经验' },
  { id: 'rag', text: '参与过RAG应用', kind: 'preferred', quote: 'RAG是加分项' },
], history: [] };
const sourceText = '必须主导过产品上线，城市可以放宽';
const response = () => ({ changes: [{ operation: 'add', id: '', text: '主导过产品上线', kind: 'required', quote: '必须主导过产品上线' }], questions: [{ text: '可以接受哪些城市？', quote: '城市可以放宽', criterionId: null }] });
test('validated draft preserves existing conditions and carries questions separately', () => {
  const draft = validateDraft(response(), { job, sourceText });
  const patch = patchFromDraft(draft, { job, sourceText, confirmedBy: '顾问林' });
  const next = applyChange(job, patch);
  assert.equal(next.criteria.length, 3);
  assert.deepEqual(next.criteria.slice(0, 2), job.criteria);
  assert.equal(draft.questions.length, 1);
  assert.equal(patch.updates[0].kind, 'required');
});
test('request rejects missing source, invalid versions and untrusted field shapes', () => {
  assert.throws(() => validateInput({ job, sourceText: '' }), /反馈/);
  assert.throws(() => validateInput({ job: { ...job, version: 0 }, sourceText }), /版本/);
  assert.throws(() => validateInput({ job: { ...job, criteria: [{}] }, sourceText }), /条件/);
  assert.throws(() => validateInput({ job, sourceText: 'x'.repeat(3001) }), /反馈/);
});
test('model cannot invent evidence or remove an unknown condition', () => {
  const bad = response(); bad.changes[0].quote = '客户没有说过这句';
  assert.throws(() => validateDraft(bad, { job, sourceText }), /原文/);
  assert.throws(() => validateDraft({ changes: [{ operation: 'remove', id: 'missing', quote: sourceText }], questions: [] }, { job, sourceText }), /不存在/);
});
test('existing condition cannot be changed twice in the same draft', () => {
  const change = { operation: 'update', id: 'rag', text: '参与过RAG应用', kind: 'required', quote: sourceText };
  assert.throws(() => validateDraft({ changes: [change, change], questions: [] }, { job, sourceText }), /重复/);
});
test('ambiguous criterion referenced by a question is not applied', () => {
  const raw = { changes: [{ operation: 'remove', id: 'rag', quote: sourceText }], questions: [{ text: '是否取消RAG？', quote: sourceText, criterionId: 'rag' }] };
  const draft = validateDraft(raw, { job, sourceText });
  assert.equal(draft.changes.length, 0);
  assert.equal(draft.questions.length, 1);
});
test('identical update is omitted and source-less questions are rejected', () => {
  const raw = { changes: [{ ...job.criteria[1], operation: 'update', quote: sourceText }], questions: [] };
  assert.equal(validateDraft(raw, { job, sourceText }).changes.length, 0);
  assert.throws(() => validateDraft({ changes: [], questions: [{ text: '问题', quote: '未出现', criterionId: null }] }, { job, sourceText }), /原文/);
});
test('multiple additions receive distinct server-owned identifiers', () => {
  const raw = response(); raw.changes.push({ ...raw.changes[0], text: '主导过上线验收' });
  const draft = validateDraft(raw, { job, sourceText });
  assert.notEqual(draft.changes[0].id, draft.changes[1].id);
  assert.ok(draft.changes.every(c => !job.criteria.some(x => x.id === c.id)));
});
test('explicit cancellation removes only the reviewed condition', () => {
  const raw = { changes: [{ operation: 'remove', id: 'rag', quote: sourceText }], questions: [] };
  const draft = validateDraft(raw, { job, sourceText });
  const next = applyChange(job, patchFromDraft(draft, { job, sourceText, confirmedBy: '顾问林' }));
  assert.deepEqual(next.criteria, [job.criteria[0]]);
});
