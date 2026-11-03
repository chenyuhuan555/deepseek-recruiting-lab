const criteria = [
  { id: 'b2b', text: '具备 B 端产品经验', kind: 'required', quote: '需要有 B 端产品经验' },
  { id: 'rag', text: '参与过 RAG 应用', kind: 'preferred', quote: '做过 RAG 应用更好' },
  { id: 'hr', text: '熟悉招聘业务流程', kind: 'required', quote: '需要熟悉招聘业务流程' },
];
export const projects = [
  { id: 'job-a', clientId: 'client-a', client: '禾序 · HR SaaS', title: 'AI 产品经理', source: '需要有 B 端产品经验，需要熟悉招聘业务流程，做过 RAG 应用更好。', version: 1, criteria: structuredClone(criteria), history: [] },
  { id: 'job-b', clientId: 'client-b', client: '向野 · 猎头平台', title: '招聘产品经理', source: '需要有 B 端产品经验，需要熟悉招聘业务流程，做过 RAG 应用更好。', version: 1, criteria: structuredClone(criteria), history: [] },
];
export const memories = [
  { id: 'm1', text: '优先了解中大型企业客户的交付经历。', scope: 'client', ownerId: 'client-a', owner: '禾序', confirmedBy: '顾问林', expiresOn: '2027-01-31', source: '虚构客户沟通纪要 · 2026-11-01' },
  { id: 'm2', text: '这个岗位的 RAG 经历是加分项，不直接排除其他背景。', scope: 'job', ownerId: 'job-a', owner: '禾序 / AI 产品经理', confirmedBy: '顾问林', expiresOn: '2026-12-01', source: '虚构岗位启动会 · 2026-11-02' },
  { id: 'm3', text: '希望候选人能每周到现场协作三天。', scope: 'client', ownerId: 'client-b', owner: '向野', confirmedBy: '顾问林', expiresOn: '2027-01-31', source: '虚构客户反馈 · 2026-11-02' },
  { id: 'm4', text: '只考虑目前已经在上海的候选人。', scope: 'client', ownerId: 'client-a', owner: '禾序', confirmedBy: '顾问林', expiresOn: '2026-10-31', source: '虚构旧项目纪要 · 2026-09-15' },
  { id: 'm5', text: '是否只看大厂背景？仍待客户确认。', scope: 'client', ownerId: 'client-a', owner: '禾序', confirmedBy: '', expiresOn: null, source: '虚构草稿 · 尚未确认' },
  { id: 'm6', text: '摘要先用三句话说明，再列出待核实问题。', scope: 'recruiter', ownerId: 'r1', owner: '顾问林', confirmedBy: '顾问林', expiresOn: null, source: '虚构顾问表达偏好' },
  { id: 'm7', text: '先展示产品案例，再解释与岗位的关系。', scope: 'recruiter', ownerId: 'r2', owner: '顾问周', confirmedBy: '顾问周', expiresOn: null, source: '虚构顾问表达偏好' },
];
export const evidence = [
  { id: 'e1', criterionId: 'b2b', title: 'B 端产品经历', quote: '负责企业人事系统的权限、审批和员工档案需求，参与客户需求访谈。', inference: '具备企业软件相关产品经历。', gap: '尚不清楚负责范围、上线结果以及是否主导交付。', source: '虚构候选材料 A · 产品经历节选' },
  { id: 'e2', criterionId: 'rag', title: 'RAG 应用经历', quote: '参与知识库问答功能的需求设计，与算法团队讨论回答质量。', inference: '可能接触过知识库问答产品。', gap: '原文没有说明是否使用 RAG、检索方案或个人贡献，不能直接当作已验证的 RAG 经历。', source: '虚构候选材料 A · 项目节选' },
];
export const kindLabels = { required: '必要条件', preferred: '加分项', not_required: '不再要求', unconfirmed: '待确认' };
export const reviewLabels = { pending: '待复核', supported: '支持', unsupported: '不支持', insufficient: '信息不足', stale: '需重新复核' };
