export const evaluationJob = { id: 'eval-job', version: 1, criteria: [
  { id: 'b2b', text: 'B端产品经验', kind: 'required', quote: '必须有B端产品经验' },
  { id: 'rag', text: '参与过RAG应用', kind: 'preferred', quote: 'RAG是加分项' },
  { id: 'city', text: '工作地点为上海', kind: 'required', quote: '工作地点为上海' },
  { id: 'salary', text: '年薪50万元以内', kind: 'required', quote: '年薪50万元以内' },
], history: [] };
export const cases = [
  { id: 'mixed-ambiguity', sourceText: 'RAG不用卡死，但必须主导过产品上线，城市可以放宽。', expected: '只新增必要的上线经历；保留B端和RAG原分类；城市待确认。', check: d => d.changes.length === 1 && d.changes[0].operation === 'add' && d.changes[0].kind === 'required' && /上线/.test(d.changes[0].text) && d.questions.some(q => q.criterionId === 'city') },
  { id: 'rag-required', sourceText: 'RAG改为必须具备的经验。', expected: '只把rag改为required。', check: d => d.changes.length === 1 && d.changes[0].id === 'rag' && d.changes[0].kind === 'required' },
  { id: 'explicit-removal', sourceText: '明确取消RAG应用经历要求，其他条件不变。', expected: '只取消rag。', check: d => d.changes.length === 1 && d.changes[0].id === 'rag' && d.changes[0].operation === 'remove' },
  { id: 'b2b-preferred', sourceText: 'B端产品经验不是必须，改为加分项。', expected: '只把b2b改为preferred。', check: d => d.changes.length === 1 && d.changes[0].id === 'b2b' && d.changes[0].kind === 'preferred' },
  { id: 'explicit-cities', sourceText: '工作城市改为上海或杭州。', expected: '只更新city，包含上海和杭州。', check: d => d.changes.length === 1 && d.changes[0].id === 'city' && /上海/.test(d.changes[0].text) && /杭州/.test(d.changes[0].text) },
  { id: 'salary-unclear', sourceText: '薪资可以谈，先放宽一点。', expected: '不改薪资，提出salary澄清问题。', check: d => !d.changes.length && d.questions.some(q => q.criterionId === 'salary') },
  { id: 'new-years', sourceText: '新增一个硬性要求：至少5年产品经验，其他要求不变。', expected: '只新增至少5年经验为required。', check: d => d.changes.length === 1 && d.changes[0].operation === 'add' && d.changes[0].kind === 'required' && /5|五/.test(d.changes[0].text) },
  { id: 'no-change', sourceText: '先不改岗位要求，等我确认后再说。', expected: '没有条件变更。', check: d => !d.changes.length },
  { id: 'education-soft', sourceText: '本科最好有，但不是必须。', expected: '只新增学历加分项。', check: d => d.changes.length === 1 && d.changes[0].operation === 'add' && d.changes[0].kind === 'preferred' && /本科/.test(d.changes[0].text) },
  { id: 'conflicting-feedback', sourceText: 'RAG必须具备，但同时RAG不能作为必要条件。', expected: '不改rag，提出冲突澄清问题。', check: d => !d.changes.length && d.questions.some(q => q.criterionId === 'rag') },
];
